import { createClient } from '@supabase/supabase-js'
import { Router } from 'express'
import { z } from 'zod'
import { errorPayload } from '../services/errors.js'
import {
  RECOVERY_PUBLIC_MESSAGE,
  confirmPasswordRecovery,
  getRecoveryCapabilities,
  requestPasswordRecovery,
} from '../services/passwordRecovery.js'
import { ensureProfile } from '../services/profileStore.js'
import { checkSharedRateLimit } from '../services/rateLimitStore.js'
import {
  allowDevAuth,
  devLogin,
  isSupabaseAuthConfigured,
  loginWithSupabase,
  registerWithSupabase,
} from '../services/supabaseAuth.js'

export const authRouter = Router()

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8).max(200),
})

const registerSchema = z.object({
  displayName: z.string().trim().min(2).max(80),
  email: z.string().email(),
  password: z.string().min(8).max(200),
  preferredClanId: z.union([z.string().uuid(), z.null(), z.literal('')]).optional(),
  termsAccepted: z.literal(true),
  marketingOptIn: z.boolean().optional(),
})

authRouter.get('/recovery-status', (_req, res) => {
  res.json(getRecoveryCapabilities())
})

authRouter.post('/login', async (req, res, next) => {
  try {
    const body = loginSchema.parse(req.body)
    if (!allowDevAuth() && !isSupabaseAuthConfigured()) {
      res.status(503).json(
        errorPayload('SERVICE_UNAVAILABLE', 'Autenticação não configurada neste servidor.', {
          requestId: req.requestId,
        }),
      )
      return
    }
    if (isSupabaseAuthConfigured()) {
      const result = await loginWithSupabase(body.email, body.password)
      if (!result.ok) {
        res.status(401).json(errorPayload('UNAUTHORIZED', result.message, { requestId: req.requestId }))
        return
      }
      await ensureProfile(result.session.email, result.session.displayName)
      res.json(result.session)
      return
    }
    const session = devLogin(body.email, body.email.split('@')[0] ?? 'Cainita')
    await ensureProfile(session.email, session.displayName)
    res.json(session)
  } catch (e) {
    next(e)
  }
})

authRouter.post('/register', async (req, res, next) => {
  try {
    const body = registerSchema.parse(req.body)
    if (!allowDevAuth() && !isSupabaseAuthConfigured()) {
      res.status(503).json(
        errorPayload('SERVICE_UNAVAILABLE', 'Autenticação não configurada neste servidor.', {
          requestId: req.requestId,
        }),
      )
      return
    }
    if (isSupabaseAuthConfigured()) {
      const result = await registerWithSupabase(body.email, body.password, body.displayName)
      if (!result.ok) {
        const status = result.pendingConfirmation ? 202 : 400
        res.status(status).json(
          errorPayload(result.pendingConfirmation ? 'PENDING_CONFIRMATION' : 'VALIDATION_ERROR', result.message, {
            requestId: req.requestId,
          }),
        )
        return
      }
      await ensureProfile(result.session.email, result.session.displayName)
      res.status(201).json(result.session)
      return
    }
    const session = devLogin(body.email, body.displayName)
    await ensureProfile(session.email, session.displayName)
    res.status(201).json(session)
  } catch (e) {
    next(e)
  }
})

authRouter.post('/recover', async (req, res, next) => {
  try {
    const body = z.object({ email: z.string().email() }).parse(req.body)
    const rl = await checkSharedRateLimit(`recover:${req.ip}:${body.email.trim().toLowerCase()}`, 10 * 60_000, 6)
    if (!rl.allowed) {
      res.setHeader('Retry-After', String(rl.retryAfterSec))
      res.status(429).json(
        errorPayload('RATE_LIMITED', 'Muitas tentativas seguidas. Espere alguns minutos.', {
          requestId: req.requestId,
        }),
      )
      return
    }
    await requestPasswordRecovery(body.email)
    res.json({ message: RECOVERY_PUBLIC_MESSAGE })
  } catch (e) {
    next(e)
  }
})

authRouter.post('/recover/confirm', async (req, res, next) => {
  try {
    const body = z
      .object({
        token: z.string().min(10).optional(),
        tokenHash: z.string().min(10).optional(),
        password: z.string().min(8).max(72),
      })
      .refine((v) => Boolean(v.token || v.tokenHash), {
        message: 'Token de recuperação obrigatório.',
      })
      .parse(req.body)
    const result = await confirmPasswordRecovery(
      body.tokenHash || body.token!,
      body.password,
      body.tokenHash ? { type: 'token_hash' } : { type: 'token' },
    )
    if (!result.ok) {
      res.status(400).json(errorPayload('RECOVERY_INVALID', result.message, { requestId: req.requestId }))
      return
    }
    res.json({ message: 'Selo novo gravado. Entre com ele.' })
  } catch (e) {
    next(e)
  }
})

authRouter.post('/refresh', async (req, res, next) => {
  try {
    const body = z.object({ refreshToken: z.string().min(10) }).parse(req.body)
    if (!isSupabaseAuthConfigured()) {
      res.status(401).json(errorPayload('UNAUTHORIZED', 'Sessão encerrada. Entre de novo.', { requestId: req.requestId }))
      return
    }
    const sb = createClient(process.env.SUPABASE_URL!.trim(), process.env.SUPABASE_ANON_KEY!.trim(), {
      auth: { persistSession: false, autoRefreshToken: false },
    })
    const { data, error } = await sb.auth.refreshSession({ refresh_token: body.refreshToken })
    if (error || !data.session) {
      res.status(401).json(errorPayload('UNAUTHORIZED', 'Sessão encerrada. Entre de novo.', { requestId: req.requestId }))
      return
    }
    res.json({
      accessToken: data.session.access_token,
      refreshToken: data.session.refresh_token,
      expiresAt: data.session.expires_at ?? undefined,
    })
  } catch (e) {
    next(e)
  }
})
