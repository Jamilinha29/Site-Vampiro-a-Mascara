import serverless from 'serverless-http'
import { app, ready } from '../backend/src/index.js'

type ServerlessHandler = ReturnType<typeof serverless>

let sls: ServerlessHandler | undefined

/** Vercel serverless: mesma instância Express da API local. */
export default async function handler(req: unknown, res: unknown) {
  process.env.VERCEL = process.env.VERCEL ?? '1'
  await ready
  sls ??= serverless(app)
  return sls(req as Parameters<ServerlessHandler>[0], res as Parameters<ServerlessHandler>[1])
}
