import { randomInt, randomUUID } from 'node:crypto'
import {
  checkRemoteDocumentRevision,
  commitDocument,
  documentWeight,
  getLoadedDocumentRevision,
  loadDocument,
  runExclusive,
} from './campaignDocuments.js'
import { recordOperationStrict } from './operationLog.js'
import { isSessionManager, sessionAccess } from './chronicleStore.js'
import { ForbiddenError, NotFoundError, ValidationError } from './errors.js'

export type RollRow = {
  id: string
  at: string
  email: string
  sessionId: string
  characterName: string
  formula: string
  dice: number[]
  modifier: number
  total: number
  secret: boolean
}

const rolls: RollRow[] = []

async function syncRollsIfStale() {
  const remoteRev = await checkRemoteDocumentRevision('rolls')
  if (remoteRev > getLoadedDocumentRevision('rolls')) {
    await hydrateRolls()
  }
}

export async function forgetRollsForSession(sessionId: string) {
  return runExclusive('store:rolls', async () => {
    await syncRollsIfStale()
    const next = rolls.filter((row) => row.sessionId !== sessionId)
    if (next.length === rolls.length) return
    const backup = [...rolls]
    rolls.splice(0, rolls.length, ...next)
    try {
      await commitDocument('rolls', rolls)
    } catch (err) {
      rolls.splice(0, rolls.length, ...backup)
      throw err
    }
  })
}

export async function hydrateRolls() {
  const doc = await loadDocument<RollRow[]>('rolls')
  if (!doc || documentWeight(doc.body) === 0) return
  rolls.splice(0, rolls.length, ...doc.body.slice(-400))
}

export function resetRollsForTests() {
  rolls.length = 0
}

export async function rollForSession(input: {
  email: string
  role?: string
  sessionId: string
  characterName: string
  formula: string
  secret?: boolean
}) {
  const access = sessionAccess(input.sessionId, { email: input.email, role: input.role })
  if (!access.ok) {
    if (access.reason === 'not_found') throw new NotFoundError('Mesa não encontrada')
    throw new ForbiddenError('Você não está nesta mesa.')
  }
  const match = /^(\d*)d(\d+)([+-]\d+)?$/i.exec(input.formula.trim())
  if (!match) throw new ValidationError('Rolagem inválida. Use 1d10 ou 2d6+1.')
  const rawCount = match[1] ? Number(match[1]) : 1
  if (!Number.isInteger(rawCount) || rawCount < 1 || rawCount > 20) {
    throw new ValidationError('Rolagem inválida. Use entre 1 e 20 dados.')
  }
  const count = rawCount
  const sides = Number(match[2])
  if (![4, 6, 8, 10, 12, 20, 100].includes(sides)) {
    throw new ValidationError('Rolagem inválida. O dado precisa ser d4, d6, d8, d10, d12, d20 ou d100.')
  }
  const modifier = Number(match[3] || 0)
  if (!Number.isSafeInteger(modifier) || Math.abs(modifier) > 1000) {
    throw new ValidationError('Modificador inválido. Use um valor entre -1000 e +1000.')
  }
  const dice = Array.from({ length: count }, () => randomInt(1, sides + 1))
  const total = dice.reduce((sum, face) => sum + face, 0) + modifier
  const manager = isSessionManager(input.sessionId, { email: input.email, role: input.role })
  const secret = Boolean(input.secret) && manager
  const row: RollRow = {
    id: randomUUID(),
    at: new Date().toISOString(),
    email: input.email,
    sessionId: input.sessionId,
    characterName: input.characterName.trim() || input.email,
    formula: `${count}d${sides}${modifier ? (modifier > 0 ? `+${modifier}` : String(modifier)) : ''}`,
    dice,
    modifier,
    total,
    secret,
  }
  return runExclusive('store:rolls', async () => {
    await syncRollsIfStale()
    const backup = [...rolls]
    rolls.push(row)
    if (rolls.length > 400) rolls.splice(0, rolls.length - 400)
    try {
      await commitDocument('rolls', rolls.slice(-400))
      await recordOperationStrict({
        email: input.email,
        actorEmail: input.email,
        kind: 'roll',
        sessionId: input.sessionId,
        summary: secret ? 'Rolagem secreta' : `${row.characterName}: ${row.formula} = ${row.total}`,
      })
      return row
    } catch (err) {
      rolls.splice(0, rolls.length, ...backup)
      throw err
    }
  })
}

export function listRolls(sessionId: string, viewer: { email: string; role?: string }) {
  const access = sessionAccess(sessionId, viewer)
  if (!access.ok) return null
  const manager = isSessionManager(sessionId, viewer)
  return rolls
    .filter((row) => row.sessionId === sessionId)
    .filter((row) => !row.secret || manager || row.email.toLowerCase() === viewer.email.toLowerCase())
    .slice(-40)
    .map(({ email: _email, ...rest }) => rest)
}
