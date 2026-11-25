import { describe, expect, it, vi } from 'vitest'

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

import { createScheduledSession, updateScheduledSession } from '../../backend/src/services/chronicleStore.js'
import { creditCoins, getCourtWallet } from '../../backend/src/services/courtStore.js'
import { getCharacter, upsertCharacter } from '../../backend/src/services/profileStore.js'
import { buyAtTable } from '../../backend/src/services/shopPurchase.js'

const email = 'comprador.etapa4@ci.local'

describe('compra na mesa', () => {
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
})
