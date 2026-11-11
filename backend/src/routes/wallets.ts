import { Router } from 'express'
import { z } from 'zod'
import { requireUser } from '../middlewares/optionalUser.js'
import { getPurchaseCount, purchaseItem, remainingStock } from '../services/shopStore.js'
import { upsertCharacter, getCharacter, listCharacters } from '../services/profileStore.js'
import { getSupabaseAdmin } from '../services/supabaseClient.js'
import { randomUUID } from 'crypto'

export const walletsRouter = Router()

const emptyWallet = { gold: 0, silver: 0, copper: 0 }

async function profileIdForEmail(email: string) {
  const sb = getSupabaseAdmin()
  if (!sb) return null
  const { data, error } = await sb.from('player_profiles').select('id').eq('email', email).maybeSingle()
  if (error || !data?.id) return null
  return data.id as string
}

walletsRouter.get('/active', requireUser, async (req, res) => {
  const profileId = await profileIdForEmail(req.user!.email)
  const sb = getSupabaseAdmin()
  if (!sb || !profileId) {
    res.json(emptyWallet)
    return
  }
  const { data, error } = await sb
    .from('wallets')
    .select('gold, silver, copper')
    .eq('profile_id', profileId)
    .maybeSingle()
  if (error || !data) {
    res.json(emptyWallet)
    return
  }
  res.json({
    gold: data.gold ?? 0,
    silver: data.silver ?? 0,
    copper: data.copper ?? 0,
  })
})

walletsRouter.get('/ledger', requireUser, async (req, res) => {
  const profileId = await profileIdForEmail(req.user!.email)
  const sb = getSupabaseAdmin()
  if (!sb || !profileId) {
    res.json([])
    return
  }
  const { data, error } = await sb
    .from('wallet_ledger')
    .select('id, kind, label, amount_label, created_at')
    .eq('profile_id', profileId)
    .order('created_at', { ascending: false })
    .limit(50)
  if (error || !data) {
    res.json([])
    return
  }
  res.json(
    data.map((row) => ({
      id: row.id,
      kind: row.kind,
      label: row.label,
      amount: row.amount_label,
      at: row.created_at,
    })),
  )
})

walletsRouter.get('/shop-stock/:entityId', requireUser, (req, res) => {
  const raw = req.params.entityId
  const entityId = typeof raw === 'string' ? raw : (raw[0] ?? '')
  if (!entityId) {
    res.status(400).json({ error: { message: 'entityId inválido' } })
    return
  }
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
