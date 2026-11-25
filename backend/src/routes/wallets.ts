import { Router } from 'express'
import { z } from 'zod'
import { requireUser } from '../middlewares/optionalUser.js'
import { errorPayload } from '../services/errors.js'
import { getCourtWallet, listCourtLedger } from '../services/courtStore.js'
import { buyAtTable } from '../services/shopPurchase.js'
import { getPurchaseCount, remainingStock, syncShopIfStale } from '../services/shopStore.js'

export const walletsRouter = Router()

const ledgerQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(200).optional(),
  offset: z.coerce.number().int().min(0).max(10000).optional(),
})

walletsRouter.get('/active', requireUser, (req, res) => {
  res.json(getCourtWallet(req.user!.email))
})

walletsRouter.get('/ledger', requireUser, (req, res, next) => {
  try {
    const query = ledgerQuerySchema.parse(req.query)
    res.json(listCourtLedger(req.user!.email, query))
  } catch (e) {
    next(e)
  }
})

walletsRouter.get('/shop-stock/:entityId', requireUser, async (req, res, next) => {
  try {
    const { entityId } = z.object({ entityId: z.string().trim().min(1).max(160) }).parse(req.params)
    await syncShopIfStale()
    res.json({
      remaining: remainingStock(entityId),
      ownedByYou: getPurchaseCount(req.user!.email, entityId),
    })
  } catch (e) {
    next(e)
  }
})

const buySchema = z.object({
  entityId: z.string().min(1).max(160),
  characterId: z.string().min(1).max(160).optional(),
  sessionId: z.string().min(1).max(160).optional(),
  operationId: z.string().trim().min(8).max(80).optional(),
  quantity: z.number().int().min(1).max(20).default(1),
})

walletsRouter.post('/shop/buy', requireUser, async (req, res, next) => {
  try {
    const body = buySchema.parse(req.body)
    const result = await buyAtTable({
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

export function _keepUnused(_req: unknown) {
  return errorPayload
}
