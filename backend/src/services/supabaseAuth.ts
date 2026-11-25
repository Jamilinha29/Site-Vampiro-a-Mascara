import { createHash } from 'node:crypto'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import type { RequestUser } from '../middlewares/optionalUser.js'
import { devRoleForEmail, signDevToken, type DevRole } from './devAuth.js'
import { ensureProfile, getProfile } from './profileStore.js'
import { isSharedDeploymentEnvironment } from './supabaseClient.js'

const AUTH_CACHE_TTL_MS = 60_000
const MAX_AUTH_CACHE_ENTRIES = 500

let anonClient: SupabaseClient | null = null
let anonClientKey = ''
const authTokenCache = new Map<string, { user: RequestUser; expiresAt: number }>()
const inFlightAuth = new Map<string, Promise<RequestUser | null>>()

export function resetAuthCacheForTests() {
  anonClient = null
  anonClientKey = ''
  authTokenCache.clear()
  inFlightAuth.clear()
}

export function getSupabaseAnonClient(): SupabaseClient | null {
  if (!isSupabaseAuthConfigured()) return null
  const url = process.env.SUPABASE_URL!.trim()
  const anon = process.env.SUPABASE_ANON_KEY!.trim()
  const key = `${url}|${anon}`
  if (anonClient && anonClientKey === key) return anonClient
  anonClient = createClient(url, anon, { auth: { persistSession: false, autoRefreshToken: false } })
  anonClientKey = key
  return anonClient
}

function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex')
}

function jwtExpMs(token: string): number | null {
  const parts = token.split('.')
  if (parts.length !== 3) return null
  try {
    const payload = JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf8')) as { exp?: unknown }
    return typeof payload.exp === 'number' && Number.isFinite(payload.exp) ? payload.exp * 1000 : null
  } catch {
    return null
  }
}

export function isSupabaseAuthConfigured() {
  const url = process.env.SUPABASE_URL?.trim()
  const anon = process.env.SUPABASE_ANON_KEY?.trim()
  if (url && !anon) {
    console.warn(
      '[auth] SUPABASE_URL definido mas falta SUPABASE_ANON_KEY (chave pública). O login do Supabase fica desligado até corrigir o .env.',
    )
    return false
  }
  if (anon?.startsWith('sb_secret_')) {
    console.error(
      '[auth] SUPABASE_ANON_KEY inválida (sb_secret_). Por segurança, o uso de secret como chave anon foi recusado.',
    )
    return false
  }
  return Boolean(url && anon)
}

export function allowDevAuth() {
  if (isSharedDeploymentEnvironment()) return false
  if (process.env.ALLOW_DEV_AUTH === 'false') return false
  if (process.env.NODE_ENV === 'test') return true
  return process.env.ALLOW_DEV_AUTH === 'true'
}

function emailList(envName: string) {
  return (process.env[envName] ?? '')
    .split(',')
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean)
}

/** Papel de mestre/admin só vem do servidor: lista ADMIN_EMAILS/NARRATOR_EMAILS ou app_metadata. */
export function roleFromSupabaseUser(email: string, appMeta: Record<string, unknown>): DevRole {
  const key = email.trim().toLowerCase()
  if (emailList('ADMIN_EMAILS').includes(key)) return 'admin'
  if (emailList('NARRATOR_EMAILS').includes(key)) return 'narrator'
  const raw = appMeta.role
  if (raw === 'admin' || raw === 'narrator') return raw
  return 'player'
}

function resolveDevUser(token: string): RequestUser | null {
  if (!token.startsWith('dev-') || !allowDevAuth()) return null
  try {
    const email = Buffer.from(token.slice(4), 'base64url').toString('utf8').trim().toLowerCase()
    if (!email || !email.includes('@') || /\s/.test(email)) return null
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

  if (token.startsWith('dev-')) {
    return resolveDevUser(token)
  }

  const sb = getSupabaseAnonClient()
  if (!sb) return null

  const tokenExp = jwtExpMs(token)
  if (tokenExp !== null && tokenExp <= Date.now()) {
    return null
  }

  const cacheKey = hashToken(token)
  const cached = authTokenCache.get(cacheKey)
  if (cached && cached.expiresAt > Date.now()) {
    const latestName = getProfile(cached.user.email)?.displayName
    return latestName && latestName !== cached.user.displayName
      ? { ...cached.user, displayName: latestName }
      : cached.user
  }
  if (cached) authTokenCache.delete(cacheKey)

  const existing = inFlightAuth.get(cacheKey)
  if (existing) return existing

  const lookup = (async (): Promise<RequestUser | null> => {
    const { data, error } = await sb.auth.getUser(token)
    if (error || !data.user?.email) return null

    const email = data.user.email
    const meta = (data.user.user_metadata ?? {}) as Record<string, unknown>
    const appMeta = (data.user.app_metadata ?? {}) as Record<string, unknown>
    const role = roleFromSupabaseUser(email, appMeta)
    const existingProfile = getProfile(email)
    const displayName =
      existingProfile?.displayName ||
      (typeof meta.display_name === 'string' && meta.display_name) ||
      (typeof meta.displayName === 'string' && meta.displayName) ||
      (typeof meta.full_name === 'string' && meta.full_name) ||
      (typeof meta.name === 'string' && meta.name) ||
      email.split('@')[0] ||
      'Cainita'

    await ensureProfile(email, displayName, role, { authoritative: true })
    const resolved: RequestUser = {
      userId: data.user.id,
      email,
      displayName,
      role,
    }

    const ttlUntil = Date.now() + AUTH_CACHE_TTL_MS
    const expiresAt = tokenExp !== null ? Math.min(ttlUntil, tokenExp) : ttlUntil
    if (expiresAt > Date.now()) {
      if (authTokenCache.size >= MAX_AUTH_CACHE_ENTRIES) {
        const oldestKey = authTokenCache.keys().next().value
        if (oldestKey) authTokenCache.delete(oldestKey)
      }
      authTokenCache.set(cacheKey, { user: resolved, expiresAt })
    }
    return resolved
  })().finally(() => {
    inFlightAuth.delete(cacheKey)
  })

  inFlightAuth.set(cacheKey, lookup)
  return lookup
}

export async function loginWithSupabase(email: string, password: string) {
  const sb = getSupabaseAnonClient()
  if (!sb) return { ok: false as const, message: 'Autenticação indisponível.' }
  const { data, error } = await sb.auth.signInWithPassword({ email, password })
  if (error || !data.session || !data.user.email) {
    return { ok: false as const, message: error?.message ?? 'Correio ou senha recusados.' }
  }
  const role = roleFromSupabaseUser(data.user.email, (data.user.app_metadata ?? {}) as Record<string, unknown>)
  const displayName =
    (typeof data.user.user_metadata?.display_name === 'string' && data.user.user_metadata.display_name) ||
    (typeof data.user.user_metadata?.displayName === 'string' && data.user.user_metadata.displayName) ||
    email.split('@')[0] ||
    'Cainita'
  await ensureProfile(data.user.email, displayName, role, { authoritative: true })
  return {
    ok: true as const,
    session: {
      accessToken: data.session.access_token,
      refreshToken: data.session.refresh_token,
      expiresAt: data.session.expires_at ?? undefined,
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
  const sb = getSupabaseAnonClient()
  if (!sb) return { ok: false as const, message: 'Autenticação indisponível.' }
  const { data, error } = await sb.auth.signUp({
    email,
    password,
    options: {
      data: { display_name: displayName, displayName },
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
  const role = roleFromSupabaseUser(data.user.email, (data.user.app_metadata ?? {}) as Record<string, unknown>)
  await ensureProfile(data.user.email, displayName, role, { authoritative: true })
  return {
    ok: true as const,
    session: {
      accessToken: data.session.access_token,
      refreshToken: data.session.refresh_token,
      expiresAt: data.session.expires_at ?? undefined,
      userId: data.user.id,
      email: data.user.email,
      displayName,
      role,
    },
  }
}

export function devLogin(email: string, displayName: string) {
  if (!allowDevAuth()) {
    throw new Error('Autenticação de desenvolvimento bloqueada neste ambiente.')
  }
  const role = devRoleForEmail(email)
  void ensureProfile(email, displayName, role)
  return signDevToken(email, displayName, role)
}
