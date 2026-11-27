import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import zlib from 'node:zlib'
import { createClient } from '@supabase/supabase-js'

const TABLES = [
  'Linhagens',
  'PerfisJogadores',
  'Personagens',
  'SubclassesPersonagem',
  'ItensPersonagem',
  'HabilidadesPersonagem',
  'EntidadesCronica',
  'CatalogoReferencia',
  'DocumentosCampanha',
  'SessoesAgendadas',
  'PresencaSessao',
  'AssentosSessao',
  'MateriaisSessao',
  'ParticipantesMaterial',
  'RecompensasMaterial',
  'AmeacasCena',
  'NpcsCena',
  'Carteiras',
  'ExtratoCarteira',
  'ComprasLoja',
  'NotificacoesPublicas',
  'LeiturasNotificacao',
  'Inscricoes',
  'EntregasEmail',
  'OperacoesIdempotentes',
  'AuditoriaOperacoes',
  'RevisoesPersonagem',
  'AcoesSessao',
  'TentativasCodigoMesa',
  'MetadadosBackup',
]

const BUCKETS = ['perfil', 'loja-glossario', 'revelacoes']
const PAGE_SIZE = 1000

function resolveBackupDir() {
  return path.resolve(process.env.BELADONA_BACKUP_DIR || path.join(process.cwd(), 'backups'))
}

function getSupabase() {
  const url = process.env.SUPABASE_URL?.trim()
  const key = (process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || '').trim()
  if (!url || !key) return null
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } })
}

/** BLD2: cabeçalho + salt (16B) + IV (12B) + authTag (16B) + ciphertext (chave derivada via scrypt). */
function encryptPayload(plainGz, secret) {
  const salt = crypto.randomBytes(16)
  const key = crypto.scryptSync(secret, salt, 32, { N: 16384, r: 8, p: 1 })
  const iv = crypto.randomBytes(12)
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv)
  const enc = Buffer.concat([cipher.update(plainGz), cipher.final()])
  const tag = cipher.getAuthTag()
  return Buffer.concat([Buffer.from('BLD2'), salt, iv, tag, enc])
}

/** Descriptografa tanto BLD2 (scrypt + salt) quanto legado BLD1 (sha256). */
function decryptPayload(raw, secret) {
  const magic = raw.subarray(0, 4).toString('ascii')
  if (magic === 'BLD2') {
    const salt = raw.subarray(4, 20)
    const iv = raw.subarray(20, 32)
    const tag = raw.subarray(32, 48)
    const enc = raw.subarray(48)
    const key = crypto.scryptSync(secret, salt, 32, { N: 16384, r: 8, p: 1 })
    const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv)
    decipher.setAuthTag(tag)
    return Buffer.concat([decipher.update(enc), decipher.final()])
  }
  if (magic === 'BLD1') {
    const iv = raw.subarray(4, 16)
    const tag = raw.subarray(16, 32)
    const enc = raw.subarray(32)
    const key = crypto.createHash('sha256').update(secret).digest()
    const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv)
    decipher.setAuthTag(tag)
    return Buffer.concat([decipher.update(enc), decipher.final()])
  }
  throw new Error(`Cabeçalho de backup não reconhecido: ${magic}`)
}

async function fetchAllRows(sb, table) {
  const rows = []
  for (let from = 0; ; from += PAGE_SIZE) {
    const { data, error } = await sb.from(table).select('*').range(from, from + PAGE_SIZE - 1)
    if (error) {
      if (/does not exist|schema cache/i.test(error.message)) {
        console.warn(`[backup] Tabela ausente/ignorada: ${table}`)
        return []
      }
      throw new Error(`Falha ao exportar tabela ${table}: ${error.message}`)
    }
    const batch = data ?? []
    rows.push(...batch)
    if (batch.length < PAGE_SIZE) break
  }
  return rows
}

async function listStorageRecursive(sb, bucket, prefix = '', depth = 0) {
  if (depth > 4) return []
  const files = []
  for (let offset = 0; ; offset += PAGE_SIZE) {
    const { data, error } = await sb.storage.from(bucket).list(prefix, { limit: PAGE_SIZE, offset })
    if (error || !data?.length) break
    for (const entry of data) {
      const fullPath = prefix ? `${prefix}/${entry.name}` : entry.name
      const isFolder = entry.id == null && entry.metadata == null
      if (isFolder) {
        files.push(...(await listStorageRecursive(sb, bucket, fullPath, depth + 1)))
      } else {
        files.push(fullPath)
      }
    }
    if (data.length < PAGE_SIZE) break
  }
  return files
}

function buildLogicalRestoreBundle(tables, exportedAt) {
  const docs = new Map()
  for (const row of tables.DocumentosCampanha ?? []) {
    if (row?.id && row?.payload) docs.set(row.id, row.payload.body ?? row.payload)
  }
  const sessionsDoc = docs.get('sessions') ?? {}
  const courtDoc = docs.get('court') ?? {}
  return {
    schemaVersion: '2026-11-24',
    exportedAt,
    profiles: Array.isArray(docs.get('profiles')) ? docs.get('profiles') : [],
    sessions: Array.isArray(sessionsDoc.sessions) ? sessionsDoc.sessions : [],
    handouts: Array.isArray(sessionsDoc.handouts) ? sessionsDoc.handouts : [],
    wallets: courtDoc.wallets && typeof courtDoc.wallets === 'object' ? courtDoc.wallets : {},
  }
}

async function runExport() {
  const sb = getSupabase()
  if (!sb) {
    console.error('[backup] SUPABASE_URL e SUPABASE_SECRET_KEY (ou SUPABASE_SERVICE_ROLE_KEY) são obrigatórios para exportação externa.')
    process.exitCode = 1
    return
  }

  const tables = {}
  const counts = {}
  for (const table of TABLES) {
    const rows = await fetchAllRows(sb, table)
    tables[table] = rows
    counts[table] = rows.length
  }

  const storageManifest = {}
  for (const bucket of BUCKETS) {
    storageManifest[bucket] = await listStorageRecursive(sb, bucket)
  }

  const exportedAt = new Date().toISOString()
  const restoreBundle = buildLogicalRestoreBundle(tables, exportedAt)
  const bundle = {
    schemaVersion: '2026-11-24',
    exportedAt,
    source: 'supabase-api-export',
    counts,
    storageManifest,
    tables,
    // Campos no topo para compatibilidade direta com /api/v1/admin/chronicle/backup/drill e /restore
    profiles: restoreBundle.profiles,
    sessions: restoreBundle.sessions,
    handouts: restoreBundle.handouts,
    wallets: restoreBundle.wallets,
  }

  const json = Buffer.from(JSON.stringify(bundle), 'utf8')
  const gz = zlib.gzipSync(json, { level: 9 })
  const sha256 = crypto.createHash('sha256').update(json).digest('hex')
  const dir = resolveBackupDir()
  fs.mkdirSync(dir, { recursive: true })
  const stamp = exportedAt.replace(/[:.]/g, '-')
  const backupKey = process.env.BELADONA_BACKUP_KEY?.trim()

  if (!backupKey) {
    console.error('[backup] BELADONA_BACKUP_KEY não definida; recusando gravar backup sem criptografia fora de modo local explícito.')
    process.exitCode = 2
    return
  }

  const fileName = `beladona-backup-${stamp}.json.gz.enc`
  const outPath = path.join(dir, fileName)
  const ciphered = encryptPayload(gz, backupKey)
  fs.writeFileSync(outPath, ciphered, { mode: 0o600 })

  const externalTarget = process.env.BELADONA_EXTERNAL_BACKUP_TARGET?.trim() || ''
  const manifest = {
    fileName,
    exportedAt,
    format: 'BLD2',
    sha256,
    bytesEncrypted: ciphered.length,
    counts,
    storageBuckets: Object.fromEntries(Object.entries(storageManifest).map(([k, v]) => [k, v.length])),
    externalStatus: externalTarget ? 'configured_external_target' : 'pending_external_destination',
  }
  fs.writeFileSync(path.join(dir, 'latest-manifest.json'), JSON.stringify(manifest, null, 2))

  const storageTotal = Object.values(storageManifest).reduce((s, list) => s + list.length, 0)
  const { error: metaErr } = await sb.from('MetadadosBackup').insert({
    scope: externalTarget ? 'external_encrypted_export' : 'local_encrypted_export',
    schema_version: '2026-11-24',
    status: externalTarget ? 'completed_unverified' : 'pending_external_destination',
    record_counts: { ...counts, storageObjects: storageTotal },
    checksum_sha256: sha256,
    external_ref: externalTarget || null,
    operator_email: 'backup-script',
    notes: externalTarget
      ? `Destino configurado: ${externalTarget}`
      : 'Exportação criptografada gerada (BLD2); configurar BELADONA_EXTERNAL_BACKUP_TARGET no destino off-site privado.',
  })
  if (metaErr) {
    console.warn('[backup] Aviso ao gravar MetadadosBackup:', metaErr.message)
  }

  console.log(JSON.stringify(manifest, null, 2))
}

function runDecrypt(inputFile, outputFile) {
  const backupKey = process.env.BELADONA_BACKUP_KEY?.trim()
  if (!backupKey) {
    console.error('[backup] BELADONA_BACKUP_KEY é obrigatória para descriptografar.')
    process.exitCode = 2
    return
  }
  if (!inputFile || !fs.existsSync(inputFile)) {
    console.error('[backup] Informe o caminho do arquivo .json.gz.enc existente.')
    process.exitCode = 1
    return
  }
  const raw = fs.readFileSync(inputFile)
  const gz = decryptPayload(raw, backupKey)
  const json = zlib.gunzipSync(gz)
  const out = outputFile || inputFile.replace(/\.json\.gz\.enc$/i, '.json')
  fs.writeFileSync(out, json, { mode: 0o600 })
  console.log(`[backup] Descriptografado em ${out} (${json.length} bytes).`)
}

async function runCheck() {
  const dir = resolveBackupDir()
  const manifestPath = path.join(dir, 'latest-manifest.json')
  if (!fs.existsSync(manifestPath)) {
    console.log(
      JSON.stringify({
        ok: false,
        status: 'pending_external_destination',
        message: 'Nenhum manifesto local encontrado em backups/; execute backup:export com credenciais e BELADONA_BACKUP_KEY.',
      }),
    )
    return
  }
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'))
  const ageHours = (Date.now() - new Date(manifest.exportedAt).getTime()) / 3_600_000
  const maxAgeHours = Number(process.env.BELADONA_BACKUP_MAX_AGE_HOURS || 48)
  const fileExists = fs.existsSync(path.join(dir, manifest.fileName))
  const ok = fileExists && ageHours <= maxAgeHours
  console.log(
    JSON.stringify({
      ok,
      ageHours: Number(ageHours.toFixed(2)),
      maxAgeHours,
      fileExists,
      externalStatus: manifest.externalStatus,
      sha256: manifest.sha256,
    }),
  )
  if (!ok) process.exitCode = 1
}

const cmd = process.argv[2] ?? 'check'
if (cmd === 'export') {
  void runExport().catch((err) => {
    console.error('[backup] erro:', err instanceof Error ? err.message : err)
    process.exitCode = 1
  })
} else if (cmd === 'decrypt') {
  try {
    runDecrypt(process.argv[3], process.argv[4])
  } catch (err) {
    console.error('[backup] falha ao descriptografar:', err instanceof Error ? err.message : err)
    process.exitCode = 1
  }
} else {
  void runCheck()
}
