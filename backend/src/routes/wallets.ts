import { Router } from 'express'
import { z } from 'zod'
import { requireUser } from '../middlewares/optionalUser.js'
import { getPurchaseCount, purchaseItem, remainingStock } from '../services/shopStore.js'
import { upsertCharacter, getCharacter, listCharacters } from '../services/profileStore.js'
import { randomUUID } from 'crypto'

export const walletsRouter = Router()

walletsRouter.get('/active', (_req, res) => {
  res.json({ gold: 2, silver: 12, copper: 40 })
})

walletsRouter.get('/ledger', (_req, res) => {
  const now = Date.now()
  res.json([
    {
      id: 'l1',
      kind: 'credit',
      label: 'Pagamento da corte — missão concluída',
      amount: '+3 ouro',
      at: new Date(now - 1000 * 60 * 60 * 26).toISOString(),
    },
    {
      id: 'l2',
      kind: 'debit',
      label: 'Compra na loja — elixir de vigor',
      amount: '−2 prata',
      at: new Date(now - 1000 * 60 * 60 * 8).toISOString(),
    },
    {
      id: 'l3',
      kind: 'credit',
      label: 'Recebimento — dividenda do narrador',
      amount: '+5 bronze',
      at: new Date(now - 1000 * 60 * 60 * 2).toISOString(),
    },
  ])
})

walletsRouter.get('/shop-stock/:entityId', requireUser, (req, res) => {
  const entityId = req.params.entityId
  res.json({
    remaining: remainingStock(entityId),
    ownedByYou: getPurchaseCount(req.user!.email, entityId),
  })
})

const buySchema = z.object({
  entityId: z.string().min(1),
  characterId: z.string().min(1).optional(),
  quantity: z.number().int().min(1).max(20).default(1),
})

walletsRouter.post('/shop/buy', requireUser, (req, res, next) => {
  try {
    const body = buySchema.parse(req.body)
    const result = purchaseItem(req.user!.email, body.entityId, body.quantity)
    if (!result.ok) {
      res.status(400).json({ error: { message: result.error } })
      return
    }

    const characters = listCharacters(req.user!.email)
    const character =
      (body.characterId ? getCharacter(req.user!.email, body.characterId) : null) ??
      characters.find((c) => c.isPrimary) ??
      characters[0]

    if (character) {
      const inventory = [...(character.inventory ?? [])]
      for (let i = 0; i < body.quantity; i++) {
        inventory.push({
          id: randomUUID(),
          name: result.entity.name,
          description: result.entity.description,
          category:
            result.entity.consumableKind === 'food' || result.entity.shopCategory === 'consumables'
              ? 'elixir'
              : result.entity.shopCategory === 'gear'
                ? 'weapon'
                : 'other',
          rarity: result.entity.rarity ?? 'comum',
          weightKg: result.entity.weightKg ?? 0.5,
          equipped: false,
          statsLabel: (result.entity.attributeMods ?? [])
            .map((m) => `${m.value > 0 ? '+' : ''}${m.value} ${m.attr}`)
            .join(', '),
        })
      }
      upsertCharacter(req.user!.email, {
        ...character,
        inventory,
      })
    }

    res.json({
      remaining: result.remaining,
      ownedByYou: result.owned,
      itemName: result.entity.name,
    })
  } catch (e) {
    next(e)
  }
})
