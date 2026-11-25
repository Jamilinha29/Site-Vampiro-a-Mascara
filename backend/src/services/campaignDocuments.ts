import { readJsonFile, writeJsonFile } from './localJson.js'
import { ConflictError, PersistenceError } from './errors.js'
import { getSupabaseAdmin, isSharedDeploymentEnvironment } from './supabaseClient.js'

export type Envelope<T> = {
  updatedAt: string
  revision: number
  body: T
}

export type RemoteDocumentBackend = {
  load: (id: string) => Promise<Envelope<unknown> | null>
  loadRevision?: (id: string) => Promise<number | null>
  save: (id: string, envelope: Envelope<unknown>, expectedRevision: number | null) => Promise<Envelope<unknown>>
}

const TABLE = 'DocumentosCampanha'
const SCHEMA_RETRY_COOLDOWN_MS = 10 * 60_000
const REVISION_TTL_MS = 10_000
const loadedRevisions = new Map<string, number>()
const loadedUpdatedAt = new Map<string, string>()
const revisionCache = new Map<string, { rev: number; at: number }>()
const inFlightRevisionChecks = new Map<string, Promise<number>>()
const primedDocuments = new Map<string, Envelope<unknown> | null>()
const pendingRevisionBatch = new Map<
  string,
  Array<{ resolve: (rev: number | null) => void; reject: (err: unknown) => void }>
>()
let revisionBatchScheduled = false
const locks = new Map<string, Promise<unknown>>()
let warnedMissing = false
let customRemoteBackend: RemoteDocumentBackend | null = null
let revisionColUnavailableUntil = 0
let casRpcUnavailableUntil = 0
let tableUnavailableUntil = 0

function isMissingSchemaError(err: { message?: string; code?: string } | null | undefined, pattern: RegExp) {
  if (!err) return false
  return pattern.test(err.message ?? '') || err.code === 'PGRST205' || err.code === 'PGRST204' || err.code === '42703'
}

export function setRemoteDocumentBackendForTests(backend: RemoteDocumentBackend | null) {
  customRemoteBackend = backend
  loadedRevisions.clear()
  loadedUpdatedAt.clear()
  revisionCache.clear()
  inFlightRevisionChecks.clear()
  primedDocuments.clear()
}

export function resetDocumentRevisionsForTests() {
  loadedRevisions.clear()
  loadedUpdatedAt.clear()
  revisionCache.clear()
  inFlightRevisionChecks.clear()
  primedDocuments.clear()
  revisionColUnavailableUntil = 0
  casRpcUnavailableUntil = 0
  tableUnavailableUntil = 0
}

export function invalidateDocumentRevisionCache(id?: string) {
  if (id) revisionCache.delete(id)
  else revisionCache.clear()
}

export function getLoadedDocumentRevision(id: string) {
  return loadedRevisions.get(id) ?? 0
}

export function runExclusive<T>(channel: string, fn: () => Promise<T> | T): Promise<T> {
  const prev = locks.get(channel) ?? Promise.resolve()
  const next = prev.then(
    () => fn(),
    () => fn(),
  )
  locks.set(
    channel,
    next.then(
      () => undefined,
      () => undefined,
    ),
  )
  return next
}

export function documentWeight(body: unknown) {
  if (Array.isArray(body)) return body.length
  if (body && typeof body === 'object') return Object.keys(body as object).length
  return body == null ? 0 : 1
}

/** Escolhe a cópia mais nova com revisão monotônica. Uma cópia vazia não apaga a que tem dados. */
export function chooseDocument<T>(local: Envelope<T> | null, remote: Envelope<T> | null): Envelope<T> | null {
  if (!local) return remote
  if (!remote) return local
  const localWeight = documentWeight(local.body)
  const remoteWeight = documentWeight(remote.body)
  if (localWeight === 0 && remoteWeight > 0) return remote
  if (remoteWeight === 0 && localWeight > 0) return local
  const localRev = Number(local.revision ?? 0)
  const remoteRev = Number(remote.revision ?? 0)
  if (remoteRev !== localRev) return remoteRev > localRev ? remote : local
  return remote.updatedAt >= local.updatedAt ? remote : local
}

function localName(id: string) {
  return `state-${id}.json`
}

function normalizeEnvelope<T>(raw: unknown, fallbackRev = 1): Envelope<T> | null {
  if (!raw || typeof raw !== 'object') return null
  const obj = raw as Partial<Envelope<T>>
  if (!('body' in obj)) return null
  return {
    updatedAt: typeof obj.updatedAt === 'string' && obj.updatedAt ? obj.updatedAt : new Date().toISOString(),
    revision: typeof obj.revision === 'number' && Number.isFinite(obj.revision) ? obj.revision : fallbackRev,
    body: obj.body as T,
  }
}

/**
 * Carrega múltiplos documentos em uma única query `IN (...)` durante o cold start,
 * evitando 15 requisições HTTP separadas ao PostgREST na inicialização serverless.
 */
export async function primeDocumentsCache(ids: readonly string[]): Promise<void> {
  if (process.env.NODE_ENV === 'test' && process.env.BELADONA_TEST_USE_ENV !== 'true') return
  if (customRemoteBackend || Date.now() < tableUnavailableUntil || ids.length === 0) return
  const sb = getSupabaseAdmin()
  if (!sb) return

  const uniqueIds = [...new Set(ids)]

  const storeRows = (
    rows: Array<{ id?: unknown; payload?: unknown; revision?: unknown; updated_at?: unknown }>,
  ) => {
    const seen = new Set<string>()
    for (const row of rows) {
      const id = typeof row.id === 'string' ? row.id : ''
      if (!id) continue
      seen.add(id)
      if (typeof row.updated_at === 'string') loadedUpdatedAt.set(id, row.updated_at)
      if (!row.payload) {
        primedDocuments.set(id, null)
        continue
      }
      const dbRev = typeof row.revision === 'number' ? Number(row.revision) : 1
      const norm = normalizeEnvelope(row.payload, dbRev)
      if (norm) norm.revision = Math.max(norm.revision, dbRev)
      primedDocuments.set(id, norm)
    }
    for (const id of uniqueIds) {
      if (!seen.has(id)) primedDocuments.set(id, null)
    }
  }

  if (Date.now() < revisionColUnavailableUntil) {
    const legacy = await sb.from(TABLE).select('id, payload, updated_at').in('id', uniqueIds)
    if (legacy.error) {
      if (isMissingSchemaError(legacy.error, /DocumentosCampanha|campaign_documents|schema cache|does not exist/i)) {
        tableUnavailableUntil = Date.now() + SCHEMA_RETRY_COOLDOWN_MS
      }
      return
    }
    storeRows(legacy.data ?? [])
    return
  }

  const { data, error } = await sb.from(TABLE).select('id, payload, revision, updated_at').in('id', uniqueIds)
  if (error) {
    if (/revision/i.test(error.message) || error.code === '42703' || error.code === 'PGRST204') {
      revisionColUnavailableUntil = Date.now() + SCHEMA_RETRY_COOLDOWN_MS
      const legacy = await sb.from(TABLE).select('id, payload, updated_at').in('id', uniqueIds)
      if (!legacy.error) storeRows(legacy.data ?? [])
      return
    }
    if (isMissingSchemaError(error, /DocumentosCampanha|campaign_documents|schema cache|does not exist/i)) {
      tableUnavailableUntil = Date.now() + SCHEMA_RETRY_COOLDOWN_MS
    }
    return
  }
  storeRows(data ?? [])
}

async function defaultRemoteLoad(id: string): Promise<Envelope<unknown> | null> {
  if (process.env.NODE_ENV === 'test' && process.env.BELADONA_TEST_USE_ENV !== 'true') return null
  if (Date.now() < tableUnavailableUntil) return null
  if (primedDocuments.has(id)) {
    const primed = primedDocuments.get(id) ?? null
    primedDocuments.delete(id)
    return primed
  }
  const sb = getSupabaseAdmin()
  if (!sb) return null

  if (Date.now() < revisionColUnavailableUntil) {
    const legacy = await sb.from(TABLE).select('payload, updated_at').eq('id', id).maybeSingle()
    if (legacy.error) {
      if (isMissingSchemaError(legacy.error, /DocumentosCampanha|campaign_documents|schema cache|does not exist/i)) {
        tableUnavailableUntil = Date.now() + SCHEMA_RETRY_COOLDOWN_MS
      }
      return null
    }
    if (!legacy.data?.payload) return null
    if (typeof legacy.data.updated_at === 'string') loadedUpdatedAt.set(id, legacy.data.updated_at)
    return normalizeEnvelope(legacy.data.payload, 1)
  }

  const { data, error } = await sb
    .from(TABLE)
    .select('payload, revision, updated_at')
    .eq('id', id)
    .maybeSingle()

  if (error) {
    // Fallback para tabelas pré-migração sem coluna `revision`
    if (/revision/i.test(error.message) || error.code === '42703' || error.code === 'PGRST204') {
      revisionColUnavailableUntil = Date.now() + SCHEMA_RETRY_COOLDOWN_MS
      const legacy = await sb.from(TABLE).select('payload, updated_at').eq('id', id).maybeSingle()
      if (!legacy.error && legacy.data?.payload) {
        if (typeof legacy.data.updated_at === 'string') loadedUpdatedAt.set(id, legacy.data.updated_at)
        return normalizeEnvelope(legacy.data.payload, 1)
      }
    }
    if (isMissingSchemaError(error, /DocumentosCampanha|campaign_documents|schema cache|does not exist/i)) {
      tableUnavailableUntil = Date.now() + SCHEMA_RETRY_COOLDOWN_MS
      return null
    }
    console.warn('[estado] Falha ao ler', id, error.message)
    throw new PersistenceError('Não foi possível ler o estado da campanha no banco.', error)
  }
  if (!data?.payload) return null
  if (typeof data.updated_at === 'string') loadedUpdatedAt.set(id, data.updated_at)
  const dbRev = typeof (data as { revision?: unknown }).revision === 'number' ? Number((data as { revision: number }).revision) : 1
  const norm = normalizeEnvelope(data.payload, dbRev)
  if (norm) norm.revision = Math.max(norm.revision, dbRev)
  return norm
}

async function flushRevisionBatch() {
  revisionBatchScheduled = false
  const entries = [...pendingRevisionBatch.entries()]
  pendingRevisionBatch.clear()
  if (entries.length === 0) return

  const ids = entries.map(([id]) => id)
  const resolveAll = (values: Map<string, number | null>) => {
    const now = Date.now()
    for (const [id, waiters] of entries) {
      const val = values.has(id) ? (values.get(id) ?? null) : 0
      if (typeof val === 'number') {
        revisionCache.set(id, { rev: val, at: now })
      }
      for (const w of waiters) w.resolve(val)
    }
  }

  const sb = getSupabaseAdmin()
  if (!sb || Date.now() < tableUnavailableUntil) {
    const nulls = new Map<string, number | null>(ids.map((id) => [id, null]))
    resolveAll(nulls)
    return
  }

  const runLegacyBatch = async () => {
    const legacy = await sb.from(TABLE).select('id, updated_at').in('id', ids)
    if (legacy.error) {
      if (isMissingSchemaError(legacy.error, /DocumentosCampanha|campaign_documents|schema cache|does not exist/i)) {
        tableUnavailableUntil = Date.now() + SCHEMA_RETRY_COOLDOWN_MS
      }
      resolveAll(new Map(ids.map((id) => [id, null])))
      return
    }
    const byId = new Map<string, string>()
    for (const row of legacy.data ?? []) {
      if (typeof row.id === 'string' && typeof row.updated_at === 'string') {
        byId.set(row.id, row.updated_at)
      }
    }
    const result = new Map<string, number | null>()
    for (const id of ids) {
      const remoteUpdated = byId.get(id) ?? ''
      const prevUpdated = loadedUpdatedAt.get(id) ?? ''
      const localRev = getLoadedDocumentRevision(id)
      if (!remoteUpdated) result.set(id, localRev)
      else if (!prevUpdated || remoteUpdated > prevUpdated) result.set(id, localRev + 1)
      else result.set(id, localRev)
    }
    resolveAll(result)
  }

  if (Date.now() < revisionColUnavailableUntil) {
    await runLegacyBatch()
    return
  }

  const { data, error } = await sb.from(TABLE).select('id, revision').in('id', ids)
  if (error) {
    if (/revision/i.test(error.message) || error.code === '42703' || error.code === 'PGRST204') {
      revisionColUnavailableUntil = Date.now() + SCHEMA_RETRY_COOLDOWN_MS
      await runLegacyBatch()
      return
    }
    if (isMissingSchemaError(error, /DocumentosCampanha|campaign_documents|schema cache|does not exist/i)) {
      tableUnavailableUntil = Date.now() + SCHEMA_RETRY_COOLDOWN_MS
    }
    resolveAll(new Map(ids.map((id) => [id, null])))
    return
  }

  const result = new Map<string, number | null>()
  for (const row of data ?? []) {
    if (typeof row.id === 'string') {
      const rev = typeof (row as { revision?: unknown }).revision === 'number'
        ? Number((row as { revision: number }).revision)
        : 0
      result.set(row.id, rev)
    }
  }
  resolveAll(result)
}

async function defaultRemoteLoadRevision(id: string): Promise<number | null> {
  if (process.env.NODE_ENV === 'test' && process.env.BELADONA_TEST_USE_ENV !== 'true') return null
  if (Date.now() < tableUnavailableUntil) return null
  const sb = getSupabaseAdmin()
  if (!sb) return null

  return new Promise<number | null>((resolve, reject) => {
    const waiters = pendingRevisionBatch.get(id) ?? []
    waiters.push({ resolve, reject })
    pendingRevisionBatch.set(id, waiters)
    if (!revisionBatchScheduled) {
      revisionBatchScheduled = true
      queueMicrotask(() => {
        void flushRevisionBatch()
      })
    }
  })
}

async function defaultRemoteSave(
  id: string,
  envelope: Envelope<unknown>,
  expectedRevision: number | null,
): Promise<Envelope<unknown>> {
  if (process.env.NODE_ENV === 'test' && process.env.BELADONA_TEST_USE_ENV !== 'true') {
    return envelope
  }
  const sb = getSupabaseAdmin()
  if (!sb) {
    if (isSharedDeploymentEnvironment()) {
      throw new PersistenceError('Banco durável não configurado neste ambiente publicado.')
    }
    return envelope
  }

  if (Date.now() >= casRpcUnavailableUntil) {
    const rpc = await sb.rpc('beladona_upsert_campaign_document', {
      p_id: id,
      p_payload: envelope,
      p_expected_revision: expectedRevision,
    })

    if (!rpc.error && Array.isArray(rpc.data) && rpc.data[0]) {
      const rev = Number((rpc.data[0] as { revision: number }).revision)
      return { ...envelope, revision: rev }
    }

    if (rpc.error) {
      if (/DOCUMENT_CONFLICT|40001/i.test(rpc.error.message) || rpc.error.code === '40001') {
        throw new ConflictError(`Estado concorrente detectado ao salvar ${id}.`)
      }
      const rpcMissing =
        /beladona_upsert_campaign_document|schema cache|PGRST202|could not find the function/i.test(
          rpc.error.message,
        ) || rpc.error.code === 'PGRST202'
      if (!rpcMissing) {
        throw new PersistenceError(`Falha ao gravar estado ${id} no banco.`, rpc.error)
      }
      casRpcUnavailableUntil = Date.now() + SCHEMA_RETRY_COOLDOWN_MS
    }
  }

  // Fallback seguro quando a RPC da nova migração ainda não foi aplicada no remoto
  if (expectedRevision && expectedRevision > 0) {
    const { data, error } = await sb
      .from(TABLE)
      .update({ payload: envelope, updated_at: envelope.updatedAt })
      .eq('id', id)
      .select('id')
    if (error) {
      const missing = /DocumentosCampanha|campaign_documents|schema cache|does not exist/i.test(error.message)
      if (missing) {
        if (!warnedMissing) {
          console.warn('[estado] Tabela DocumentosCampanha ainda não existe. Aplique as migrações do Supabase.')
          warnedMissing = true
        }
        if (isSharedDeploymentEnvironment()) {
          throw new PersistenceError('Tabela DocumentosCampanha não aplicada no Supabase.', error)
        }
        return envelope
      }
      throw new PersistenceError('Não foi possível gravar o estado da campanha no banco.', error)
    }
    if (data && data.length > 0) return envelope
  }

  const { error } = await sb.from(TABLE).upsert(
    { id, payload: envelope, updated_at: envelope.updatedAt },
    { onConflict: 'id' },
  )
  if (!error) return envelope

  const missing = /DocumentosCampanha|campaign_documents|schema cache|does not exist/i.test(error.message)
  if (missing) {
    if (!warnedMissing) {
      console.warn('[estado] Tabela DocumentosCampanha ainda não existe. Aplique as migrações do Supabase.')
      warnedMissing = true
    }
    if (isSharedDeploymentEnvironment()) {
      throw new PersistenceError('Tabela DocumentosCampanha não aplicada no Supabase.', error)
    }
    return envelope
  }
  console.warn('[estado] Falha ao gravar', id, error.message)
  throw new PersistenceError('Não foi possível gravar o estado da campanha no banco. A versão anterior continua valendo.', error)
}

function remoteBackend(): RemoteDocumentBackend {
  return customRemoteBackend ?? {
    load: defaultRemoteLoad,
    loadRevision: defaultRemoteLoadRevision,
    save: defaultRemoteSave,
  }
}

/**
 * Grava documento de forma durável e retorna erro real quando o commit falha.
 * Usa revisão monotônica para detectar conflito entre instâncias.
 */
export async function commitDocument<T>(id: string, body: T): Promise<Envelope<T>> {
  return runExclusive(`doc:${id}`, async () => {
    const prevRev = loadedRevisions.get(id) ?? 0
    const nextRev = prevRev + 1
    const envelope: Envelope<T> = {
      updatedAt: new Date().toISOString(),
      revision: nextRev,
      body,
    }
    const saved = await remoteBackend().save(id, envelope, prevRev > 0 ? prevRev : null)
    const committed = { ...envelope, revision: saved.revision || nextRev }
    loadedRevisions.set(id, committed.revision)
    loadedUpdatedAt.set(id, committed.updatedAt)
    revisionCache.set(id, { rev: committed.revision, at: Date.now() })
    writeJsonFile(localName(id), committed)
    return committed
  })
}

/** Compatibilidade legada: agenda commit sem silenciar rejeições críticas de persistência. */
let pendingWrites: Promise<unknown> = Promise.resolve()

export function rememberDocument(id: string, body: unknown) {
  const job = commitDocument(id, body)
  pendingWrites = pendingWrites.then(
    () => job,
    () => job,
  )
  return job
}

export async function flushDurableState() {
  await pendingWrites
}

export async function loadDocument<T>(id: string): Promise<Envelope<T> | null> {
  const localRaw = readJsonFile<unknown>(localName(id))
  const local = normalizeEnvelope<T>(localRaw, 1)
  const remoteRaw = await remoteBackend().load(id)
  const remote = normalizeEnvelope<T>(remoteRaw, 1)
  const chosen = chooseDocument(local, remote)
  if (!chosen) return null
  loadedRevisions.set(id, chosen.revision)
  loadedUpdatedAt.set(id, chosen.updatedAt)
  revisionCache.set(id, { rev: chosen.revision, at: Date.now() })
  writeJsonFile(localName(id), chosen)
  if (remote && chosen !== remote) {
    const saved = await remoteBackend().save(id, chosen, remote.revision)
    loadedRevisions.set(id, saved.revision)
    revisionCache.set(id, { rev: saved.revision, at: Date.now() })
  } else if (!remote && local && (getSupabaseAdmin() || customRemoteBackend)) {
    const saved = await remoteBackend().save(id, chosen, null)
    loadedRevisions.set(id, saved.revision)
    revisionCache.set(id, { rev: saved.revision, at: Date.now() })
  }
  return chosen
}

export async function checkRemoteDocumentRevision(id: string): Promise<number> {
  const bypassCache =
    Boolean(customRemoteBackend) ||
    (process.env.NODE_ENV === 'test' && process.env.BELADONA_TEST_USE_ENV !== 'true')

  if (!bypassCache) {
    const cached = revisionCache.get(id)
    if (cached && Date.now() - cached.at < REVISION_TTL_MS) {
      return cached.rev
    }
    const existing = inFlightRevisionChecks.get(id)
    if (existing) return existing
  }

  const promise = (async () => {
    const backend = remoteBackend()
    let rev = 0
    if (backend.loadRevision) {
      const r = await backend.loadRevision(id)
      rev = r ?? 0
    } else {
      const remote = await backend.load(id)
      rev = remote?.revision ?? 0
    }
    if (!bypassCache) {
      revisionCache.set(id, { rev, at: Date.now() })
    }
    return rev
  })().finally(() => {
    inFlightRevisionChecks.delete(id)
  })

  if (!bypassCache) {
    inFlightRevisionChecks.set(id, promise)
  }
  return promise
}
