import { Router } from 'express'
import { z } from 'zod'
import { requireUser } from '../middlewares/optionalUser.js'
import {
  evaluatePlayerLiveAccess,
  findScheduledSessionByAccessCode,
  hasConfirmedSessionPresence,
  isScheduledTimeReached,
  syncSessionsIfStale,
} from '../services/chronicleStore.js'
import { errorPayload } from '../services/errors.js'
import { checkSharedRateLimit, resetSharedRateLimit } from '../services/rateLimitStore.js'

const WINDOW_MS = 15 * 60 * 1000
const MAX_TRIES = 8

export const sessionsRouter = Router()

const joinCodeSchema = z.object({
  code: z.string().trim().min(4).max(40),
})

sessionsRouter.post('/join-by-code', requireUser, async (req, res, next) => {
  try {
    const email = req.user!.email.toLowerCase()
    const key = `join-code:${email}`
    const rate = await checkSharedRateLimit(key, WINDOW_MS, MAX_TRIES)
    if (!rate.allowed) {
      res.setHeader('Retry-After', String(rate.retryAfterSec))
      res.status(429).json(
        errorPayload('RATE_LIMITED', 'Muitas tentativas. Espere alguns minutos.', { requestId: req.requestId }),
      )
      return
    }

    const parsed = joinCodeSchema.safeParse(req.body ?? {})
    if (!parsed.success) {
      res.status(400).json(
        errorPayload('VALIDATION_ERROR', 'Código inválido ou mesa indisponível.', { requestId: req.requestId }),
      )
      return
    }

    await syncSessionsIfStale()
    const session = findScheduledSessionByAccessCode(parsed.data.code)
    if (!session || session.status === 'closed') {
      res.status(404).json(
        errorPayload('NOT_FOUND', 'Código inválido ou mesa indisponível.', { requestId: req.requestId }),
      )
      return
    }

    await resetSharedRateLimit(key)
    const hasConfirmedPresence = hasConfirmedSessionPresence(session, email)
    const scheduledTimeReached = isScheduledTimeReached(session)
    const canEnterLive = evaluatePlayerLiveAccess(session, email).allowed
    res.json({
      sessionId: session.id,
      title: session.chronicleName ?? session.title,
      scheduledAt: session.scheduledAt,
      status: session.status,
      listing: session.listing ?? 'private',
      hasConfirmedPresence,
      scheduledTimeReached,
      canEnterLive,
    })
  } catch (e) {
    next(e)
  }
})
