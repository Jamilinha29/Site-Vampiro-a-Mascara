import type { NextFunction, Request, Response } from 'express'

export function requireNarrator(req: Request, res: Response, next: NextFunction) {
  const role = req.user?.role
  if (role !== 'narrator' && role !== 'admin') {
    res.status(403).json({ error: { message: 'Acesso restrito ao narrador' } })
    return
  }
  next()
}
