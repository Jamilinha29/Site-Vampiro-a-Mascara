import type { NextFunction, Request, Response } from 'express'
import { devRoleForEmail } from '../services/devAuth.js'
import { getProfile } from '../services/profileStore.js'

export type RequestUser = {
  userId: string
  email: string
  displayName: string
  role: 'player' | 'narrator' | 'admin'
}

declare global {
  namespace Express {
    interface Request {
      user?: RequestUser
    }
  }
}

export function resolveUserFromToken(authHeader?: string): RequestUser | null {
  if (!authHeader?.startsWith('Bearer ')) return null
  const token = authHeader.slice(7)
  if (!token.startsWith('dev-')) return null
  try {
    const email = Buffer.from(token.slice(4), 'base64url').toString('utf8')
    if (!email.includes('@')) return null
    const profile = getProfile(email)
    const emailRole = devRoleForEmail(email)
    const storedRole = profile?.role
    const role =
      emailRole === 'admin' || emailRole === 'narrator'
        ? emailRole
        : storedRole === 'admin' || storedRole === 'narrator'
          ? storedRole
          : (storedRole ?? 'player')
    return {
      userId: email,
      email,
      displayName: profile?.displayName ?? email.split('@')[0] ?? 'Cainita',
      role,
    }
  } catch {
    return null
  }
}

export function requireUser(req: Request, res: Response, next: NextFunction) {
  const user = resolveUserFromToken(req.headers.authorization)
  if (!user) {
    res.status(401).json({ error: { message: 'Não autenticado' } })
    return
  }
  req.user = user
  next()
}
