import './services/supabaseClient.js'
import cors from 'cors'
import express from 'express'
import helmet from 'helmet'
import rateLimit from 'express-rate-limit'
import { authRouter } from './routes/auth.js'
import { adminChronicleRouter } from './routes/admin/chronicle.js'
import { contentRouter } from './routes/content.js'
import { catalogRouter } from './routes/catalog.js'
import { meRouter } from './routes/me.js'
import { newsRouter } from './routes/news.js'
import { notificationsRouter } from './routes/notifications.js'
import { registrationsRouter } from './routes/registrations.js'
import { sessionsRouter } from './routes/sessions.js'
import { walletsRouter } from './routes/wallets.js'
import { courtRouter } from './routes/court.js'
import { errorHandler } from './middlewares/errorHandler.js'
import { requestLogger } from './middlewares/requestLogger.js'
import { flushDurableState } from './services/campaignDocuments.js'
import { hydrateSessions, hydrateEntitiesFromDatabase } from './services/chronicleStore.js'
import { hydrateCourt } from './services/courtStore.js'
import { hydrateNotices } from './services/notificationStore.js'
import { hydrateProfiles } from './services/profileStore.js'
import { hydrateShopOperations } from './services/shopPurchase.js'
import { hydrateShop } from './services/shopStore.js'
import { ensureMediaBuckets } from './services/mediaStorage.js'
import { adminReferenceRouter } from './routes/admin/referenceCatalog.js'
import { hydrateReferenceCatalog } from './services/referenceCatalog.js'

const app = express()
const port = Number(process.env.PORT ?? 4000)
const startedAt = Date.now()

app.use(helmet())
app.use(requestLogger)
app.use(
  cors({
    origin: process.env.CORS_ORIGIN?.split(',') ?? ['http://localhost:5173'],
    credentials: true,
  }),
)
app.use(express.json({ limit: '2mb' }))
app.use((req, res, next) => {
  if (req.method === 'GET' || req.method === 'HEAD' || req.method === 'OPTIONS') {
    next()
    return
  }
  const originalJson = res.json.bind(res)
  const originalSend = res.send.bind(res)
  let armed = false
  const writeAfterSave = (write: (...args: never[]) => Response) =>
    ((...args: never[]) => {
      if (armed || res.headersSent) return write(...args)
      armed = true
      void flushDurableState().then(
        () => write(...args),
        (err: unknown) => {
          if (res.headersSent) return
          const message = err instanceof Error ? err.message : 'Não foi possível gravar o estado da campanha.'
          originalJson({ error: { message } })
        },
      )
      return res
    }) as typeof res.json
  res.json = writeAfterSave(originalJson as (...args: never[]) => Response)
  res.send = writeAfterSave(originalSend as (...args: never[]) => Response)
  next()
})
app.use('/api/v1/auth', rateLimit({ windowMs: 15 * 60 * 1000, max: 100 }), authRouter)
app.use('/api/v1/registrations', rateLimit({ windowMs: 60 * 1000, max: 20 }), registrationsRouter)

app.get('/health', (_req, res) => {
  res.json({
    ok: true,
    service: 'beladona-api',
    uptimeSec: Math.floor((Date.now() - startedAt) / 1000),
    version: process.env.npm_package_version ?? '0.1.0',
  })
})

app.use('/api/v1/catalog', catalogRouter)
app.use('/api/v1/me', meRouter)
app.use('/api/v1/admin/chronicle', adminChronicleRouter)
app.use('/api/v1/admin/reference', adminReferenceRouter)
app.use('/api/v1/content', contentRouter)
app.use('/api/v1/news', newsRouter)
app.use('/api/v1/notifications', notificationsRouter)
app.use('/api/v1/sessions', sessionsRouter)
app.use('/api/v1/wallets', walletsRouter)
app.use('/api/v1/court', courtRouter)

app.use(errorHandler)

const isServerless = Boolean(process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME)
const standalone =
  process.env.RUN_STANDALONE === 'true' || (process.env.NODE_ENV !== 'test' && !isServerless)

export const ready =
  process.env.NODE_ENV === 'test'
    ? Promise.resolve()
    : Promise.all([
        hydrateEntitiesFromDatabase(),
        hydrateReferenceCatalog(),
        ensureMediaBuckets(),
        hydrateProfiles(),
        hydrateSessions(),
        hydrateCourt(),
        hydrateShop(),
        hydrateShopOperations(),
        hydrateNotices(),
      ])

if (standalone) {
  void ready.finally(() => {
    app.listen(port, '0.0.0.0', () => {
      console.log(`Beladona API listening on ${port}`)
    })
  })
}

export { app }
