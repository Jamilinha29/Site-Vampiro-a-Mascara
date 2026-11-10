import { Router } from 'express'

export const registrationsRouter = Router()

registrationsRouter.post('/', (_req, res) => {
  res.status(501).json({
    error: {
      message:
        'Inscrição completa com PDFs requer Supabase + Resend configurados (veja .env.example).',
    },
  })
})
