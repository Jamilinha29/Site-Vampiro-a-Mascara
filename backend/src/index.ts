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
import { errorHandler } from './middlewares/errorHandler.js'
import { hydrateEntitiesFromDatabase } from './services/chronicleStore.js'

const app = express()
const port = Number(process.env.PORT ?? 4000)

app.use(helmet())
app.use(
  cors({
    origin: process.env.CORS_ORIGIN?.split(',') ?? ['http://localhost:5173'],
    credentials: true,
  }),
)
app.use(express.json({ limit: '1mb' }))
app.use('/api/v1/auth', rateLimit({ windowMs: 15 * 60 * 1000, max: 100 }), authRouter)
app.use('/api/v1/registrations', rateLimit({ windowMs: 60 * 1000, max: 20 }), registrationsRouter)

app.get('/health', (_req, res) => {
  res.json({ ok: true, service: 'beladona-api' })
})

app.use('/api/v1/catalog', catalogRouter)
app.use('/api/v1/me', meRouter)
app.use('/api/v1/admin/chronicle', adminChronicleRouter)
app.use('/api/v1/content', contentRouter)
app.use('/api/v1/news', newsRouter)
app.use('/api/v1/notifications', notificationsRouter)
app.use('/api/v1/sessions', sessionsRouter)
app.use('/api/v1/wallets', walletsRouter)

app.use(errorHandler)

if (process.env.NODE_ENV !== 'test') {
  void hydrateEntitiesFromDatabase().finally(() => {
    app.listen(port, '0.0.0.0', () => {
      console.log(`Beladona API listening on ${port}`)
    })
  })
}

export { app }
