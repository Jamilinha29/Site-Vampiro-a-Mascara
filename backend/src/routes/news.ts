import { Router } from 'express'

export const newsRouter = Router()

newsRouter.get('/', (_req, res) => {
  res.json([])
})
