import { randomUUID } from 'crypto'
import { documentWeight, loadDocument, rememberDocument } from './campaignDocuments.js'
import { recordOperation } from './operationLog.js'
import { sessionAccess } from './chronicleStore.js'

type RollRow = {
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

export function forgetRollsForSession(sessionId: string) {
  const next = rolls.filter((row) => row.sessionId !== sessionId)
  if (next.length === rolls.length) return
  rolls.splice(0, rolls.length, ...next)
  rememberDocument('rolls', rolls)
}

export async function hydrateRolls() {
  const doc = await loadDocument<RollRow[]>('rolls')
  if (!doc || documentWeight(doc.body) === 0) return
  rolls.splice(0, rolls.length, ...doc.body.slice(-400))
}

export function rollForSession(input: {
  email: string
  role?: string
  sessionId: string
  characterName: string
  formula: string
  secret?: boolean
}) {
  const access = sessionAccess(input.sessionId, { email: input.email, role: input.role })
  if (!access.ok) {
    throw new Error(access.reason === 'not_found' ? 'Mesa não encontrada' : 'Você não está nesta mesa.')
  }
  const match = /^(\d*)d(\d+)([+-]\d+)?$/i.exec(input.formula.trim())
  if (!match) throw new Error('Rolagem inválida. Use 1d10 ou 2d6+1.')
  const count = Math.min(20, Math.max(1, Number(match[1] || 1)))
  const sides = Number(match[2])
  if (![4, 6, 8, 10, 12, 20, 100].includes(sides)) throw new Error('Rolagem inválida. O dado precisa ser d4, d6, d8, d10, d12, d20 ou d100.')
  const modifier = Number(match[3] || 0)
  const dice = Array.from({ length: count }, () => 1 + Math.floor(Math.random() * sides))
  const total = dice.reduce((sum, face) => sum + face, 0) + modifier
  const secret = Boolean(input.secret) && (input.role === 'narrator' || input.role === 'admin')
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
  rolls.push(row)
  if (rolls.length > 400) rolls.splice(0, rolls.length - 400)
  rememberDocument('rolls', rolls.slice(-400))
  recordOperation({
    email: input.email,
    actorEmail: input.email,
    kind: 'roll',
    sessionId: input.sessionId,
    summary: secret ? 'Rolagem secreta' : `${row.characterName}: ${row.formula} = ${row.total}`,
  })
  return row
}

export function listRolls(sessionId: string, viewer: { email: string; role?: string }) {
  const access = sessionAccess(sessionId, viewer)
  if (!access.ok) return []
  const staff = viewer.role === 'narrator' || viewer.role === 'admin'
  return rolls
    .filter((row) => row.sessionId === sessionId)
    .filter((row) => !row.secret || staff || row.email.toLowerCase() === viewer.email.toLowerCase())
    .slice(-40)
    .map((row) => (row.secret && !staff && row.email.toLowerCase() !== viewer.email.toLowerCase() ? { ...row, dice: [], total: 0 } : row))
}
