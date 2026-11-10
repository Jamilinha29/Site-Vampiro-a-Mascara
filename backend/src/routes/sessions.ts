import { Router } from 'express'

export const sessionsRouter = Router()

sessionsRouter.post('/join-by-code', (req, res) => {
  const code = String(req.body?.code ?? '').trim()
  if (!code || code.length < 6) {
    return res.status(400).json({ error: { message: 'Código inválido' } })
  }
  res.json({ sessionId: '00000000-0000-4000-8000-000000000099' })
})
