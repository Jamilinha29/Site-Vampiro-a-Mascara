import { randomUUID } from 'node:crypto'
import type { NextFunction, Request, Response } from 'express'

declare global {
  namespace Express {
    interface Request {
      requestId?: string
    }
  }
}

function sanitizePath(rawUrl: string) {
  const qIndex = rawUrl.indexOf('?')
  if (qIndex < 0) return rawUrl
  const base = rawUrl.slice(0, qIndex)
  const params = new URLSearchParams(rawUrl.slice(qIndex + 1))
  const safeKeys = ['category', 'tier', 'kind', 'class', 'path', 'preview', 'limit', 'offset']
  const kept = new URLSearchParams()
  for (const key of safeKeys) {
    const val = params.get(key)
    if (val !== null) kept.set(key, val)
  }
  const qs = kept.toString()
  return qs ? `${base}?${qs}` : base
}

function resolveRequestId(req: Request) {
  const raw = req.headers['x-request-id']
  const value = typeof raw === 'string' ? raw.trim() : ''
  if (value && /^[A-Za-z0-9._-]{8,64}$/.test(value)) return value
  return randomUUID()
}

export function requestLogger(req: Request, res: Response, next: NextFunction) {
  const start = Date.now()
  const requestId = resolveRequestId(req)
  req.requestId = requestId
  res.setHeader('X-Request-Id', requestId)

  res.on('finish', () => {
    if (process.env.NODE_ENV === 'test') return
    const status = res.statusCode
    const category =
      status >= 500
        ? 'server_error'
        : status === 401 || status === 403
          ? 'auth_error'
          : status === 409
            ? 'conflict'
            : status >= 400
              ? 'client_error'
              : 'ok'
    const payload = {
      level: status >= 500 ? 'error' : status >= 400 ? 'warn' : 'info',
      requestId,
      method: req.method,
      path: sanitizePath(req.originalUrl || req.url),
      status,
      category,
      durationMs: Date.now() - start,
    }
    console.log(JSON.stringify(payload))
  })
  next()
}
