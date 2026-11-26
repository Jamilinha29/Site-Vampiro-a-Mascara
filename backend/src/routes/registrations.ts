import { Router } from 'express'

export const registrationsRouter = Router()

registrationsRouter.post('/', (_req, res) => {
  res.status(501).json({
    error: {
      message: 'Inscrição completa indisponível neste momento.',
    },
  })
})
