import type { NextFunction, Request, Response } from 'express'

export function requestLogger(req: Request, res: Response, next: NextFunction) {
  const start = Date.now()
  res.on('finish', () => {
    if (process.env.NODE_ENV === 'test') return
    const payload = {
      level: res.statusCode >= 500 ? 'error' : 'info',
      method: req.method,
      path: req.originalUrl,
      status: res.statusCode,
      durationMs: Date.now() - start,
    }
    console.log(JSON.stringify(payload))
  })
  next()
}
