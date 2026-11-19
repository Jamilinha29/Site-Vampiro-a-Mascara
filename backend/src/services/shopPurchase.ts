import { documentWeight, loadDocument, rememberDocument } from './campaignDocuments.js'
import { getEntity, listScheduledSessions } from './chronicleStore.js'
import { creditCoins, debitCoins, entityPrice, shopLevelOf } from './courtStore.js'
import { grantEntityToCharacter } from './itemGrant.js'
import { getCharacter } from './profileStore.js'
import { consumeOwnedItem, purchaseItem } from './shopStore.js'

type PurchaseBody = {
  remaining: number | null
  ownedByYou: number
  itemName: string
  replayed?: boolean
}

type ErrorBody = { error: { message: string } }

type StoredOp = {
  key: string
  email: string
  status: number
  body: PurchaseBody
}

const operations: StoredOp[] = []
let chain: Promise<void> = Promise.resolve()

export async function hydrateShopOperations() {
  const doc = await loadDocument<StoredOp[]>('shop-ops')
  if (!doc || documentWeight(doc.body) === 0) return
  operations.splice(0, operations.length, ...doc.body.slice(-200))
}

function rememberOperations() {
  rememberDocument('shop-ops', operations.slice(-200))
}

export function openSeatsFor(email: string) {
  const key = email.trim().toLowerCase()
  const found: { sessionId: string; characterId: string }[] = []
  for (const session of listScheduledSessions()) {
    if (session.status !== 'open') continue
    const seat = (session.seats ?? []).find((item) => item.email.toLowerCase() === key && !item.leftAt)
    if (seat?.characterId) found.push({ sessionId: session.id, characterId: seat.characterId })
  }
  return found
}

function fail(message: string): { status: 400; body: ErrorBody } {
  return { status: 400, body: { error: { message } } }
}

export function buyAtTable(input: {
  email: string
  entityId: string
  quantity: number
  sessionId?: string
  characterId?: string
  operationId?: string
}): { status: number; body: PurchaseBody | ErrorBody } {
  const email = input.email.trim()
  const operationId = input.operationId?.trim()
  if (operationId) {
    const prior = operations.find((op) => op.email === email.toLowerCase() && op.key === operationId)
    if (prior) return { status: prior.status, body: { ...prior.body, replayed: true } }
  }

  const seats = openSeatsFor(email.toLowerCase())
  const seat = input.sessionId
    ? seats.find((item) => item.sessionId === input.sessionId)
    : seats.length === 1
      ? seats[0]
      : undefined
  if (!seat) {
    if (!input.sessionId && seats.length > 1) {
      return fail('Há mais de uma mesa aberta. Compre pelo ferreiro da mesa.')
    }
    return fail('A compra só vale com a mesa aberta e você sentado.')
  }
  if (input.characterId && input.characterId !== seat.characterId) {
    return fail('O item entra só no personagem sentado nesta mesa.')
  }

  const character = getCharacter(email, seat.characterId)
  if (!character) return fail('O personagem sentado não está nesta conta.')

  const entity = getEntity(input.entityId)
  if (!entity || entity.visibility !== 'published') return fail('Item indisponível')

  const required = shopLevelOf(entity)
  if ((character.level ?? 1) < required) {
    return fail(`Nível ${required} necessário para comprar este item`)
  }

  const price = entityPrice(entity)
  const total = price.amount * input.quantity
  if (total > 0) {
    const paid = debitCoins(email, price.coin, total, `Compra · ${entity.name}`)
    if (!paid.ok) return fail(paid.error)
  }

  const result = purchaseItem(email, input.entityId, input.quantity)
  if (!result.ok) {
    if (total > 0) creditCoins(email, price.coin, total, `Estorno · ${entity.name}`)
    return fail(result.error)
  }

  const delivered = grantEntityToCharacter(email, seat.characterId, result.entity, input.quantity)
  if (!delivered) {
    consumeOwnedItem(email, input.entityId, input.quantity)
    if (total > 0) creditCoins(email, price.coin, total, `Estorno · ${entity.name}`)
    return fail('Não foi possível entregar o item. Nada foi cobrado.')
  }

  const body: PurchaseBody = {
    remaining: result.remaining,
    ownedByYou: result.owned,
    itemName: result.entity.name,
  }
  if (operationId) {
    operations.push({ key: operationId, email: email.toLowerCase(), status: 200, body })
    if (operations.length > 200) operations.splice(0, operations.length - 200)
    rememberOperations()
  }
  return { status: 200, body }
}

export function buyAtTableQueued(
  input: Parameters<typeof buyAtTable>[0],
): Promise<{ status: number; body: PurchaseBody | ErrorBody }> {
  const run = chain.then(
    () => buyAtTable(input),
    () => buyAtTable(input),
  )
  chain = run.then(
    () => undefined,
    () => undefined,
  )
  return run
}
