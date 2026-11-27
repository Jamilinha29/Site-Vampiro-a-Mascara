import { Router, type NextFunction, type Request, type RequestHandler, type Response } from 'express'
import { z } from 'zod'
import { requireUser, type RequestUser } from '../middlewares/optionalUser.js'
import { getCourtWallet, listCourtLedger, syncCourtIfStale } from '../services/courtStore.js'
import { errorPayload } from '../services/errors.js'
import { buyAtTable } from '../services/shopPurchase.js'
import { getPurchaseCount, remainingStock, syncShopIfStale } from '../services/shopStore.js'

export const walletsRouter = Router()

function wrapAsync(
  handler: (req: Request, res: Response, next: NextFunction, user: RequestUser) => Promise<void>,
): RequestHandler {
  return (req, res, next) => {
    const user = req.user
    if (!user) {
      res.status(401).json(errorPayload('UNAUTHORIZED', 'Não autenticado.', { requestId: req.requestId }))
      return
    }
    void handler(req, res, next, user).catch(next)
  }
}

const ledgerQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(200).optional(),
  offset: z.coerce.number().int().min(0).max(10000).optional(),
})

walletsRouter.get(
  '/active',
  requireUser,
  wrapAsync(async (_req, res, _next, user) => {
    await syncCourtIfStale()
    res.json(getCourtWallet(user.email))
  }),
)

walletsRouter.get(
  '/ledger',
  requireUser,
  wrapAsync(async (req, res, _next, user) => {
    const query = ledgerQuerySchema.parse(req.query)
    await syncCourtIfStale()
    res.json(listCourtLedger(user.email, query))
  }),
)

walletsRouter.get(
  '/shop-stock/:entityId',
  requireUser,
  wrapAsync(async (req, res, _next, user) => {
    const { entityId } = z.object({ entityId: z.string().trim().min(1).max(160) }).parse(req.params)
    await syncShopIfStale()
    res.json({
      remaining: remainingStock(entityId),
      ownedByYou: getPurchaseCount(user.email, entityId),
    })
  }),
)

const buySchema = z.object({
  entityId: z.string().min(1).max(160),
  characterId: z.string().min(1).max(160).optional(),
  sessionId: z.string().min(1).max(160).optional(),
  operationId: z.string().trim().min(8).max(80).optional(),
  quantity: z.number().int().min(1).max(20).default(1),
})

walletsRouter.post(
  '/shop/buy',
  requireUser,
  wrapAsync(async (req, res, _next, user) => {
    const body = buySchema.parse(req.body)
    const result = await buyAtTable({
      email: user.email,
      entityId: body.entityId,
      quantity: body.quantity,
      sessionId: body.sessionId,
      characterId: body.characterId,
      operationId: body.operationId,
    })
    res.status(result.status).json(result.body)
  }),
)
