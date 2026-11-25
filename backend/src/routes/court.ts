import { Router } from 'express'
import { z } from 'zod'
import { requireUser } from '../middlewares/optionalUser.js'
import { requireNarrator } from '../middlewares/requireNarrator.js'
import {
  ensureHandoutForScheduledSession,
  entityMatchesCatalogScope,
  getEntity,
  getScheduledSession,
  listEntities,
  listScheduledSessionsForManager,
  requireSessionManager,
  requireSessionParticipant,
  resolveCatalogScopeForViewer,
  syncSessionsIfStale,
  updateHandout,
} from '../services/chronicleStore.js'
import {
  COIN_LABEL,
  acceptFriend,
  addNpcBid,
  areFriends,
  closeAuction,
  createAchievement,
  creditCoins,
  deleteAchievement,
  friendEmails,
  getAuction,
  grantAchievement,
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
  shopLevelOf,
  syncCourtIfStale,
  withdrawBid,
  type Coin,
} from '../services/courtStore.js'
import { errorPayload } from '../services/errors.js'
import { runIdempotent } from '../services/idempotencyStore.js'
import {
  MAX_CHARACTER_LEVEL,
  findProfileByPublicId,
  getProfile as loadProfile,
  listCharacters,
  publicPlayerId,
} from '../services/profileStore.js'

export const courtRouter = Router()
courtRouter.use(requireUser)
courtRouter.use((_req, _res, next) => {
  void Promise.all([syncCourtIfStale(), syncSessionsIfStale()])
    .then(() => next())
    .catch(() => next())
})

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
  if (q.trim().length < 2) {
    res.json([])
    return
  }
  res.json(searchPlayers(q, req.user!.email))
})

const friendTargetSchema = z
  .object({
    email: z.string().email().optional(),
    playerId: z.string().min(2).max(160).optional(),
  })
  .refine((v) => Boolean(v.email || v.playerId), { message: 'Informe o identificador do jogador.' })

courtRouter.post('/friends', async (req, res, next) => {
  try {
    const body = friendTargetSchema.parse(req.body)
    const target = body.playerId ?? body.email!
    const result = await requestFriend(req.user!.email, target)
    if (!result.ok) {
      res.status(400).json(errorPayload('VALIDATION_ERROR', result.error, { requestId: req.requestId }))
      return
    }
    res.status(201).json(result.link)
  } catch (e) {
    next(e)
  }
})

courtRouter.post('/friends/:linkId/accept', async (req, res, next) => {
  try {
    const result = await acceptFriend(req.user!.email, req.params.linkId)
    if (!result.ok) {
      res.status(400).json(errorPayload('VALIDATION_ERROR', result.error, { requestId: req.requestId }))
      return
    }
    res.json(result.link)
  } catch (e) {
    next(e)
  }
})

courtRouter.delete('/friends/:id', async (req, res, next) => {
  try {
    const removed = await removeFriend(req.user!.email, req.params.id)
    if (!removed) {
      res.status(404).json(errorPayload('NOT_FOUND', 'Amizade não encontrada', { requestId: req.requestId }))
      return
    }
    res.status(204).end()
  } catch (e) {
    next(e)
  }
})

courtRouter.get('/session-board', (req, res) => {
  const q = (typeof req.query.q === 'string' ? req.query.q : '').trim().toLowerCase()
  const me = req.user!.email
  const friends = new Set(friendEmails(me).map((e) => e.toLowerCase()))
  const rows = listScheduledSessionsForManager({ email: me, role: 'admin' }).filter((s) => s.status !== 'closed')
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

courtRouter.get('/sessions/:sessionId/ferreiro', async (req, res, next) => {
  try {
    requireSessionParticipant(req.params.sessionId, req.user!)
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
      auctions: await listAuctions(req.params.sessionId),
    })
  } catch (e) {
    next(e)
  }
})

courtRouter.post('/auctions/:auctionId/bid', async (req, res, next) => {
  try {
    const body = z
      .object({
        amount: z.number().int().min(1).max(100000),
        coin: coinSchema,
        characterId: z.string().optional(),
      })
      .parse(req.body)
    const existing = getAuction(req.params.auctionId)
    if (!existing) {
      res.status(404).json(errorPayload('NOT_FOUND', 'Leilão não encontrado.', { requestId: req.requestId }))
      return
    }
    const session = requireSessionParticipant(existing.sessionId, req.user!)
    const seat = (session.seats ?? []).find(
      (s) => !s.leftAt && s.email.toLowerCase() === req.user!.email.toLowerCase(),
    )
    const effectiveCharacterId = body.characterId ?? seat?.characterId
    const result = await placeBid({
      auctionId: req.params.auctionId,
      email: req.user!.email,
      displayName: req.user!.displayName,
      amount: body.amount,
      coin: body.coin,
      level: playerLevel(req.user!.email, effectiveCharacterId),
    })
    if (!result.ok) {
      res.status(400).json(errorPayload('VALIDATION_ERROR', result.error, { requestId: req.requestId }))
      return
    }
    res.json(result.auction)
  } catch (e) {
    next(e)
  }
})

courtRouter.post('/auctions/:auctionId/withdraw', async (req, res, next) => {
  try {
    const existing = getAuction(req.params.auctionId)
    if (!existing) {
      res.status(404).json(errorPayload('NOT_FOUND', 'Leilão não encontrado.', { requestId: req.requestId }))
      return
    }
    requireSessionParticipant(existing.sessionId, req.user!)
    const result = await withdrawBid(req.params.auctionId, req.user!.email)
    if (!result.ok) {
      res.status(400).json(errorPayload('VALIDATION_ERROR', result.error, { requestId: req.requestId }))
      return
    }
    res.json(result.auction)
  } catch (e) {
    next(e)
  }
})

const admin = Router()
admin.use(requireNarrator)

admin.get('/achievements', (_req, res) => {
  res.json(listAchievements())
})

admin.post('/achievements', async (req, res, next) => {
  try {
    const body = z
      .object({
        title: z.string().min(2).max(80),
        description: z.string().max(400).default(''),
        howToEarn: z.string().min(4).max(400),
      })
      .parse(req.body)
    res.status(201).json(await createAchievement(body))
  } catch (e) {
    next(e)
  }
})

admin.delete('/achievements/:id', async (req, res, next) => {
  try {
    if (!(await deleteAchievement(req.params.id))) {
      res.status(404).json(errorPayload('NOT_FOUND', 'Conquista não encontrada', { requestId: req.requestId }))
      return
    }
    res.status(204).end()
  } catch (e) {
    next(e)
  }
})

admin.post('/achievements/:id/grant', async (req, res, next) => {
  try {
    const body = z
      .object({
        email: z.string().email().optional(),
        playerId: z.string().min(2).max(160).optional(),
      })
      .refine((v) => Boolean(v.email || v.playerId), { message: 'Informe o jogador.' })
      .parse(req.body)
    const targetProfile = findProfileByPublicId(body.playerId ?? body.email!)
    if (!targetProfile) {
      res.status(404).json(errorPayload('NOT_FOUND', 'Jogador não encontrado', { requestId: req.requestId }))
      return
    }
    if (req.user!.role !== 'admin' && !areFriends(req.user!.email, targetProfile.email)) {
      res.status(403).json(
        errorPayload('FORBIDDEN', 'Só é possível marcar conquista de um jogador amigo', {
          requestId: req.requestId,
        }),
      )
      return
    }
    const result = await grantAchievement(targetProfile.email, req.params.id, req.user!.email)
    if (!result.ok) {
      res.status(404).json(errorPayload('NOT_FOUND', result.error, { requestId: req.requestId }))
      return
    }
    res.json({
      achievementId: result.unlock.achievementId,
      playerId: publicPlayerId(result.unlock.email),
      unlockedAt: result.unlock.unlockedAt,
    })
  } catch (e) {
    next(e)
  }
})

admin.get('/players', (req, res) => {
  res.json(narratorFriendDirectory(req.user!.email))
})

admin.post('/friends', async (req, res, next) => {
  try {
    const body = friendTargetSchema.parse(req.body)
    const result = await requestFriend(req.user!.email, body.playerId ?? body.email!)
    if (!result.ok) {
      res.status(400).json(errorPayload('VALIDATION_ERROR', result.error, { requestId: req.requestId }))
      return
    }
    res.status(201).json(narratorFriendDirectory(req.user!.email))
  } catch (e) {
    next(e)
  }
})

admin.delete('/friends/:id', async (req, res, next) => {
  try {
    const removed = await removeFriend(req.user!.email, decodeURIComponent(req.params.id))
    if (!removed) {
      res.status(404).json(errorPayload('NOT_FOUND', 'Amizade não encontrada', { requestId: req.requestId }))
      return
    }
    res.json(narratorFriendDirectory(req.user!.email))
  } catch (e) {
    next(e)
  }
})

admin.post('/grant-coins', async (req, res, next) => {
  try {
    const body = z
      .object({
        sessionId: z.string().min(1),
        participantDisplayName: z.string().min(1),
        coin: coinSchema,
        amount: z.number().int().min(1).max(100000),
        operationId: z.string().trim().min(4).max(160).optional(),
      })
      .parse(req.body)
    const session = requireSessionManager(body.sessionId, req.user!)
    if (session.status === 'closed') {
      res.status(409).json(
        errorPayload('CONFLICT', 'Não é possível conceder moedas em mesa encerrada.', {
          requestId: req.requestId,
        }),
      )
      return
    }
    const seat =
      (session.seats ?? []).find(
        (s) => !s.leftAt && s.displayName.trim().toLowerCase() === body.participantDisplayName.trim().toLowerCase(),
      ) ?? null
    if (!seat) {
      res.status(404).json(errorPayload('NOT_FOUND', 'Jogador sem assento na mesa.', { requestId: req.requestId }))
      return
    }

    const op = await runIdempotent({
      actorEmail: req.user!.email,
      operationId: body.operationId,
      kind: 'grant-coins',
      requestPayload: {
        sessionId: body.sessionId,
        participantDisplayName: body.participantDisplayName.trim().toLowerCase(),
        coin: body.coin,
        amount: body.amount,
      },
      execute: async () => {
        const wallet = await creditCoins(
          seat.email,
          body.coin as Coin,
          body.amount,
          `Mesa · ${session.chronicleName ?? session.title}`,
          { actorEmail: req.user!.email, sessionId: body.sessionId },
        )
        const handout = await ensureHandoutForScheduledSession(body.sessionId)
        if (handout) {
          const label = `+${body.amount} ${COIN_LABEL[body.coin as Coin]}`
          const participants = handout.participants.map((p) => {
            if (p.displayName.trim().toLowerCase() !== body.participantDisplayName.trim().toLowerCase()) return p
            return { ...p, rewards: [...p.rewards, { type: 'currency' as const, label }] }
          })
          const has = participants.some(
            (p) => p.displayName.trim().toLowerCase() === body.participantDisplayName.trim().toLowerCase(),
          )
          await updateHandout(handout.id, {
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
        return { status: 200, body: { wallet, displayName: seat.displayName } }
      },
    })

    res.status(op.status).json(op.body)
  } catch (e) {
    next(e)
  }
})

admin.get('/shop-levels', (_req, res) => {
  res.json(listShopLevels())
})

admin.put('/shop-levels/:entityId', async (req, res, next) => {
  try {
    const body = z.object({ requiredLevel: z.number().int().min(1).max(MAX_CHARACTER_LEVEL) }).parse(req.body)
    if (!getEntity(req.params.entityId)) {
      res.status(404).json(errorPayload('NOT_FOUND', 'Item não encontrado', { requestId: req.requestId }))
      return
    }
    const level = await setShopLevel(req.params.entityId, body.requiredLevel)
    res.json({ entityId: req.params.entityId, requiredLevel: level })
  } catch (e) {
    next(e)
  }
})

admin.post('/sessions/:sessionId/auctions', async (req, res, next) => {
  try {
    requireSessionManager(req.params.sessionId, req.user!)
    const body = z
      .object({
        entityId: z.string().min(1),
        requiredLevel: z.number().int().min(1).max(MAX_CHARACTER_LEVEL).default(1),
        minutes: z.number().int().min(1).max(180),
        npcName: z.string().max(80).optional(),
        npcAmount: z.number().int().min(1).max(100000).optional(),
        npcCoin: coinSchema.optional(),
      })
      .parse(req.body)
    if (!getScheduledSession(req.params.sessionId)) {
      res.status(404).json(errorPayload('NOT_FOUND', 'Sessão não encontrada', { requestId: req.requestId }))
      return
    }
    const result = await releaseAuction({
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
      res.status(400).json(errorPayload('VALIDATION_ERROR', result.error, { requestId: req.requestId }))
      return
    }
    res.status(201).json(result.auction)
  } catch (e) {
    next(e)
  }
})

admin.post('/auctions/:auctionId/npc-bid', async (req, res, next) => {
  try {
    const existing = getAuction(req.params.auctionId)
    if (!existing) {
      res.status(404).json(errorPayload('NOT_FOUND', 'Leilão não encontrado', { requestId: req.requestId }))
      return
    }
    requireSessionManager(existing.sessionId, req.user!)
    const body = z
      .object({
        displayName: z.string().min(1).max(80),
        amount: z.number().int().min(1).max(100000),
        coin: coinSchema,
      })
      .parse(req.body)
    const result = await addNpcBid(req.params.auctionId, body.displayName, body.amount, body.coin)
    if (!result.ok) {
      res.status(400).json(errorPayload('VALIDATION_ERROR', result.error, { requestId: req.requestId }))
      return
    }
    res.json(result.auction)
  } catch (e) {
    next(e)
  }
})

admin.post('/auctions/:auctionId/close', async (req, res, next) => {
  try {
    const existing = getAuction(req.params.auctionId)
    if (!existing) {
      res.status(404).json(errorPayload('NOT_FOUND', 'Leilão não encontrado', { requestId: req.requestId }))
      return
    }
    requireSessionManager(existing.sessionId, req.user!)
    const result = await closeAuction(req.params.auctionId)
    if (!result.ok) {
      res.status(404).json(errorPayload('NOT_FOUND', result.error, { requestId: req.requestId }))
      return
    }
    res.json(result.auction)
  } catch (e) {
    next(e)
  }
})

admin.get('/sessions/:sessionId/auctions', async (req, res, next) => {
  try {
    requireSessionManager(req.params.sessionId, req.user!)
    res.json(await listAuctions(req.params.sessionId))
  } catch (e) {
    next(e)
  }
})

courtRouter.use('/admin', admin)
