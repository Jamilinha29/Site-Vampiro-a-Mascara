import { beforeEach, describe, expect, it, vi } from 'vitest'

const { item } = vi.hoisted(() => ({
  item: {
    id: 'item-teste-compra',
    kind: 'equipment' as const,
    name: 'Adaga de teste',
    description: 'teste',
    visibility: 'published' as const,
    shopCategory: 'gear' as const,
    rarity: 'comum' as const,
    priceGold: 0,
    priceSilver: 2,
    priceCopper: 0,
    stockTotal: 1,
    createdAt: '2026-11-18T00:00:00.000Z',
    updatedAt: '2026-11-18T00:00:00.000Z',
  },
}))

vi.mock('../../backend/src/services/chronicleStore.js', async () => {
  const actual = await vi.importActual<typeof import('../../backend/src/services/chronicleStore.js')>(
    '../../backend/src/services/chronicleStore.js',
  )
  return {
    ...actual,
    getEntity: (id: string) => (id === item.id ? item : actual.getEntity(id)),
  }
})

import {
  resetDocumentRevisionsForTests,
  setRemoteDocumentBackendForTests,
} from '../../backend/src/services/campaignDocuments.js'
import {
  createScheduledSession,
  resetEntitiesForTests,
  resetSessionsForTests,
  updateScheduledSession,
} from '../../backend/src/services/chronicleStore.js'
import { creditCoins, getCourtWallet, resetCourtForTests } from '../../backend/src/services/courtStore.js'
import { resetIdempotencyStoreForTests } from '../../backend/src/services/idempotencyStore.js'
import { resetOperationsForTests } from '../../backend/src/services/operationLog.js'
import {
  getCharacter,
  getProfile,
  resetProfilesForTests,
  restoreSingleProfile,
  upsertCharacter,
} from '../../backend/src/services/profileStore.js'
import { buyAtTable } from '../../backend/src/services/shopPurchase.js'
import {
  consumeOwnedItem,
  getPurchaseCount,
  remainingStock,
  resetShopForTests,
} from '../../backend/src/services/shopStore.js'

const email = 'comprador.etapa4@ci.local'

describe('compra na mesa', () => {
  beforeEach(() => {
    setRemoteDocumentBackendForTests(null)
    resetDocumentRevisionsForTests()
    resetIdempotencyStoreForTests()
    resetOperationsForTests()
    resetProfilesForTests()
    resetSessionsForTests()
    resetEntitiesForTests()
    resetCourtForTests()
    resetShopForTests()
  })
  it('cobra uma vez, entrega no personagem sentado e devolve a mesma resposta se a chave se repete', async () => {
    const character = await upsertCharacter(email, {
      name: 'Comprador',
      species: 'Vampiro',
      level: 1,
      isPrimary: true,
      hp: { current: 10, max: 10 },
    })
    await upsertCharacter(email, {
      id: 'outro-personagem',
      name: 'Outro',
      species: 'Vampiro',
      level: 1,
      isPrimary: false,
      hp: { current: 10, max: 10 },
    })
    const session = await createScheduledSession({
      title: 'Mesa de teste',
      scheduledAt: '2026-11-18T22:00:00.000Z',
    })
    await updateScheduledSession(session.id, {
      status: 'open',
      seats: [
        {
          email,
          displayName: 'Comprador',
          characterId: character.id,
          characterName: character.name,
          joinedAt: '2026-11-18T22:00:00.000Z',
        },
      ],
    })
    await creditCoins(email, 'silver', 5, 'Teste')

    const wrong = await buyAtTable({
      email,
      entityId: item.id,
      quantity: 1,
      sessionId: session.id,
      characterId: 'outro-personagem',
      operationId: 'op-personagem-errado',
    })
    expect(wrong.status).toBe(403)

    const first = await buyAtTable({
      email,
      entityId: item.id,
      quantity: 1,
      sessionId: session.id,
      characterId: character.id,
      operationId: 'op-compra-unica',
    })
    const again = await buyAtTable({
      email,
      entityId: item.id,
      quantity: 1,
      sessionId: session.id,
      characterId: character.id,
      operationId: 'op-compra-unica',
    })

    expect(first.status).toBe(200)
    expect(again.body).toMatchObject({ itemName: 'Adaga de teste', replayed: true })
    expect(getCourtWallet(email).silver).toBe(3)
    expect(getCharacter(email, character.id)?.inventory?.filter((row) => row.name === 'Adaga de teste')).toHaveLength(1)
  })

  it('consome item sem reabastecer estoque limitado e bloqueia quantidade inválida', async () => {
    const character = await upsertCharacter(email, {
      name: 'Comprador Estoque',
      species: 'Vampiro',
      level: 1,
      isPrimary: true,
      hp: { current: 10, max: 10 },
    })
    const session = await createScheduledSession({
      title: 'Mesa Estoque',
      scheduledAt: '2026-11-18T22:00:00.000Z',
    })
    await updateScheduledSession(session.id, {
      status: 'open',
      seats: [
        {
          email,
          displayName: 'Comprador Estoque',
          characterId: character.id,
          characterName: character.name,
          joinedAt: '2026-11-18T22:00:00.000Z',
        },
      ],
    })
    await creditCoins(email, 'silver', 10, 'Teste')

    const bought = await buyAtTable({
      email,
      entityId: item.id,
      quantity: 1,
      sessionId: session.id,
      characterId: character.id,
      operationId: 'op-estoque-1',
    })
    expect(bought.status).toBe(200)
    expect(remainingStock(item.id)).toBe(0)
    expect(getPurchaseCount(email, item.id)).toBe(1)

    await expect(consumeOwnedItem(email, item.id, -3)).resolves.toMatchObject({ ok: false })
    await expect(consumeOwnedItem(email, item.id, Number.NaN)).resolves.toMatchObject({ ok: false })

    const consumed = await consumeOwnedItem(email, item.id, 1)
    expect(consumed.ok).toBe(true)
    expect(getPurchaseCount(email, item.id)).toBe(0)
    expect(remainingStock(item.id)).toBe(0)

    const retry = await buyAtTable({
      email,
      entityId: item.id,
      quantity: 1,
      sessionId: session.id,
      characterId: character.id,
      operationId: 'op-estoque-2',
    })
    expect(retry.status).toBe(409)
  })

  it('restoreSingleProfile restaura apenas o jogador alvo sem apagar perfis de terceiros', async () => {
    const c1 = await upsertCharacter('alvo@ci.local', {
      name: 'Alvo',
      species: 'Vampiro',
      level: 1,
      isPrimary: true,
      hp: { current: 10, max: 10 },
    })
    const c2 = await upsertCharacter('terceiro@ci.local', {
      name: 'Terceiro Inocente',
      species: 'Mortal',
      level: 2,
      isPrimary: true,
      hp: { current: 15, max: 15 },
    })
    const snapshot = structuredClone(getProfile('alvo@ci.local')!)

    await upsertCharacter('alvo@ci.local', {
      name: 'Ficha Temporária',
      species: 'Vampiro',
      level: 1,
      isPrimary: false,
      hp: { current: 8, max: 8 },
    })
    expect(getProfile('alvo@ci.local')?.characters).toHaveLength(2)

    await restoreSingleProfile(snapshot)
    expect(getProfile('alvo@ci.local')?.characters).toHaveLength(1)
    expect(getProfile('alvo@ci.local')?.characters[0]?.id).toBe(c1.id)
    expect(getProfile('terceiro@ci.local')?.characters).toHaveLength(1)
    expect(getProfile('terceiro@ci.local')?.characters[0]?.id).toBe(c2.id)
  })
})
