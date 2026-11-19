import { Router } from 'express'
import { z } from 'zod'
import { createClient } from '@supabase/supabase-js'
import {
  allowDevAuth,
  devLogin,
  isSupabaseAuthConfigured,
  loginWithSupabase,
  registerWithSupabase,
} from '../services/supabaseAuth.js'
import {
  RECOVERY_PUBLIC_MESSAGE,
  confirmPasswordRecovery,
  requestPasswordRecovery,
} from '../services/passwordRecovery.js'

export const authRouter = Router()

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
})

const registerSchema = z.object({
  displayName: z.string().min(2),
  email: z.string().email(),
  password: z.string().min(8),
  preferredClanId: z.union([z.string().uuid(), z.null(), z.literal('')]).optional(),
  termsAccepted: z.literal(true),
  marketingOptIn: z.boolean().optional(),
})

authRouter.post('/login', async (req, res, next) => {
  try {
    const body = loginSchema.parse(req.body)
    if (!allowDevAuth() && !isSupabaseAuthConfigured()) {
      res.status(503).json({ error: { message: 'Autenticação não configurada neste servidor.' } })
      return
    }
    if (isSupabaseAuthConfigured()) {
      const result = await loginWithSupabase(body.email, body.password)
      if (!result.ok) {
        res.status(401).json({ error: { message: result.message } })
        return
      }
      res.json(result.session)
      return
    }
    res.json(devLogin(body.email, body.email.split('@')[0] ?? 'Cainita'))
  } catch (e) {
    next(e)
  }
})

authRouter.post('/register', async (req, res, next) => {
  try {
    const body = registerSchema.parse(req.body)
    if (!allowDevAuth() && !isSupabaseAuthConfigured()) {
      res.status(503).json({ error: { message: 'Autenticação não configurada neste servidor.' } })
      return
    }
    if (isSupabaseAuthConfigured()) {
      const result = await registerWithSupabase(body.email, body.password, body.displayName)
      if (!result.ok) {
        const status = result.pendingConfirmation ? 202 : 400
        res.status(status).json({ error: { message: result.message } })
        return
      }
      res.status(201).json(result.session)
      return
    }
    res.status(201).json(devLogin(body.email, body.displayName))
  } catch (e) {
    next(e)
  }
})

authRouter.post('/recover', async (req, res, next) => {
  try {
    const body = z.object({ email: z.string().email() }).parse(req.body)
    await requestPasswordRecovery(body.email)
    res.json({ message: RECOVERY_PUBLIC_MESSAGE })
  } catch (e) {
    next(e)
  }
})

authRouter.post('/recover/confirm', async (req, res, next) => {
  try {
    const body = z
      .object({ token: z.string().min(20), password: z.string().min(8).max(72) })
      .parse(req.body)
    const result = await confirmPasswordRecovery(body.token, body.password)
    if (!result.ok) {
      res.status(400).json({ error: { message: result.message } })
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
      res.status(401).json({ error: { message: 'Sessão encerrada. Entre de novo.' } })
      return
    }
    const sb = createClient(process.env.SUPABASE_URL!.trim(), process.env.SUPABASE_ANON_KEY!.trim(), {
      auth: { persistSession: false, autoRefreshToken: false },
    })
    const { data, error } = await sb.auth.refreshSession({ refresh_token: body.refreshToken })
    if (error || !data.session) {
      res.status(401).json({ error: { message: 'Sessão encerrada. Entre de novo.' } })
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
