import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import zlib from 'node:zlib'
import { createClient } from '@supabase/supabase-js'

const TABLES = [
  'DocumentosCampanha',
  'EntidadesCronica',
  'CatalogoReferencia',
  'Personagens',
  'Usuarios',
  'OperacoesIdempotentes',
  'AuditoriaOperacoes',
  'RevisoesPersonagem',
  'AcoesSessao',
  'MetadadosBackup',
]

const BUCKETS = ['perfil', 'loja-glossario', 'revelacoes']

function resolveBackupDir() {
  return path.resolve(process.env.BELADONA_BACKUP_DIR || path.join(process.cwd(), 'backups'))
}

function getSupabase() {
  const url = process.env.SUPABASE_URL?.trim()
  const key = (process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || '').trim()
  if (!url || !key) return null
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } })
}

function encryptPayload(plainGz, secret) {
  const key = crypto.createHash('sha256').update(secret).digest()
  const iv = crypto.randomBytes(12)
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv)
  const enc = Buffer.concat([cipher.update(plainGz), cipher.final()])
  const tag = cipher.getAuthTag()
  return Buffer.concat([Buffer.from('BLD1'), iv, tag, enc])
}

async function runExport() {
  const sb = getSupabase()
  if (!sb) {
    console.error('[backup] SUPABASE_URL e SUPABASE_SECRET_KEY são obrigatórios para exportação externa.')
    process.exitCode = 1
    return
  }

  const tables = {}
  const counts = {}
  for (const table of TABLES) {
    const { data, error } = await sb.from(table).select('*')
    if (error) {
      if (!/does not exist|schema cache/i.test(error.message)) {
        throw new Error(`Falha ao exportar tabela ${table}: ${error.message}`)
      }
      tables[table] = []
      counts[table] = 0
      continue
    }
    tables[table] = data ?? []
    counts[table] = tables[table].length
  }

  const storageManifest = {}
  for (const bucket of BUCKETS) {
    const { data, error } = await sb.storage.from(bucket).list('', { limit: 1000 })
    if (error) {
      storageManifest[bucket] = []
      continue
    }
    storageManifest[bucket] = (data ?? []).map((entry) => entry.name)
  }

  const bundle = {
    schemaVersion: 1,
    exportedAt: new Date().toISOString(),
    source: 'supabase-api-export',
    counts,
    storageManifest,
    tables,
  }

  const json = Buffer.from(JSON.stringify(bundle), 'utf8')
  const gz = zlib.gzipSync(json, { level: 9 })
  const sha256 = crypto.createHash('sha256').update(json).digest('hex')
  const dir = resolveBackupDir()
  fs.mkdirSync(dir, { recursive: true })
  const stamp = new Date().toISOString().replace(/[:.]/g, '-')
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
    exportedAt: bundle.exportedAt,
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
    schema_version: '1',
    status: externalTarget ? 'completed_unverified' : 'pending_external_destination',
    record_counts: { ...counts, storageObjects: storageTotal },
    checksum_sha256: sha256,
    external_ref: externalTarget || null,
    operator_email: 'backup-script',
    notes: externalTarget
      ? `Destino configurado: ${externalTarget}`
      : 'Exportação criptografada gerada; configurar BELADONA_EXTERNAL_BACKUP_TARGET no CI/destino off-site.',
  })
  if (metaErr) {
    console.warn('[backup] Aviso ao gravar MetadadosBackup:', metaErr.message)
  }

  console.log(JSON.stringify(manifest, null, 2))
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
} else {
  void runCheck()
}
