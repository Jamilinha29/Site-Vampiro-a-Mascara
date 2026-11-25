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
  save: (id: string, envelope: Envelope<unknown>, expectedRevision: number | null) => Promise<Envelope<unknown>>
}

const TABLE = 'DocumentosCampanha'
const loadedRevisions = new Map<string, number>()
const locks = new Map<string, Promise<unknown>>()
let warnedMissing = false
let customRemoteBackend: RemoteDocumentBackend | null = null

export function setRemoteDocumentBackendForTests(backend: RemoteDocumentBackend | null) {
  customRemoteBackend = backend
  loadedRevisions.clear()
}

export function resetDocumentRevisionsForTests() {
  loadedRevisions.clear()
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

async function defaultRemoteLoad(id: string): Promise<Envelope<unknown> | null> {
  if (process.env.NODE_ENV === 'test' && process.env.BELADONA_TEST_USE_ENV !== 'true') return null
  const sb = getSupabaseAdmin()
  if (!sb) return null

  const { data, error } = await sb
    .from(TABLE)
    .select('payload, revision, updated_at')
    .eq('id', id)
    .maybeSingle()

  if (error) {
    // Fallback para tabelas pré-migração sem coluna `revision`
    if (/revision/i.test(error.message)) {
      const legacy = await sb.from(TABLE).select('payload, updated_at').eq('id', id).maybeSingle()
      if (!legacy.error && legacy.data?.payload) {
        return normalizeEnvelope(legacy.data.payload, 1)
      }
    }
    if (!/DocumentosCampanha|campaign_documents|schema cache|does not exist/i.test(error.message)) {
      console.warn('[estado] Falha ao ler', id, error.message)
      throw new PersistenceError('Não foi possível ler o estado da campanha no banco.', error)
    }
    return null
  }
  if (!data?.payload) return null
  const dbRev = typeof (data as { revision?: unknown }).revision === 'number' ? Number((data as { revision: number }).revision) : 1
  const norm = normalizeEnvelope(data.payload, dbRev)
  if (norm) norm.revision = Math.max(norm.revision, dbRev)
  return norm
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
  return customRemoteBackend ?? { load: defaultRemoteLoad, save: defaultRemoteSave }
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
  writeJsonFile(localName(id), chosen)
  if (remote && chosen !== remote) {
    const saved = await remoteBackend().save(id, chosen, remote.revision)
    loadedRevisions.set(id, saved.revision)
  } else if (!remote && local && (getSupabaseAdmin() || customRemoteBackend)) {
    const saved = await remoteBackend().save(id, chosen, null)
    loadedRevisions.set(id, saved.revision)
  }
  return chosen
}

export async function checkRemoteDocumentRevision(id: string): Promise<number> {
  const remote = await remoteBackend().load(id)
  return remote?.revision ?? 0
}
