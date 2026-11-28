import { runExclusive } from './campaignDocuments.js'
import {
  ensureHandoutForScheduledSession,
  entityMatchesCatalogScope,
  getEntity,
  listScheduledSessions,
  resolveCatalogScopeForViewer,
} from './chronicleStore.js'
import {
  applyDebitInMemory,
  commitCourtState,
  entityPriceParts,
  hasWallet,
  restoreCourtSnapshot,
  shopLevelOf,
  snapshotCourtState,
  syncCourtIfStale,
} from './courtStore.js'
import { runIdempotent } from './idempotencyStore.js'
import { grantEntityToCharacter } from './itemGrant.js'
import { recordOperationStrict } from './operationLog.js'
import { getCharacter, getProfile, restoreSingleProfile } from './profileStore.js'
import { readRules } from './rulesState.js'
import {
  purchaseItem,
  remainingStock,
  restoreShopSnapshot,
  restoreShopSnapshotDurable,
  snapshotShopState,
  syncShopIfStale,
} from './shopStore.js'

export type PurchaseBody = {
  remaining: number | null
  ownedByYou: number
  itemName: string
  replayed?: boolean
}

export type ErrorBody = { error: { code: string; message: string } }

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

function fail(status: number, code: string, message: string): { status: number; body: ErrorBody } {
  return { status, body: { error: { code, message } } }
}

const COIN_TO_COPPER = { gold: 100, silver: 10, copper: 1 } as const

async function executeAtomicBuy(input: {
  email: string
  entityId: string
  quantity: number
  sessionId?: string
  characterId?: string
}): Promise<{ status: number; body: PurchaseBody | ErrorBody }> {
  const email = input.email.trim()
  const quantity = Math.floor(input.quantity)
  if (!Number.isFinite(quantity) || quantity < 1 || quantity > 20) {
    return fail(400, 'VALIDATION_ERROR', 'Quantidade inválida.')
  }

  await Promise.all([syncCourtIfStale(), syncShopIfStale()])

  const seats = openSeatsFor(email.toLowerCase())
  const seat = input.sessionId
    ? seats.find((item) => item.sessionId === input.sessionId)
    : seats.length === 1
      ? seats[0]
      : undefined

  if (!seat) {
    if (!input.sessionId && seats.length > 1) {
      return fail(409, 'AMBIGUOUS_SESSION', 'Há mais de uma mesa aberta. Compre pelo ferreiro da mesa.')
    }
    return fail(403, 'NOT_SEATED', 'A compra só vale com a mesa aberta e você sentado.')
  }
  if (input.characterId && input.characterId !== seat.characterId) {
    return fail(403, 'WRONG_CHARACTER', 'O item entra só no personagem sentado nesta mesa.')
  }

  const handout = await ensureHandoutForScheduledSession(seat.sessionId)
  if (handout?.restMode) {
    return fail(409, 'REST_MODE_ACTIVE', 'Mesa em modo descanso — feira restrita.')
  }

  const character = getCharacter(email, seat.characterId)
  if (!character) return fail(404, 'NOT_FOUND', 'O personagem sentado não está nesta conta.')

  const entity = getEntity(input.entityId)
  if (!entity || entity.visibility !== 'published' || (entity.kind !== 'equipment' && entity.kind !== 'consumable')) {
    return fail(404, 'ITEM_UNAVAILABLE', 'Item indisponível')
  }

  const contexts = resolveCatalogScopeForViewer(email, seat.sessionId)
  if (!entityMatchesCatalogScope(entity, contexts)) {
    return fail(403, 'ITEM_WRONG_TABLE', 'Este item só está disponível na mesa ativa correspondente.')
  }

  const required = shopLevelOf(entity)
  if ((character.level ?? 0) < required) {
    return fail(403, 'LEVEL_TOO_LOW', `Nível ${required} necessário para comprar este item`)
  }

  const stock = remainingStock(input.entityId)
  if (stock != null && stock < quantity) {
    return fail(409, 'OUT_OF_STOCK', 'Estoque esgotado nesta loja')
  }

  const parts = entityPriceParts(entity).map((part) => ({ ...part, amount: part.amount * quantity }))
  const totalCopper = parts.reduce((sum, p) => sum + p.amount * COIN_TO_COPPER[p.coin], 0)

  const rules = readRules()
  if (rules.shopBudgetCopper > 0 && totalCopper > rules.shopBudgetCopper) {
    return fail(400, 'OVER_BUDGET', 'Valor acima do teto financeiro configurado pela crônica.')
  }

  // Regra financeira (C05 / T11): se o item tem preço > 0, exige carteira existente e saldo suficiente antes de mutar qualquer dado.
  if (totalCopper > 0) {
    if (!hasWallet(email)) {
      return fail(409, 'WALLET_REQUIRED', 'Carteira ainda não iniciada para esta conta nesta crônica.')
    }
  }

  const courtBackup = snapshotCourtState()
  const shopBackup = snapshotShopState()
  const profileBackup = getProfile(email) ? (JSON.parse(JSON.stringify(getProfile(email))) as NonNullable<ReturnType<typeof getProfile>>) : null
  let shopCommitted = false
  let profileDelivered = false

  try {
    // 1) Pré-valida e debita moedas em memória
    for (const part of parts) {
      const paid = applyDebitInMemory(email, part.coin, part.amount, `Compra · ${entity.name}`)
      if (!paid.ok) {
        restoreCourtSnapshot(courtBackup)
        return fail(400, 'INSUFFICIENT_FUNDS', paid.error)
      }
    }

    // 2) Atualiza estoque e entrega item
    const result = await purchaseItem(email, input.entityId, quantity)
    if (!result.ok) {
      restoreCourtSnapshot(courtBackup)
      restoreShopSnapshot(shopBackup)
      return fail(409, 'OUT_OF_STOCK', result.error)
    }
    shopCommitted = true

    const delivered = await grantEntityToCharacter(email, seat.characterId, result.entity, quantity)
    if (!delivered) {
      restoreCourtSnapshot(courtBackup)
      await restoreShopSnapshotDurable(shopBackup).catch(() => restoreShopSnapshot(shopBackup))
      return fail(500, 'DELIVERY_FAILED', 'Não foi possível entregar o item. Nada foi cobrado.')
    }
    profileDelivered = true

    // 3) Consolida carteira/extrato e trilha de auditoria no banco
    if (totalCopper > 0) {
      await commitCourtState()
    }
    await recordOperationStrict({
      email,
      actorEmail: email,
      kind: 'purchase',
      summary: `Compra · ${entity.name} (x${quantity})`,
      sessionId: seat.sessionId,
      characterId: seat.characterId,
      entityId: entity.id,
      after: String(result.owned),
    })

    return {
      status: 200,
      body: {
        remaining: result.remaining,
        ownedByYou: result.owned,
        itemName: result.entity.name,
      },
    }
  } catch (err) {
    restoreCourtSnapshot(courtBackup)
    if (shopCommitted) {
      await restoreShopSnapshotDurable(shopBackup).catch(() => restoreShopSnapshot(shopBackup))
    } else {
      restoreShopSnapshot(shopBackup)
    }
    if (profileDelivered && profileBackup) {
      await restoreSingleProfile(profileBackup).catch(() => undefined)
    }
    throw err
  }
}

export async function buyAtTable(input: {
  email: string
  entityId: string
  quantity: number
  sessionId?: string
  characterId?: string
  operationId?: string
}): Promise<{ status: number; body: PurchaseBody | ErrorBody }> {
  return runExclusive('shop:transaction', () =>
    runIdempotent({
      actorEmail: input.email,
      operationId: input.operationId,
      kind: 'shop_buy',
      requestPayload: {
        entityId: input.entityId,
        quantity: input.quantity,
        sessionId: input.sessionId ?? null,
        characterId: input.characterId ?? null,
      },
      execute: () => executeAtomicBuy(input),
    }),
  )
}

export const buyAtTableQueued = buyAtTable
