import type { NextFunction, Request, Response } from 'express'

export function errorHandler(err: unknown, _req: Request, res: Response, _next: NextFunction) {
  const message = err instanceof Error ? err.message : 'Erro interno'
  const status = message.includes('não autorizado') ? 403 : message.includes('inválido') ? 400 : 500
  res.status(status).json({ error: { message } })
}
