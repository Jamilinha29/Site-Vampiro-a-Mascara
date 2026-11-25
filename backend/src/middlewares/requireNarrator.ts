import type { NextFunction, Request, Response } from 'express'
import { errorPayload } from '../services/errors.js'

export function requireNarrator(req: Request, res: Response, next: NextFunction) {
  const role = req.user?.role
  if (role !== 'narrator' && role !== 'admin') {
    res.status(403).json(
      errorPayload('FORBIDDEN', 'Acesso restrito ao narrador.', { requestId: req.requestId }),
    )
    return
  }
  next()
}

export function requireAdmin(req: Request, res: Response, next: NextFunction) {
  if (req.user?.role !== 'admin') {
    res.status(403).json(
      errorPayload('FORBIDDEN', 'Acesso restrito ao administrador da crônica.', { requestId: req.requestId }),
    )
    return
  }
  next()
}
