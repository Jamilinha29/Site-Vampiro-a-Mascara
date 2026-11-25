import {
  checkRemoteDocumentRevision,
  commitDocument,
  documentWeight,
  getLoadedDocumentRevision,
  loadDocument,
  runExclusive,
} from './campaignDocuments.js'
import { getEntity } from './chronicleStore.js'

/** Compras por e-mail normalizado do jogador -> entityId -> quantidade. */
const purchases = new Map<string, Map<string, number>>()
const DOC_ID = 'shop'

function keyOf(email: string) {
  return email.trim().toLowerCase()
}

function serializeShop() {
  const body: Record<string, Record<string, number>> = {}
  for (const [email, items] of purchases) body[email] = Object.fromEntries(items)
  return body
}

async function commitShop() {
  await commitDocument(DOC_ID, serializeShop())
}

export async function syncShopIfStale() {
  const remoteRev = await checkRemoteDocumentRevision(DOC_ID)
  if (remoteRev > getLoadedDocumentRevision(DOC_ID)) {
    await hydrateShop()
  }
}

export async function hydrateShop() {
  const doc = await loadDocument<Record<string, Record<string, number>>>(DOC_ID)
  if (!doc || documentWeight(doc.body) === 0) return
  purchases.clear()
  for (const [email, items] of Object.entries(doc.body)) {
    purchases.set(keyOf(email), new Map(Object.entries(items)))
  }
}

export function resetShopForTests() {
  purchases.clear()
}

export function snapshotShopState(): Record<string, Record<string, number>> {
  return serializeShop()
}

export function restoreShopSnapshot(snapshot: Record<string, Record<string, number>>) {
  purchases.clear()
  for (const [email, items] of Object.entries(snapshot)) {
    purchases.set(keyOf(email), new Map(Object.entries(items)))
  }
}

function bag(email: string) {
  const k = keyOf(email)
  if (!purchases.has(k)) purchases.set(k, new Map())
  return purchases.get(k)!
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

export async function purchaseItem(email: string, entityId: string, qty = 1) {
  return runExclusive('store:shop', async () => {
    await syncShopIfStale()
    const entity = getEntity(entityId)
    if (!entity || entity.visibility !== 'published') {
      return { ok: false as const, error: 'Item indisponível' }
    }
    const quantity = Math.floor(qty)
    if (!Number.isFinite(quantity) || quantity < 1) {
      return { ok: false as const, error: 'Quantidade inválida' }
    }
    const remaining = remainingStock(entityId)
    if (remaining != null && remaining < quantity) {
      return { ok: false as const, error: 'Estoque esgotado nesta loja' }
    }
    const backup = snapshotShopState()
    const userBag = bag(email)
    userBag.set(entityId, (userBag.get(entityId) ?? 0) + quantity)
    try {
      await commitShop()
    } catch (err) {
      restoreShopSnapshot(backup)
      throw err
    }
    return {
      ok: true as const,
      owned: userBag.get(entityId)!,
      remaining: remainingStock(entityId),
      entity,
    }
  })
}

export async function consumeOwnedItem(email: string, entityId: string, qty = 1) {
  return runExclusive('store:shop', async () => {
    await syncShopIfStale()
    const userBag = bag(email)
    const owned = userBag.get(entityId) ?? 0
    if (owned < qty) return { ok: false as const, error: 'Você não possui unidades suficientes' }
    const backup = snapshotShopState()
    const next = owned - qty
    if (next <= 0) userBag.delete(entityId)
    else userBag.set(entityId, next)
    try {
      await commitShop()
    } catch (err) {
      restoreShopSnapshot(backup)
      throw err
    }
    return { ok: true as const, owned: Math.max(0, next) }
  })
}
