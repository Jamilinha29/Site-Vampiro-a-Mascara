import { createHash } from 'node:crypto'
import {
  checkRemoteDocumentRevision,
  commitDocument,
  documentWeight,
  getLoadedDocumentRevision,
  loadDocument,
  runExclusive,
} from './campaignDocuments.js'
import { ConflictError, PersistenceError } from './errors.js'
import { getSupabaseAdmin } from './supabaseClient.js'

export type StoredIdempotentOp = {
  actorEmail: string
  operationId: string
  kind: string
  requestHash: string
  status: number
  body: Record<string, unknown>
  createdAt: string
}

const DOC_ID = 'idempotency-ops'
const TABLE = 'OperacoesIdempotentes'
const MAX_MEM = 1000
const SCHEMA_RETRY_COOLDOWN_MS = 10 * 60_000
const records = new Map<string, StoredIdempotentOp>()
let idemTableUnavailableUntil = 0

function keyOf(actorEmail: string, operationId: string) {
  return `${actorEmail.trim().toLowerCase()}::${operationId.trim()}`
}

export function hashOperationPayload(payload: unknown): string {
  const canonical = stableStringify(payload)
  return createHash('sha256').update(canonical).digest('hex')
}

function stableStringify(val: unknown): string {
  if (val === null || typeof val !== 'object') return JSON.stringify(val)
  if (Array.isArray(val)) return `[${val.map(stableStringify).join(',')}]`
  const entries = Object.entries(val as Record<string, unknown>)
    .filter(([, v]) => v !== undefined)
    .sort(([a], [b]) => a.localeCompare(b))
  return `{${entries.map(([k, v]) => `${JSON.stringify(k)}:${stableStringify(v)}`).join(',')}}`
}

export async function hydrateIdempotencyStore() {
  const doc = await loadDocument<StoredIdempotentOp[]>(DOC_ID)
  if (!doc || documentWeight(doc.body) === 0) return
  records.clear()
  for (const row of doc.body.slice(-MAX_MEM)) {
    if (row?.actorEmail && row?.operationId) {
      records.set(keyOf(row.actorEmail, row.operationId), row)
    }
  }
}

export function resetIdempotencyStoreForTests() {
  records.clear()
}

async function syncIfStale() {
  const remoteRev = await checkRemoteDocumentRevision(DOC_ID)
  if (remoteRev > getLoadedDocumentRevision(DOC_ID)) {
    await hydrateIdempotencyStore()
  }
}

async function lookupDb(actorEmail: string, operationId: string): Promise<StoredIdempotentOp | null> {
  if (process.env.NODE_ENV === 'test' && process.env.BELADONA_TEST_USE_ENV !== 'true') return null
  if (Date.now() < idemTableUnavailableUntil) return null
  const sb = getSupabaseAdmin()
  if (!sb) return null
  const { data, error } = await sb
    .from(TABLE)
    .select('actor_email, operation_id, kind, request_hash, status_code, response_body, created_at')
    .eq('actor_email', actorEmail.trim().toLowerCase())
    .eq('operation_id', operationId.trim())
    .maybeSingle()
  if (error) {
    if (error.code === 'PGRST205' || /OperacoesIdempotentes|schema cache|does not exist/i.test(error.message)) {
      idemTableUnavailableUntil = Date.now() + SCHEMA_RETRY_COOLDOWN_MS
      return null
    }
    throw new PersistenceError('Falha ao consultar chave de operação.', error)
  }
  if (!data) return null
  return {
    actorEmail: String(data.actor_email),
    operationId: String(data.operation_id),
    kind: String(data.kind),
    requestHash: String(data.request_hash),
    status: Number(data.status_code),
    body: (data.response_body ?? {}) as Record<string, unknown>,
    createdAt: String(data.created_at),
  }
}

async function insertDb(op: StoredIdempotentOp): Promise<{ conflictWithExisting: boolean }> {
  if (process.env.NODE_ENV === 'test' && process.env.BELADONA_TEST_USE_ENV !== 'true') {
    return { conflictWithExisting: false }
  }
  if (Date.now() < idemTableUnavailableUntil) return { conflictWithExisting: false }
  const sb = getSupabaseAdmin()
  if (!sb) return { conflictWithExisting: false }
  const { error } = await sb.from(TABLE).insert({
    actor_email: op.actorEmail,
    operation_id: op.operationId,
    kind: op.kind,
    request_hash: op.requestHash,
    status_code: op.status,
    response_body: op.body,
    created_at: op.createdAt,
  })
  if (!error) return { conflictWithExisting: false }
  if (error.code === '23505' || /duplicate key/i.test(error.message)) {
    return { conflictWithExisting: true }
  }
  if (error.code === 'PGRST205' || /OperacoesIdempotentes|schema cache|does not exist/i.test(error.message)) {
    idemTableUnavailableUntil = Date.now() + SCHEMA_RETRY_COOLDOWN_MS
    return { conflictWithExisting: false }
  }
  throw new PersistenceError('Falha ao gravar registro de idempotência no banco.', error)
}

export async function runIdempotent<T extends Record<string, unknown>>(params: {
  actorEmail: string
  operationId?: string
  kind: string
  requestPayload: unknown
  execute: () => Promise<{ status: number; body: T }> | { status: number; body: T }
}): Promise<{ status: number; body: T & { replayed?: boolean } }> {
  const opId = params.operationId?.trim()
  if (!opId) {
    return params.execute()
  }

  const actor = params.actorEmail.trim().toLowerCase()
  const reqHash = hashOperationPayload({ kind: params.kind, payload: params.requestPayload })
  const cacheKey = keyOf(actor, opId)

  return runExclusive(`idem:${cacheKey}`, async () => {
    await syncIfStale()
    const existing = records.get(cacheKey) ?? (await lookupDb(actor, opId))
    if (existing) {
      records.set(cacheKey, existing)
      if (existing.requestHash !== reqHash) {
        throw new ConflictError('Este operationId já foi utilizado com parâmetros diferentes.')
      }
      return {
        status: existing.status,
        body: { ...(existing.body as T), replayed: true },
      }
    }

    const result = await params.execute()
    if (result.status >= 200 && result.status < 300) {
      const stored: StoredIdempotentOp = {
        actorEmail: actor,
        operationId: opId,
        kind: params.kind,
        requestHash: reqHash,
        status: result.status,
        body: result.body,
        createdAt: new Date().toISOString(),
      }
      const { conflictWithExisting } = await insertDb(stored)
      if (conflictWithExisting) {
        const concurrent = await lookupDb(actor, opId)
        if (concurrent) {
          records.set(cacheKey, concurrent)
          if (concurrent.requestHash !== reqHash) {
            throw new ConflictError('Este operationId já foi utilizado com parâmetros diferentes.')
          }
          return {
            status: concurrent.status,
            body: { ...(concurrent.body as T), replayed: true },
          }
        }
      }
      const prev = new Map(records)
      records.set(cacheKey, stored)
      try {
        const list = [...records.values()].slice(-MAX_MEM)
        await commitDocument(DOC_ID, list)
      } catch (err) {
        records.clear()
        for (const [k, v] of prev) records.set(k, v)
        throw err
      }
    }
    return result
  })
}
