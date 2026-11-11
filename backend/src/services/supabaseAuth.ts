import { createClient } from '@supabase/supabase-js'
import type { RequestUser } from '../middlewares/optionalUser.js'
import { devRoleForEmail, signDevToken, type DevRole } from './devAuth.js'
import { ensureProfile, getProfile } from './profileStore.js'

export function isSupabaseAuthConfigured() {
  const url = process.env.SUPABASE_URL?.trim()
  const anon = process.env.SUPABASE_ANON_KEY?.trim()
  return Boolean(url && anon)
}

function allowDevAuth() {
  if (process.env.ALLOW_DEV_AUTH === 'true') return true
  if (process.env.ALLOW_DEV_AUTH === 'false') return false
  if (process.env.NODE_ENV === 'test') return true
  return !isSupabaseAuthConfigured()
}

function roleFromSupabaseUser(email: string, metadata: Record<string, unknown>, appMeta: Record<string, unknown>): DevRole {
  const raw = metadata.role ?? appMeta.role
  if (raw === 'admin' || raw === 'narrator' || raw === 'player') return raw
  return devRoleForEmail(email)
}

function resolveDevUser(token: string): RequestUser | null {
  if (!token.startsWith('dev-') || !allowDevAuth()) return null
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

export async function resolveUserFromAuthHeader(authHeader?: string): Promise<RequestUser | null> {
  if (!authHeader?.startsWith('Bearer ')) return null
  const token = authHeader.slice(7).trim()
  if (!token) return null

  const devUser = resolveDevUser(token)
  if (devUser) return devUser

  if (!isSupabaseAuthConfigured()) return null

  const url = process.env.SUPABASE_URL!.trim()
  const anon = process.env.SUPABASE_ANON_KEY!.trim()
  const sb = createClient(url, anon, { auth: { persistSession: false, autoRefreshToken: false } })
  const { data, error } = await sb.auth.getUser(token)
  if (error || !data.user?.email) return null

  const email = data.user.email
  const meta = (data.user.user_metadata ?? {}) as Record<string, unknown>
  const appMeta = (data.user.app_metadata ?? {}) as Record<string, unknown>
  const role = roleFromSupabaseUser(email, meta, appMeta)
  const displayName =
    (typeof meta.display_name === 'string' && meta.display_name) ||
    (typeof meta.displayName === 'string' && meta.displayName) ||
    email.split('@')[0] ||
    'Cainita'

  ensureProfile(email, displayName, role)
  return {
    userId: data.user.id,
    email,
    displayName,
    role,
  }
}

export async function loginWithSupabase(email: string, password: string) {
  const url = process.env.SUPABASE_URL!.trim()
  const anon = process.env.SUPABASE_ANON_KEY!.trim()
  const sb = createClient(url, anon, { auth: { persistSession: false, autoRefreshToken: false } })
  const { data, error } = await sb.auth.signInWithPassword({ email, password })
  if (error || !data.session || !data.user.email) {
    return { ok: false as const, message: error?.message ?? 'Correio ou senha recusados.' }
  }
  const role = roleFromSupabaseUser(
    data.user.email,
    (data.user.user_metadata ?? {}) as Record<string, unknown>,
    (data.user.app_metadata ?? {}) as Record<string, unknown>,
  )
  const displayName =
    (typeof data.user.user_metadata?.display_name === 'string' && data.user.user_metadata.display_name) ||
    (typeof data.user.user_metadata?.displayName === 'string' && data.user.user_metadata.displayName) ||
    email.split('@')[0] ||
    'Cainita'
  ensureProfile(data.user.email, displayName, role)
  return {
    ok: true as const,
    session: {
      accessToken: data.session.access_token,
      userId: data.user.id,
      email: data.user.email,
      displayName,
      role,
    },
  }
}

export async function registerWithSupabase(
  email: string,
  password: string,
  displayName: string,
) {
  const url = process.env.SUPABASE_URL!.trim()
  const anon = process.env.SUPABASE_ANON_KEY!.trim()
  const role = devRoleForEmail(email)
  const sb = createClient(url, anon, { auth: { persistSession: false, autoRefreshToken: false } })
  const { data, error } = await sb.auth.signUp({
    email,
    password,
    options: {
      data: { display_name: displayName, displayName, role },
    },
  })
  if (error) return { ok: false as const, message: error.message }
  if (!data.session?.access_token || !data.user?.email) {
    return {
      ok: false as const,
      message: 'Conta criada. Confirme o e-mail no correio antes de entrar.',
      pendingConfirmation: true as const,
    }
  }
  ensureProfile(data.user.email, displayName, role)
  return {
    ok: true as const,
    session: {
      accessToken: data.session.access_token,
      userId: data.user.id,
      email: data.user.email,
      displayName,
      role,
    },
  }
}

export function devLogin(email: string, displayName: string) {
  const role = devRoleForEmail(email)
  ensureProfile(email, displayName, role)
  return signDevToken(email, displayName, role)
}
