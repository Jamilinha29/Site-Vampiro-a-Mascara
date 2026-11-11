import serverless from 'serverless-http'
import { app, ready } from '../backend/dist/index.js'

type ServerlessHandler = ReturnType<typeof serverless>

let sls: ServerlessHandler | undefined

/** Vercel serverless: mesma instância Express da API local. */
export default async function handler(req: unknown, res: unknown) {
  process.env.VERCEL = process.env.VERCEL ?? '1'
  try {
    await ready
    sls ??= serverless(app)
    return sls(req as Parameters<ServerlessHandler>[0], res as Parameters<ServerlessHandler>[1])
  } catch (err) {
    console.error('[api] handler failed', err)
    const message = err instanceof Error ? err.message : 'API initialization failed'
    const resLike = res as { statusCode?: number; setHeader?: (k: string, v: string) => void; end?: (b: string) => void }
    if (typeof resLike.statusCode === 'number') {
      resLike.statusCode = 500
      resLike.setHeader?.('content-type', 'application/json')
      resLike.end?.(JSON.stringify({ error: { message } }))
      return
    }
    throw err
  }
}
