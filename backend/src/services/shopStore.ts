import { getEntity } from './chronicleStore.js'

/** Compras por e-mail do jogador → entityId → quantidade. */
const purchases = new Map<string, Map<string, number>>()

function bag(email: string) {
  if (!purchases.has(email)) purchases.set(email, new Map())
  return purchases.get(email)!
}

export function getPurchaseCount(email: string, entityId: string) {
  return bag(email).get(entityId) ?? 0
}

export function totalSold(entityId: string) {
  let sum = 0
  for (const userBag of purchases.values()) {
    sum += userBag.get(entityId) ?? 0
  }
  return sum
}

export function remainingStock(entityId: string) {
  const entity = getEntity(entityId)
  if (!entity) return null
  const total = entity.stockTotal
  if (total == null) return null
  return Math.max(0, total - totalSold(entityId))
}

export function purchaseItem(email: string, entityId: string, qty = 1) {
  const entity = getEntity(entityId)
  if (!entity || entity.visibility !== 'published') {
    return { ok: false as const, error: 'Item indisponível' }
  }
  const remaining = remainingStock(entityId)
  if (remaining != null && remaining < qty) {
    return { ok: false as const, error: 'Estoque esgotado nesta loja' }
  }
  const userBag = bag(email)
  userBag.set(entityId, (userBag.get(entityId) ?? 0) + qty)
  return {
    ok: true as const,
    owned: userBag.get(entityId)!,
    remaining: remainingStock(entityId),
    entity,
  }
}

export function consumeOwnedItem(email: string, entityId: string, qty = 1) {
  const userBag = bag(email)
  const owned = userBag.get(entityId) ?? 0
  if (owned < qty) return { ok: false as const, error: 'Você não possui unidades suficientes' }
  const next = owned - qty
  if (next <= 0) userBag.delete(entityId)
  else userBag.set(entityId, next)
  return { ok: true as const, owned: Math.max(0, next) }
}
