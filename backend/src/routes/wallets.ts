import { Router } from 'express'
import { z } from 'zod'
import { requireUser } from '../middlewares/optionalUser.js'
import { getPurchaseCount, remainingStock } from '../services/shopStore.js'
import { getCourtWallet, listCourtLedger } from '../services/courtStore.js'
import { buyAtTableQueued } from '../services/shopPurchase.js'

export const walletsRouter = Router()

walletsRouter.get('/active', requireUser, (req, res) => {
  res.json(getCourtWallet(req.user!.email))
})

walletsRouter.get('/ledger', requireUser, (req, res) => {
  res.json(listCourtLedger(req.user!.email))
})

walletsRouter.get('/shop-stock/:entityId', requireUser, (req, res) => {
  const raw = req.params.entityId
  const entityId = typeof raw === 'string' ? raw : (raw[0] ?? '')
  if (!entityId) {
    res.status(400).json({ error: { message: 'entityId inválido' } })
    return
  }
  res.json({
    remaining: remainingStock(entityId),
    ownedByYou: getPurchaseCount(req.user!.email, entityId),
  })
})

const buySchema = z.object({
  entityId: z.string().min(1),
  characterId: z.string().min(1).optional(),
  sessionId: z.string().min(1).optional(),
  operationId: z.string().min(8).max(80).optional(),
  quantity: z.number().int().min(1).max(20).default(1),
})

walletsRouter.post('/shop/buy', requireUser, async (req, res, next) => {
  try {
    const body = buySchema.parse(req.body)
    const result = await buyAtTableQueued({
      email: req.user!.email,
      entityId: body.entityId,
      quantity: body.quantity,
      sessionId: body.sessionId,
      characterId: body.characterId,
      operationId: body.operationId,
    })
    res.status(result.status).json(result.body)
  } catch (e) {
    next(e)
  }
})
