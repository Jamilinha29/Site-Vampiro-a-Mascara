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
import { hydrateOperations } from './services/operationLog.js'
import { hydrateRolls } from './services/sessionRolls.js'
import { hydrateCampaignExtras } from './services/campaignExtras.js'
import { hydrateShopOperations } from './services/shopPurchase.js'
import { hydrateShop } from './services/shopStore.js'
import { ensureMediaBuckets } from './services/mediaStorage.js'
import { adminReferenceRouter } from './routes/admin/referenceCatalog.js'
import { hydrateReferenceCatalog } from './services/referenceCatalog.js'
import { getSupabaseAdmin, isSupabasePersistenceEnabled } from './services/supabaseClient.js'

const app = express()
const port = Number(process.env.PORT ?? 4000)

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
  const waitThen = (write: () => void) => {
    if (armed || res.headersSent) {
      write()
      return
    }
    armed = true
    void flushDurableState().then(write, (err: unknown) => {
      if (res.headersSent) return
      const message = err instanceof Error ? err.message : 'Não foi possível gravar o estado da campanha.'
      originalJson({ error: { message } })
    })
  }
  res.json = (body) => {
    waitThen(() => {
      originalJson(body)
    })
    return res
  }
  res.send = (body) => {
    waitThen(() => {
      originalSend(body)
    })
    return res
  }
  next()
})
app.use('/api/v1/auth', rateLimit({ windowMs: 15 * 60 * 1000, max: 100 }), authRouter)
app.use('/api/v1/registrations', rateLimit({ windowMs: 60 * 1000, max: 20 }), registrationsRouter)

app.get('/health', (_req, res) => {
  res.json({ ok: true })
})

app.get('/ready', async (_req, res) => {
  try {
    await ready
    const supabase = isSupabasePersistenceEnabled()
    if (supabase) {
      const admin = getSupabaseAdmin()
      const { error } = await admin!.from('EntidadesCronica').select('id').limit(1)
      if (error) throw error
    }
    res.json({ ok: true, supabase })
  } catch {
    res.status(503).json({ ok: false })
  }
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
/** Em testes nunca abre porta (evita EADDRINUSE no CI e com `dev:api` local). */
const standalone =
  process.env.NODE_ENV !== 'test' &&
  (process.env.RUN_STANDALONE === 'true' || !isServerless)

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
        hydrateOperations(),
        hydrateRolls(),
        hydrateCampaignExtras(),
      ])

if (standalone) {
  void ready.finally(() => {
    app.listen(port, '0.0.0.0', () => {
      console.log(`Beladona API listening on ${port}`)
    })
  })
}

export { app }
