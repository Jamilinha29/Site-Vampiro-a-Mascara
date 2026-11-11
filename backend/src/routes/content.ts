import { Router } from 'express'
import { z } from 'zod'
import { requireUser } from '../middlewares/optionalUser.js'
import {
  refreshEntitiesFromDatabase,
  listPublishedDownloads,
  listPublishedForArchive,
  listPublishedForBestiary,
  listPublishedForShop,
  listHandouts,
  listPublishedSessionsForPlayers,
  listSceneThreatsForSession,
  getSessionLiveBrief,
  getSessionBagForPlayer,
  getPlayerSessionActSummary,
  getPlayerSessionActCanon,
} from '../services/chronicleStore.js'

export const contentRouter = Router()
contentRouter.use(requireUser)
contentRouter.use((req, res, next) => {
  void refreshEntitiesFromDatabase().then(() => next()).catch(() => next())
})

contentRouter.get('/archive', (req, res, next) => {
  try {
    const category = z.enum(['chronicles', 'relics', 'rituals']).parse(req.query.category ?? 'chronicles')
    res.json(listPublishedForArchive(category))
  } catch (e) {
    next(e)
  }
})

contentRouter.get('/shop', (req, res, next) => {
  try {
    const category = z.enum(['gear', 'consumables', 'services']).parse(req.query.category ?? 'gear')
    res.json(listPublishedForShop(category))
  } catch (e) {
    next(e)
  }
})

contentRouter.get('/bestiary', (req, res, next) => {
  try {
    const tier = z.enum(['known', 'classified', 'rumors']).parse(req.query.tier ?? 'known')
    res.json(listPublishedForBestiary(tier))
  } catch (e) {
    next(e)
  }
})

contentRouter.get('/downloads', (req, res, next) => {
  try {
    const category = z.enum(['rules', 'sheets', 'handouts']).parse(req.query.category ?? 'rules')
    res.json(listPublishedDownloads(category))
  } catch (e) {
    next(e)
  }
})

contentRouter.get('/session-handouts', (_req, res) => {
  res.json(listHandouts(false).filter((h) => h.status === 'closed'))
})

contentRouter.get('/scheduled-sessions', (_req, res) => {
  res.json(listPublishedSessionsForPlayers())
})

contentRouter.get('/sessions/:sessionId/scene-threats', (req, res) => {
  const threats = listSceneThreatsForSession(req.params.sessionId)
  if (threats === null) {
    res.status(404).json({ error: { message: 'Mesa não encontrada' } })
    return
  }
  res.json(threats)
})

contentRouter.get('/sessions/:sessionId/live-brief', (req, res) => {
  const brief = getSessionLiveBrief(req.params.sessionId)
  if (!brief) {
    res.status(404).json({ error: { message: 'Mesa não encontrada' } })
    return
  }
  res.json(brief)
})

contentRouter.get('/sessions/:sessionId/my-bag', (req, res) => {
  const bag = getSessionBagForPlayer(req.params.sessionId, req.user!.displayName)
  if (!bag) {
    res.status(404).json({ error: { message: 'Mesa não encontrada' } })
    return
  }
  res.json(bag)
})

contentRouter.get('/sessions/:sessionId/act-summary', (req, res) => {
  const row = getPlayerSessionActSummary(req.params.sessionId)
  if (!row) {
    res.status(404).json({ error: { message: 'Resumo ainda não publicado para este ato.' } })
    return
  }
  res.json(row)
})

contentRouter.get('/sessions/:sessionId/act-canon', (req, res) => {
  const row = getPlayerSessionActCanon(req.params.sessionId)
  if (!row) {
    res.status(404).json({ error: { message: 'Crônica canônica ainda não publicada para este ato.' } })
    return
  }
  res.json(row)
})
