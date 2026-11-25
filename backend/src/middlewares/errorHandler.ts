import type { NextFunction, Request, Response } from 'express'
import { ZodError } from 'zod'
import { AppError, errorPayload } from '../services/errors.js'

function zodDetails(err: ZodError) {
  return err.issues.map((issue) => ({
    field: issue.path.length ? issue.path.join('.') : undefined,
    message: issue.message,
  }))
}

export function errorHandler(err: unknown, req: Request, res: Response, _next: NextFunction) {
  const requestId = req.requestId
  if (res.headersSent) return

  if (err instanceof ZodError) {
    res.status(400).json(
      errorPayload('VALIDATION_ERROR', 'Dados inválidos.', {
        details: zodDetails(err),
        requestId,
      }),
    )
    return
  }

  if (err instanceof SyntaxError && 'body' in err) {
    res.status(400).json(errorPayload('INVALID_JSON', 'Corpo JSON malformado.', { requestId }))
    return
  }

  if (
    typeof err === 'object' &&
    err !== null &&
    ('type' in err && (err as { type?: unknown }).type === 'entity.too.large')
  ) {
    res.status(413).json(errorPayload('PAYLOAD_TOO_LARGE', 'Envio acima do limite permitido.', { requestId }))
    return
  }

  if (err instanceof AppError) {
    if (err.status >= 500) {
      console.error(
        JSON.stringify({
          level: 'error',
          requestId,
          code: err.code,
          status: err.status,
          message: err.message,
          stack: err.stack,
        }),
      )
    }
    const safeMessage = err.expose ? err.message : 'Erro interno no servidor.'
    res.status(err.status).json(
      errorPayload(err.code, safeMessage, {
        details: err.expose ? err.details : undefined,
        requestId,
      }),
    )
    return
  }

  const rawMessage = err instanceof Error ? err.message : String(err)
  console.error(
    JSON.stringify({
      level: 'error',
      requestId,
      code: 'INTERNAL_ERROR',
      message: rawMessage,
      stack: err instanceof Error ? err.stack : undefined,
    }),
  )

  res.status(500).json(
    errorPayload('INTERNAL_ERROR', 'Erro interno no servidor. Se persistir, informe o código de suporte.', {
      requestId,
    }),
  )
}
