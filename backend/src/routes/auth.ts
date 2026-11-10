import { Router } from 'express'
import { z } from 'zod'
import { devRoleForEmail, signDevToken } from '../services/devAuth.js'
import { ensureProfile } from '../services/profileStore.js'

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

authRouter.post('/login', (req, res, next) => {
  try {
    const body = loginSchema.parse(req.body)
    const role = devRoleForEmail(body.email)
    const token = signDevToken(body.email, body.email.split('@')[0] ?? 'Cainita', role)
    ensureProfile(body.email, body.email.split('@')[0] ?? 'Cainita', role)
    res.json(token)
  } catch (e) {
    next(e)
  }
})

authRouter.post('/register', (req, res, next) => {
  try {
    const body = registerSchema.parse(req.body)
    const role = devRoleForEmail(body.email)
    const token = signDevToken(body.email, body.displayName, role)
    ensureProfile(body.email, body.displayName, role)
    res.status(201).json(token)
  } catch (e) {
    next(e)
  }
})
