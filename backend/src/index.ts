import './services/supabaseClient.js'
import cors from 'cors'
import express from 'express'
import rateLimit from 'express-rate-limit'
import helmet from 'helmet'
import { errorHandler } from './middlewares/errorHandler.js'
import { requestLogger } from './middlewares/requestLogger.js'
import { adminChronicleRouter } from './routes/admin/chronicle.js'
import { adminReferenceRouter } from './routes/admin/referenceCatalog.js'
import { authRouter } from './routes/auth.js'
import { catalogRouter } from './routes/catalog.js'
import { contentRouter } from './routes/content.js'
import { courtRouter } from './routes/court.js'
import { meRouter } from './routes/me.js'
import { newsRouter } from './routes/news.js'
import { notificationsRouter } from './routes/notifications.js'
import { registrationsRouter } from './routes/registrations.js'
import { sessionsRouter } from './routes/sessions.js'
import { walletsRouter } from './routes/wallets.js'
import { hydrateCampaignExtras } from './services/campaignExtras.js'
import { primeDocumentsCache } from './services/campaignDocuments.js'
import { hydrateEntitiesFromDatabase, hydrateSessions } from './services/chronicleStore.js'
import { hydrateCourt } from './services/courtStore.js'
import { errorPayload } from './services/errors.js'
import { hydrateIdempotencyStore } from './services/idempotencyStore.js'
import { ensureMediaBuckets } from './services/mediaStorage.js'
import { hydrateNotices } from './services/notificationStore.js'
import { hydrateOperations } from './services/operationLog.js'
import { hydrateProfiles } from './services/profileStore.js'
import { hydrateReferenceCatalog } from './services/referenceCatalog.js'
import { hydrateRolls } from './services/sessionRolls.js'
import { hydrateShop } from './services/shopStore.js'
import {
  getSupabaseAdmin,
  isSupabasePersistenceEnabled,
  validateStartupEnvironment,
} from './services/supabaseClient.js'

const app = express()
app.set('trust proxy', 1)
const port = Number(process.env.PORT ?? 4000)

app.use(helmet())
app.use(requestLogger)
app.use(
  cors({
    origin: process.env.CORS_ORIGIN?.split(',').map((s) => s.trim()).filter(Boolean) ?? [
      'http://localhost:5173',
    ],
    credentials: true,
  }),
)
app.use(express.json({ limit: '4mb' }))
app.use('/api/v1/auth', rateLimit({ windowMs: 15 * 60 * 1000, max: 100 }), authRouter)
app.use('/api/v1/registrations', rateLimit({ windowMs: 60 * 1000, max: 20 }), registrationsRouter)

let readyError: unknown = null

const STARTUP_DOCUMENT_IDS = [
  'profiles',
  'character-revisions',
  'sessions',
  'session-actions',
  'court',
  'shop',
  'idempotency-ops',
  'notices',
  'notification-reads',
  'operations',
  'rolls',
  'campaign-board',
  'mesa-secrets',
  'player-filters',
  'campaign-rules',
  'backup-metadata',
] as const

async function initializeBackend() {
  const envCheck = validateStartupEnvironment()
  for (const warning of envCheck.warnings) {
    console.warn(`[startup] ${warning}`)
  }
  if (!envCheck.ok) {
    throw new Error(envCheck.errors.join(' | '))
  }
  if (process.env.NODE_ENV === 'test') {
    return
  }
  await primeDocumentsCache(STARTUP_DOCUMENT_IDS)
  await Promise.all([
    hydrateEntitiesFromDatabase(),
    hydrateReferenceCatalog(),
    ensureMediaBuckets(),
    hydrateProfiles(),
    hydrateSessions(),
    hydrateCourt(),
    hydrateShop(),
    hydrateIdempotencyStore(),
    hydrateNotices(),
    hydrateOperations(),
    hydrateRolls(),
    hydrateCampaignExtras(),
  ])
}

export const ready = initializeBackend().catch((err) => {
  readyError = err
  console.error('[startup] falha na inicialização:', err instanceof Error ? err.message : err)
  throw err
})

app.get('/health', (_req, res) => {
  res.json({ ok: true, service: 'beladona-api' })
})

app.get('/ready', async (req, res) => {
  try {
    if (readyError) throw readyError
    await ready
    const supabase = isSupabasePersistenceEnabled()
    if (supabase) {
      const admin = getSupabaseAdmin()
      const checkPromise = admin!.from('EntidadesCronica').select('id').limit(1)
      let timer: ReturnType<typeof setTimeout> | undefined
      const timeoutPromise = new Promise<{ error: Error }>((_, reject) => {
        timer = setTimeout(() => reject(new Error('Supabase readiness timeout')), 5000)
      })
      try {
        const { error } = (await Promise.race([checkPromise, timeoutPromise])) as { error: unknown }
        if (error) throw error
      } finally {
        if (timer) clearTimeout(timer)
      }
    }
    res.json({ ok: true, supabase })
  } catch {
    res.status(503).json({
      ok: false,
      ...errorPayload('SERVICE_UNAVAILABLE', 'Dependências temporariamente indisponíveis.', {
        requestId: req.requestId,
      }),
    })
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

if (standalone) {
  void ready
    .then(() => {
      app.listen(port, '0.0.0.0', () => {
        console.log(`Beladona API listening on ${port}`)
      })
    })
    .catch((err) => {
      console.error('[startup] encerrando por configuração inválida:', err instanceof Error ? err.message : err)
      process.exit(1)
    })
}

export { app }
