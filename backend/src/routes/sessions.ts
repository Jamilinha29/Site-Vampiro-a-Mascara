import { Router } from 'express'
import { findScheduledSessionByAccessCode } from '../services/chronicleStore.js'
import { requireUser } from '../middlewares/optionalUser.js'

const attempts = new Map<string, { count: number; since: number }>()
const WINDOW_MS = 15 * 60 * 1000
const MAX_TRIES = 8

export const sessionsRouter = Router()

sessionsRouter.post('/join-by-code', requireUser, (req, res) => {
  const email = req.user!.email.toLowerCase()
  const now = Date.now()
  const current = attempts.get(email)
  const fresh = !current || now - current.since > WINDOW_MS ? { count: 0, since: now } : current
  if (fresh.count >= MAX_TRIES) {
    res.status(429).json({ error: { message: 'Muitas tentativas. Espere alguns minutos.' } })
    return
  }
  const code = String(req.body?.code ?? '').trim()
  if (!code || code.length < 4) {
    fresh.count += 1
    attempts.set(email, fresh)
    res.status(400).json({ error: { message: 'Código inválido' } })
    return
  }
  const session = findScheduledSessionByAccessCode(code)
  if (!session) {
    fresh.count += 1
    attempts.set(email, fresh)
    res.status(404).json({ error: { message: 'Nenhuma mesa com esse código' } })
    return
  }
  attempts.delete(email)
  res.json({ sessionId: session.id })
})
