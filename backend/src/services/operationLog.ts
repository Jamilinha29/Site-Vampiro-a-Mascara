import { randomUUID } from 'node:crypto'
import { commitDocument, documentWeight, loadDocument } from './campaignDocuments.js'
import { getSupabaseAdmin } from './supabaseClient.js'

export type OperationEntry = {
  id: string
  at: string
  email: string
  actorEmail: string
  kind: 'credit' | 'debit' | 'adjustment' | 'xp' | 'approval' | 'roll' | 'purchase' | 'restore' | 'backup' | 'action'
  summary: string
  sessionId?: string
  characterId?: string
  entityId?: string
  operationId?: string
  before?: string
  after?: string
}

const entries: OperationEntry[] = []
const MAX_MEM_ENTRIES = 1000

export async function hydrateOperations() {
  const doc = await loadDocument<OperationEntry[]>('operations')
  if (!doc || documentWeight(doc.body) === 0) return
  entries.splice(0, entries.length, ...doc.body.slice(-MAX_MEM_ENTRIES))
}

export function resetOperationsForTests() {
  entries.length = 0
}

export async function persistOperationsLog(entry: OperationEntry): Promise<void> {
  const sb = getSupabaseAdmin()
  if (sb && (process.env.NODE_ENV !== 'test' || process.env.BELADONA_TEST_USE_ENV === 'true')) {
    const { error } = await sb.from('AuditoriaOperacoes').insert({
      id: entry.id,
      created_at: entry.at,
      email: entry.email.trim().toLowerCase(),
      actor_email: entry.actorEmail.trim().toLowerCase(),
      kind: entry.kind,
      session_id: entry.sessionId ?? null,
      character_id: entry.characterId ?? null,
      entity_id: entry.entityId ?? null,
      operation_id: entry.operationId ?? null,
      summary: entry.summary,
      before_value: entry.before ?? null,
      after_value: entry.after ?? null,
      metadata: {},
    })
    if (error && !/AuditoriaOperacoes|schema cache|does not exist/i.test(error.message)) {
      console.warn('[audit] Falha ao registrar em AuditoriaOperacoes:', error.message)
    }
  }
  await commitDocument('operations', entries.slice(-MAX_MEM_ENTRIES))
}

export function recordOperation(input: Omit<OperationEntry, 'id' | 'at'> & { at?: string }): Promise<void> {
  const row: OperationEntry = {
    id: randomUUID(),
    at: input.at ?? new Date().toISOString(),
    email: input.email,
    actorEmail: input.actorEmail,
    kind: input.kind,
    summary: input.summary,
    sessionId: input.sessionId,
    characterId: input.characterId,
    entityId: input.entityId,
    operationId: input.operationId,
    before: input.before,
    after: input.after,
  }
  entries.push(row)
  if (entries.length > MAX_MEM_ENTRIES) entries.splice(0, entries.length - MAX_MEM_ENTRIES)
  return persistOperationsLog(row).catch((err) => {
    console.warn('[audit] Erro ao persistir trilha:', err instanceof Error ? err.message : err)
  })
}

export async function recordOperationStrict(
  input: Omit<OperationEntry, 'id' | 'at'> & { at?: string },
): Promise<OperationEntry> {
  const row: OperationEntry = {
    id: randomUUID(),
    at: input.at ?? new Date().toISOString(),
    email: input.email,
    actorEmail: input.actorEmail,
    kind: input.kind,
    summary: input.summary,
    sessionId: input.sessionId,
    characterId: input.characterId,
    entityId: input.entityId,
    operationId: input.operationId,
    before: input.before,
    after: input.after,
  }
  const previous = [...entries]
  entries.push(row)
  if (entries.length > MAX_MEM_ENTRIES) entries.splice(0, entries.length - MAX_MEM_ENTRIES)
  try {
    await persistOperationsLog(row)
    return row
  } catch (err) {
    entries.splice(0, entries.length, ...previous)
    throw err
  }
}

export function listOperationsFor(
  email: string,
  viewer: { email: string; role?: string },
  options?: { limit?: number; offset?: number },
) {
  const own = email.trim().toLowerCase()
  const isStaff = viewer.role === 'narrator' || viewer.role === 'admin'
  if (!isStaff && viewer.email.trim().toLowerCase() !== own) return []
  const limit = Math.min(200, Math.max(1, options?.limit ?? 80))
  const offset = Math.max(0, options?.offset ?? 0)
  return entries
    .filter((row) => row.email.toLowerCase() === own)
    .slice()
    .reverse()
    .slice(offset, offset + limit)
    .map((row) => ({
      ...row,
      grantedByNarrator: row.actorEmail.trim().toLowerCase() !== row.email.trim().toLowerCase(),
    }))
}

export function listOperationsForSession(
  sessionId: string,
  options?: { limit?: number; offset?: number },
) {
  const key = sessionId.trim()
  const limit = Math.min(200, Math.max(1, options?.limit ?? 120))
  const offset = Math.max(0, options?.offset ?? 0)
  return entries
    .filter((row) => row.sessionId === key)
    .slice()
    .reverse()
    .slice(offset, offset + limit)
    .map((row) => ({
      ...row,
      grantedByNarrator: row.actorEmail.trim().toLowerCase() !== row.email.trim().toLowerCase(),
    }))
}
