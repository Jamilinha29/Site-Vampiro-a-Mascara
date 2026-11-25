import { Router } from 'express'
import { z } from 'zod'
import { requireUser } from '../middlewares/optionalUser.js'
import { withTableSecrets } from '../services/campaignExtras.js'
import {
  getPlayerSessionActCanon,
  getPlayerSessionActSummary,
  getSessionBagForPlayer,
  getSessionLiveBrief,
  listHandouts,
  listPublishedDownloads,
  listPublishedForArchive,
  listPublishedForBestiary,
  listPublishedForShop,
  listPublishedSessionsForPlayers,
  listSceneThreatsForSession,
  listSessionActions,
  recordSessionAction,
  refreshEntitiesFromDatabase,
  requireSessionParticipant,
  sessionAccess,
  syncSessionsIfStale,
} from '../services/chronicleStore.js'
import { errorPayload } from '../services/errors.js'
import { withReadableImages } from '../services/mediaStorage.js'
import { listRolls, rollForSession } from '../services/sessionRolls.js'

export const contentRouter = Router()
contentRouter.use(requireUser)
contentRouter.use((_req, _res, next) => {
  void syncSessionsIfStale()
    .then(() => next())
    .catch(() => next())
})

const optionalSession = z.object({ sessionId: z.string().min(1).optional() })

contentRouter.get('/archive', async (req, res, next) => {
  try {
    await refreshEntitiesFromDatabase()
    const category = z.enum(['chronicles', 'relics', 'rituals']).parse(req.query.category ?? 'chronicles')
    const { sessionId } = optionalSession.parse(req.query)
    if (sessionId) requireSessionParticipant(sessionId, req.user!)
    const rows = withTableSecrets(
      listPublishedForArchive(category, req.user?.email, sessionId),
      req.user?.email,
    )
    res.json(await withReadableImages(rows))
  } catch (e) {
    next(e)
  }
})

contentRouter.get('/shop', async (req, res, next) => {
  try {
    await refreshEntitiesFromDatabase()
    const category = z.enum(['gear', 'consumables', 'services']).parse(req.query.category ?? 'gear')
    const { sessionId } = optionalSession.parse(req.query)
    if (sessionId) requireSessionParticipant(sessionId, req.user!)
    const rows = withTableSecrets(
      listPublishedForShop(category, req.user?.email, sessionId),
      req.user?.email,
    )
    res.json(await withReadableImages(rows))
  } catch (e) {
    next(e)
  }
})

contentRouter.get('/bestiary', async (req, res, next) => {
  try {
    await refreshEntitiesFromDatabase()
    const tier = z.enum(['known', 'classified', 'rumors']).parse(req.query.tier ?? 'known')
    const { sessionId } = optionalSession.parse(req.query)
    if (sessionId) requireSessionParticipant(sessionId, req.user!)
    const rows = withTableSecrets(
      listPublishedForBestiary(tier, req.user?.email, sessionId),
      req.user?.email,
    )
    res.json(await withReadableImages(rows))
  } catch (e) {
    next(e)
  }
})

contentRouter.get('/downloads', async (req, res, next) => {
  try {
    await refreshEntitiesFromDatabase()
    const category = z.enum(['rules', 'sheets', 'handouts']).parse(req.query.category ?? 'rules')
    const { sessionId } = optionalSession.parse(req.query)
    if (sessionId) requireSessionParticipant(sessionId, req.user!)
    const pack = listPublishedDownloads(category, req.user?.email, sessionId)
    const handouts = pack.handouts.filter((handout) => {
      if (!handout.scheduledSessionId) return true
      return sessionAccess(handout.scheduledSessionId, req.user!).ok
    })
    res.json({ ...pack, handouts, files: await withReadableImages(pack.files) })
  } catch (e) {
    next(e)
  }
})

contentRouter.get('/session-handouts', (req, res) => {
  const rows = listHandouts(false).filter((handout) => {
    if (handout.status !== 'closed') return false
    if (!handout.scheduledSessionId) return true
    return sessionAccess(handout.scheduledSessionId, req.user!).ok
  })
  res.json(rows)
})

contentRouter.get('/scheduled-sessions', (req, res) => {
  res.json(listPublishedSessionsForPlayers(req.user?.email))
})

function denySession(res: import('express').Response, reason: 'not_found' | 'forbidden') {
  if (reason === 'not_found') {
    res.status(404).json(errorPayload('NOT_FOUND', 'Mesa não encontrada'))
    return
  }
  res.status(403).json(errorPayload('FORBIDDEN', 'Você não está nesta mesa.'))
}

contentRouter.get('/sessions/:sessionId/scene-threats', (req, res) => {
  const access = sessionAccess(req.params.sessionId, req.user!)
  if (!access.ok) {
    denySession(res, access.reason)
    return
  }
  const threats = listSceneThreatsForSession(req.params.sessionId)
  if (threats === null) {
    res.status(404).json(errorPayload('NOT_FOUND', 'Mesa não encontrada'))
    return
  }
  res.json(threats)
})

contentRouter.get('/sessions/:sessionId/live-brief', (req, res) => {
  const access = sessionAccess(req.params.sessionId, req.user!)
  if (!access.ok) {
    denySession(res, access.reason)
    return
  }
  const brief = getSessionLiveBrief(req.params.sessionId)
  if (!brief) {
    res.status(404).json(errorPayload('NOT_FOUND', 'Mesa não encontrada'))
    return
  }
  res.json(brief)
})

contentRouter.get('/sessions/:sessionId/my-bag', (req, res) => {
  const access = sessionAccess(req.params.sessionId, req.user!)
  if (!access.ok) {
    denySession(res, access.reason)
    return
  }
  const bag = getSessionBagForPlayer(req.params.sessionId, req.user!.email)
  if (!bag) {
    res.status(404).json(errorPayload('NOT_FOUND', 'Mesa não encontrada'))
    return
  }
  res.json(bag)
})

contentRouter.get('/sessions/:sessionId/act-summary', (req, res) => {
  const access = sessionAccess(req.params.sessionId, req.user!)
  if (!access.ok) {
    denySession(res, access.reason)
    return
  }
  const row = getPlayerSessionActSummary(req.params.sessionId)
  if (!row) {
    res.status(404).json(errorPayload('NOT_FOUND', 'Resumo ainda não publicado para este ato.'))
    return
  }
  res.json(row)
})

contentRouter.get('/sessions/:sessionId/rolls', (req, res, next) => {
  try {
    requireSessionParticipant(req.params.sessionId, req.user!)
    res.json(listRolls(req.params.sessionId, req.user!) ?? [])
  } catch (e) {
    next(e)
  }
})

contentRouter.post('/sessions/:sessionId/rolls', async (req, res, next) => {
  try {
    requireSessionParticipant(req.params.sessionId, req.user!)
    const body = z
      .object({
        formula: z.string().min(2).max(20),
        characterName: z.string().max(120).optional(),
        secret: z.boolean().optional(),
      })
      .parse(req.body)
    const row = await rollForSession({
      email: req.user!.email,
      role: req.user!.role,
      sessionId: req.params.sessionId,
      characterName: body.characterName ?? req.user!.displayName,
      formula: body.formula,
      secret: body.secret,
    })
    res.status(201).json(row)
  } catch (e) {
    next(e)
  }
})

contentRouter.get('/sessions/:sessionId/actions', (req, res, next) => {
  try {
    requireSessionParticipant(req.params.sessionId, req.user!)
    const limit = z.coerce.number().int().min(1).max(200).optional().parse(req.query.limit)
    res.json(listSessionActions(req.params.sessionId, limit ?? 60))
  } catch (e) {
    next(e)
  }
})

contentRouter.post('/sessions/:sessionId/actions', async (req, res, next) => {
  try {
    requireSessionParticipant(req.params.sessionId, req.user!)
    const body = z
      .object({
        characterId: z.string().max(160).optional(),
        characterName: z.string().max(120).optional(),
        kind: z.enum(['declaration', 'skill', 'damage', 'potion', 'turn_end', 'round_end', 'system']),
        summary: z.string().trim().min(1).max(240),
        detail: z.string().trim().max(1000).optional(),
      })
      .parse(req.body ?? {})
    const created = await recordSessionAction({
      sessionId: req.params.sessionId,
      actorEmail: req.user!.email,
      characterName: body.characterName ?? req.user!.displayName,
      characterId: body.characterId,
      kind: body.kind,
      summary: body.summary,
      detail: body.detail,
    })
    res.status(201).json(created)
  } catch (e) {
    next(e)
  }
})

contentRouter.get('/sessions/:sessionId/act-canon', (req, res) => {
  const access = sessionAccess(req.params.sessionId, req.user!)
  if (!access.ok) {
    denySession(res, access.reason)
    return
  }
  const row = getPlayerSessionActCanon(req.params.sessionId)
  if (!row) {
    res.status(404).json(errorPayload('NOT_FOUND', 'Crônica canônica ainda não publicada para este ato.'))
    return
  }
  res.json(row)
})
