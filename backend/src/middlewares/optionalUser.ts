import type { NextFunction, Request, Response } from 'express'
import { resolveUserFromAuthHeader } from '../services/supabaseAuth.js'

export type RequestUser = {
  userId: string
  email: string
  displayName: string
  role: 'player' | 'narrator' | 'admin'
}

declare global {
  namespace Express {
    interface Request {
      user?: RequestUser
    }
  }
}

export function requireUser(req: Request, res: Response, next: NextFunction) {
  void resolveUserFromAuthHeader(req.headers.authorization)
    .then((user) => {
      if (!user) {
        res.status(401).json({ error: { message: 'Não autenticado' } })
        return
      }
      req.user = user
      next()
    })
    .catch(next)
}
