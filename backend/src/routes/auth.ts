import { Router } from 'express'
import { z } from 'zod'
import {
  devLogin,
  isSupabaseAuthConfigured,
  loginWithSupabase,
  registerWithSupabase,
} from '../services/supabaseAuth.js'

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
