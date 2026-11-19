import type { NextFunction, Request, Response } from 'express'

export function errorHandler(err: unknown, _req: Request, res: Response, _next: NextFunction) {
  const message = err instanceof Error ? err.message : 'Erro interno'
  const status = message.includes('não autorizado') || message.includes('não está nesta mesa')
    ? 403
    : message.includes('inválido') || message.includes('Habilidade aprovada')
      ? 400
      : 500
  res.status(status).json({ error: { message } })
}
