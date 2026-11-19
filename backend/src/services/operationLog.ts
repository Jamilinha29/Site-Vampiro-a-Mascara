import { randomUUID } from 'crypto'
import { documentWeight, loadDocument, rememberDocument } from './campaignDocuments.js'

export type OperationEntry = {
  id: string
  at: string
  email: string
  actorEmail: string
  kind: 'credit' | 'debit' | 'adjustment' | 'xp' | 'approval' | 'roll'
  summary: string
  sessionId?: string
  before?: string
  after?: string
}

const entries: OperationEntry[] = []

export async function hydrateOperations() {
  const doc = await loadDocument<OperationEntry[]>('operations')
  if (!doc || documentWeight(doc.body) === 0) return
  entries.splice(0, entries.length, ...doc.body.slice(-500))
}

export function recordOperation(input: Omit<OperationEntry, 'id' | 'at'> & { at?: string }) {
  entries.push({
    id: randomUUID(),
    at: input.at ?? new Date().toISOString(),
    email: input.email,
    actorEmail: input.actorEmail,
    kind: input.kind,
    summary: input.summary,
    sessionId: input.sessionId,
    before: input.before,
    after: input.after,
  })
  if (entries.length > 500) entries.splice(0, entries.length - 500)
  rememberDocument('operations', entries.slice(-500))
}

export function listOperationsFor(email: string, viewer: { email: string; role?: string }) {
  const own = email.trim().toLowerCase()
  const isStaff = viewer.role === 'narrator' || viewer.role === 'admin'
  if (!isStaff && viewer.email.trim().toLowerCase() !== own) return []
  return entries
    .filter((row) => row.email.toLowerCase() === own)
    .slice(-80)
    .reverse()
    .map((row) => ({
      ...row,
      grantedByNarrator: row.actorEmail.trim().toLowerCase() !== row.email.trim().toLowerCase(),
    }))
}

export function listOperationsForSession(sessionId: string) {
  const key = sessionId.trim()
  return entries
    .filter((row) => row.sessionId === key)
    .slice(-120)
    .reverse()
    .map((row) => ({
      ...row,
      grantedByNarrator: row.actorEmail.trim().toLowerCase() !== row.email.trim().toLowerCase(),
    }))
}
