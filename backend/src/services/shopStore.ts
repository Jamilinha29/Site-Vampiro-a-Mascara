import {
  checkRemoteDocumentRevision,
  commitDocument,
  documentWeight,
  getLoadedDocumentRevision,
  loadDocument,
  runExclusive,
} from './campaignDocuments.js'
import { getEntity } from './chronicleStore.js'

/** Compras atuais em posse por e-mail normalizado do jogador -> entityId -> quantidade. */
const purchases = new Map<string, Map<string, number>>()
/** Total cumulativo vendido por entityId (não reduz quando o jogador consome o item). */
const soldCounts = new Map<string, number>()
const DOC_ID = 'shop'

type ShopSerialized = {
  __v: 2
  purchases: Record<string, Record<string, number>>
  soldCounts: Record<string, number>
}

function keyOf(email: string) {
  return email.trim().toLowerCase()
}

function serializeShop(): ShopSerialized {
  const byUser: Record<string, Record<string, number>> = {}
  for (const [email, items] of purchases) byUser[email] = Object.fromEntries(items)
  return {
    __v: 2,
    purchases: byUser,
    soldCounts: Object.fromEntries(soldCounts),
  }
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

function applyShopPayload(raw: unknown) {
  purchases.clear()
  soldCounts.clear()
  if (!raw || typeof raw !== 'object') return
  const obj = raw as Record<string, unknown>
  if (obj.__v === 2 && obj.purchases && typeof obj.purchases === 'object') {
    for (const [email, items] of Object.entries(obj.purchases as Record<string, Record<string, number>>)) {
      const m = new Map<string, number>()
      for (const [eid, qty] of Object.entries(items ?? {})) {
        const n = Math.floor(Number(qty))
        if (Number.isFinite(n) && n > 0) m.set(eid, n)
      }
      purchases.set(keyOf(email), m)
    }
    if (obj.soldCounts && typeof obj.soldCounts === 'object') {
      for (const [eid, qty] of Object.entries(obj.soldCounts as Record<string, number>)) {
        const n = Math.floor(Number(qty))
        if (Number.isFinite(n) && n > 0) soldCounts.set(eid, n)
      }
    }
    return
  }
  // Formato legado: { [email]: { [entityId]: qty } }
  for (const [email, items] of Object.entries(obj as Record<string, Record<string, number>>)) {
    if (!items || typeof items !== 'object') continue
    const m = new Map<string, number>()
    for (const [eid, qty] of Object.entries(items)) {
      const n = Math.floor(Number(qty))
      if (Number.isFinite(n) && n > 0) {
        m.set(eid, n)
        soldCounts.set(eid, (soldCounts.get(eid) ?? 0) + n)
      }
    }
    purchases.set(keyOf(email), m)
  }
}

export async function hydrateShop() {
  const doc = await loadDocument<Record<string, unknown>>(DOC_ID)
  if (!doc || documentWeight(doc.body) === 0) return
  applyShopPayload(doc.body)
}

export function resetShopForTests() {
  purchases.clear()
  soldCounts.clear()
}

export function snapshotShopState(): ShopSerialized {
  return serializeShop()
}

export function restoreShopSnapshot(snapshot: ShopSerialized | Record<string, Record<string, number>>) {
  applyShopPayload(snapshot)
}

export async function restoreShopSnapshotDurable(snapshot: ShopSerialized | Record<string, Record<string, number>>) {
  return runExclusive('store:shop', async () => {
    applyShopPayload(snapshot)
    await commitShop()
  })
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
  return soldCounts.get(entityId) ?? 0
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
    soldCounts.set(entityId, (soldCounts.get(entityId) ?? 0) + quantity)
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
    const quantity = Math.floor(qty)
    if (!Number.isFinite(quantity) || quantity < 1) {
      return { ok: false as const, error: 'Quantidade inválida' }
    }
    const userBag = bag(email)
    const owned = userBag.get(entityId) ?? 0
    if (owned < quantity) return { ok: false as const, error: 'Você não possui unidades suficientes' }
    const backup = snapshotShopState()
    const next = owned - quantity
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
