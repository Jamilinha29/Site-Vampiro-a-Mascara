import { Router } from 'express'
import { findScheduledSessionByAccessCode } from '../services/chronicleStore.js'

export const sessionsRouter = Router()

sessionsRouter.post('/join-by-code', (req, res) => {
  const code = String(req.body?.code ?? '').trim()
  if (!code || code.length < 4) {
    return res.status(400).json({ error: { message: 'Código inválido' } })
  }
  const session = findScheduledSessionByAccessCode(code)
  if (!session) {
    return res.status(404).json({ error: { message: 'Nenhuma mesa com esse código' } })
  }
  res.json({ sessionId: session.id })
})
