import { Router } from 'express'
import { z } from 'zod'
import { requireUser } from '../middlewares/optionalUser.js'
import { requireNarrator } from '../middlewares/requireNarrator.js'
import {
  acceptFriend,
  addNpcBid,
  areFriends,
  closeAuction,
  COIN_LABEL,
  createAchievement,
  creditCoins,
  deleteAchievement,
  friendEmails,
  grantAchievement,
  shopLevelOf,
  listAchievements,
  listAuctions,
  listFriendCards,
  listPendingFor,
  listShopLevels,
  muralFor,
  narratorFriendDirectory,
  placeBid,
  releaseAuction,
  removeFriend,
  requestFriend,
  searchPlayers,
  setShopLevel,
  withdrawBid,
  type Coin,
} from '../services/courtStore.js'
import { getProfile as loadProfile, listCharacters } from '../services/profileStore.js'
import {
  ensureHandoutForScheduledSession,
  getEntity,
  entityMatchesCatalogScope,
  getScheduledSession,
  listEntities,
  listScheduledSessions,
  resolveCatalogScopeForViewer,
  updateHandout,
} from '../services/chronicleStore.js'

export const courtRouter = Router()
courtRouter.use(requireUser)

const coinSchema = z.enum(['gold', 'silver', 'copper'])

function playerLevel(email: string, characterId?: string) {
  const characters = listCharacters(email)
  const character =
    (characterId ? characters.find((c) => c.id === characterId) : null) ??
    characters.find((c) => c.isPrimary) ??
    characters[0]
  return character?.level ?? 1
}

courtRouter.get('/achievements', (req, res) => {
  res.json(muralFor(req.user!.email))
})

courtRouter.get('/friends', (req, res) => {
  res.json({
    friends: listFriendCards(req.user!.email),
    incoming: listPendingFor(req.user!.email),
  })
})

courtRouter.get('/players', (req, res) => {
  const q = typeof req.query.q === 'string' ? req.query.q : ''
  res.json(searchPlayers(q, req.user!.email))
})

courtRouter.post('/friends', (req, res, next) => {
  try {
    const body = z.object({ email: z.string().email() }).parse(req.body)
    const result = requestFriend(req.user!.email, body.email)
    if (!result.ok) {
      res.status(400).json({ error: { message: result.error } })
      return
    }
    res.status(201).json(result.link)
  } catch (e) {
    next(e)
  }
})

courtRouter.post('/friends/:linkId/accept', (req, res) => {
  const result = acceptFriend(req.user!.email, req.params.linkId)
  if (!result.ok) {
    res.status(400).json({ error: { message: result.error } })
    return
  }
  res.json(result.link)
})

courtRouter.delete('/friends/:id', (req, res) => {
  const removed = removeFriend(req.user!.email, req.params.id)
  if (!removed) {
    res.status(404).json({ error: { message: 'Amizade não encontrada' } })
    return
  }
  res.status(204).end()
})

courtRouter.get('/session-board', (req, res) => {
  const q = (typeof req.query.q === 'string' ? req.query.q : '').trim().toLowerCase()
  const me = req.user!.email
  const friends = new Set(friendEmails(me).map((e) => e.toLowerCase()))
  const rows = listScheduledSessions().filter((s) => s.status !== 'closed')
  const card = (s: (typeof rows)[number]) => {
    const narrator = s.narratorEmail ? loadProfile(s.narratorEmail) : null
    const seated = (s.seats ?? []).filter((seat) => !seat.leftAt)
    return {
      id: s.id,
      title: s.chronicleName ?? s.title,
      scheduledAt: s.scheduledAt,
      status: s.status,
      listing: s.listing ?? 'private',
      narratorName: narrator?.displayName ?? 'Narrador',
      seatedNames: seated.map((seat) => seat.displayName),
    }
  }
  const matches = (s: ReturnType<typeof card>) => {
    if (!q) return true
    const blob = [s.title, s.narratorName, ...s.seatedNames].join(' ').toLowerCase()
    return blob.includes(q)
  }
  const publicTables = rows
    .filter((s) => (s.listing ?? 'private') === 'public')
    .map(card)
    .filter(matches)
  const friendTables = rows
    .filter((s) => (s.listing ?? 'private') !== 'public')
    .filter((s) => {
      if (s.narratorEmail && friends.has(s.narratorEmail.toLowerCase())) return true
      return (s.seats ?? []).some((seat) => !seat.leftAt && friends.has(seat.email.toLowerCase()))
    })
    .map(card)
    .filter(matches)
  res.json({ publicTables, friendTables })
})

courtRouter.get('/sessions/:sessionId/ferreiro', (req, res) => {
  const session = getScheduledSession(req.params.sessionId)
  if (!session) {
    res.status(404).json({ error: { message: 'Mesa não encontrada' } })
    return
  }
  const characterId = typeof req.query.characterId === 'string' ? req.query.characterId : undefined
  const level = playerLevel(req.user!.email, characterId)
  const contexts = resolveCatalogScopeForViewer(req.user!.email, req.params.sessionId)
  const goods = listEntities({ visibility: 'published' }).filter(
    (e) =>
      (e.kind === 'equipment' || e.kind === 'consumable') &&
      (e.shopCategory === 'gear' || e.shopCategory === 'consumables') &&
      entityMatchesCatalogScope(e, contexts),
  )
  res.json({
    level,
    commerce: goods.map((item) => ({
      id: item.id,
      name: item.name,
      description: item.description,
      shopCategory: item.shopCategory,
      rarity: item.rarity ?? 'comum',
      priceGold: item.priceGold ?? 0,
      priceSilver: item.priceSilver ?? 0,
      priceCopper: item.priceCopper ?? 0,
      requiredLevel: shopLevelOf(item),
    })),
    auctions: listAuctions(req.params.sessionId),
  })
})

courtRouter.post('/auctions/:auctionId/bid', (req, res, next) => {
  try {
    const body = z
      .object({
        amount: z.number().int().min(1).max(100000),
        coin: coinSchema,
        characterId: z.string().optional(),
      })
      .parse(req.body)
    const result = placeBid({
      auctionId: req.params.auctionId,
      email: req.user!.email,
      displayName: req.user!.displayName,
      amount: body.amount,
      coin: body.coin,
      level: playerLevel(req.user!.email, body.characterId),
    })
    if (!result.ok) {
      res.status(400).json({ error: { message: result.error } })
      return
    }
    res.json(result.auction)
  } catch (e) {
    next(e)
  }
})

courtRouter.post('/auctions/:auctionId/withdraw', (req, res) => {
  const result = withdrawBid(req.params.auctionId, req.user!.email)
  if (!result.ok) {
    res.status(400).json({ error: { message: result.error } })
    return
  }
  res.json(result.auction)
})

const admin = Router()
admin.use(requireNarrator)

admin.get('/achievements', (_req, res) => {
  res.json(listAchievements())
})

admin.post('/achievements', (req, res, next) => {
  try {
    const body = z
      .object({
        title: z.string().min(2).max(80),
        description: z.string().max(400).default(''),
        howToEarn: z.string().min(4).max(400),
      })
      .parse(req.body)
    res.status(201).json(createAchievement(body))
  } catch (e) {
    next(e)
  }
})

admin.delete('/achievements/:id', (req, res) => {
  if (!deleteAchievement(req.params.id)) {
    res.status(404).json({ error: { message: 'Conquista não encontrada' } })
    return
  }
  res.status(204).end()
})

admin.post('/achievements/:id/grant', (req, res, next) => {
  try {
    const body = z.object({ email: z.string().email() }).parse(req.body)
    if (!areFriends(req.user!.email, body.email)) {
      res.status(403).json({ error: { message: 'Só é possível marcar conquista de um jogador amigo' } })
      return
    }
    const result = grantAchievement(body.email, req.params.id, req.user!.email)
    if (!result.ok) {
      res.status(404).json({ error: { message: result.error } })
      return
    }
    res.json(result.unlock)
  } catch (e) {
    next(e)
  }
})

admin.get('/players', (req, res) => {
  res.json(narratorFriendDirectory(req.user!.email))
})

admin.post('/friends', (req, res, next) => {
  try {
    const body = z.object({ email: z.string().email() }).parse(req.body)
    const result = requestFriend(req.user!.email, body.email)
    if (!result.ok) {
      res.status(400).json({ error: { message: result.error } })
      return
    }
    res.status(201).json(narratorFriendDirectory(req.user!.email))
  } catch (e) {
    next(e)
  }
})

admin.delete('/friends/:email', (req, res) => {
  const removed = removeFriend(req.user!.email, decodeURIComponent(req.params.email))
  if (!removed) {
    res.status(404).json({ error: { message: 'Amizade não encontrada' } })
    return
  }
  res.json(narratorFriendDirectory(req.user!.email))
})

admin.post('/grant-coins', (req, res, next) => {
  try {
    const body = z
      .object({
        sessionId: z.string().min(1),
        participantDisplayName: z.string().min(1),
        coin: coinSchema,
        amount: z.number().int().min(1).max(100000),
      })
      .parse(req.body)
    const session = getScheduledSession(body.sessionId)
    if (!session) {
      res.status(404).json({ error: { message: 'Sessão não encontrada' } })
      return
    }
    const seat =
      (session.seats ?? []).find(
        (s) => !s.leftAt && s.displayName.trim().toLowerCase() === body.participantDisplayName.trim().toLowerCase(),
      ) ?? null
    if (!seat) {
      res.status(404).json({ error: { message: 'Jogador sem assento na mesa.' } })
      return
    }
    const wallet = creditCoins(
      seat.email,
      body.coin as Coin,
      body.amount,
      `Mesa · ${session.chronicleName ?? session.title}`,
      { actorEmail: req.user!.email, sessionId: body.sessionId },
    )
    const handout = ensureHandoutForScheduledSession(body.sessionId)
    if (handout) {
      const label = `+${body.amount} ${COIN_LABEL[body.coin as Coin]}`
      const participants = handout.participants.map((p) => {
        if (p.displayName.trim().toLowerCase() !== body.participantDisplayName.trim().toLowerCase()) return p
        return { ...p, rewards: [...p.rewards, { type: 'currency' as const, label }] }
      })
      const has = participants.some(
        (p) => p.displayName.trim().toLowerCase() === body.participantDisplayName.trim().toLowerCase(),
      )
      updateHandout(handout.id, {
        participants: has
          ? participants
          : [
              ...participants,
              {
                displayName: seat.displayName,
                characterName: seat.characterName,
                rewards: [{ type: 'currency' as const, label }],
              },
            ],
      })
    }
    res.json({ wallet, displayName: seat.displayName })
  } catch (e) {
    next(e)
  }
})

admin.get('/shop-levels', (_req, res) => {
  res.json(listShopLevels())
})

admin.put('/shop-levels/:entityId', (req, res, next) => {
  try {
    const body = z.object({ requiredLevel: z.number().int().min(1).max(20) }).parse(req.body)
    if (!getEntity(req.params.entityId)) {
      res.status(404).json({ error: { message: 'Item não encontrado' } })
      return
    }
    res.json({ entityId: req.params.entityId, requiredLevel: setShopLevel(req.params.entityId, body.requiredLevel) })
  } catch (e) {
    next(e)
  }
})

admin.post('/sessions/:sessionId/auctions', (req, res, next) => {
  try {
    const body = z
      .object({
        entityId: z.string().min(1),
        requiredLevel: z.number().int().min(1).max(20).default(1),
        minutes: z.number().int().min(1).max(180),
        npcName: z.string().max(80).optional(),
        npcAmount: z.number().int().min(1).max(100000).optional(),
        npcCoin: coinSchema.optional(),
      })
      .parse(req.body)
    if (!getScheduledSession(req.params.sessionId)) {
      res.status(404).json({ error: { message: 'Sessão não encontrada' } })
      return
    }
    const result = releaseAuction({
      sessionId: req.params.sessionId,
      entityId: body.entityId,
      requiredLevel: body.requiredLevel,
      minutes: body.minutes,
      createdBy: req.user!.email,
      npcName: body.npcName,
      npcAmount: body.npcAmount,
      npcCoin: body.npcCoin,
    })
    if (!result.ok) {
      res.status(400).json({ error: { message: result.error } })
      return
    }
    res.status(201).json(result.auction)
  } catch (e) {
    next(e)
  }
})

admin.post('/auctions/:auctionId/npc-bid', (req, res, next) => {
  try {
    const body = z
      .object({
        displayName: z.string().min(1).max(80),
        amount: z.number().int().min(1).max(100000),
        coin: coinSchema,
      })
      .parse(req.body)
    const result = addNpcBid(req.params.auctionId, body.displayName, body.amount, body.coin)
    if (!result.ok) {
      res.status(400).json({ error: { message: result.error } })
      return
    }
    res.json(result.auction)
  } catch (e) {
    next(e)
  }
})

admin.post('/auctions/:auctionId/close', (req, res) => {
  const result = closeAuction(req.params.auctionId)
  if (!result.ok) {
    res.status(404).json({ error: { message: result.error } })
    return
  }
  res.json(result.auction)
})

admin.get('/sessions/:sessionId/auctions', (req, res) => {
  res.json(listAuctions(req.params.sessionId))
})

courtRouter.use('/admin', admin)
