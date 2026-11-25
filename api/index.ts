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
    console.error('[api] handler failed:', err instanceof Error ? err.message : err)
    const resLike = res as { statusCode?: number; setHeader?: (k: string, v: string) => void; end?: (b: string) => void }
    if (typeof resLike.statusCode === 'number') {
      resLike.statusCode = 503
      resLike.setHeader?.('content-type', 'application/json')
      resLike.end?.(
        JSON.stringify({
          error: {
            code: 'SERVICE_UNAVAILABLE',
            message: 'Serviço temporariamente indisponível.',
          },
        }),
      )
      return
    }
    throw err
  }
}
