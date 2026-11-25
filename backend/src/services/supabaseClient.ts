import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'

function loadLocalEnv() {
  if (process.env.NODE_ENV === 'test' && process.env.BELADONA_TEST_USE_ENV !== 'true') {
    return
  }
  const path = [
    resolve(process.cwd(), '.env'),
    resolve(process.cwd(), '../.env'),
    resolve(process.cwd(), '../../.env'),
  ].find((file) => existsSync(file))
  if (!path) return
  for (const line of readFileSync(path, 'utf8').split(/\r?\n/)) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const eq = trimmed.indexOf('=')
    if (eq <= 0) continue
    const key = trimmed.slice(0, eq).trim()
    let value = trimmed.slice(eq + 1).trim()
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1)
    }
    if (process.env[key] === undefined) process.env[key] = value
  }
}

loadLocalEnv()

let client: SupabaseClient | null | undefined

export function resetSupabaseClientForTests() {
  client = undefined
}

export function isSharedDeploymentEnvironment() {
  return Boolean(
    process.env.NODE_ENV === 'production' ||
      process.env.VERCEL === '1' ||
      process.env.VERCEL_ENV,
  )
}

export function validateStartupEnvironment(): { ok: boolean; warnings: string[]; errors: string[] } {
  const warnings: string[] = []
  const errors: string[] = []
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() ?? ''
  const anonKey = process.env.SUPABASE_ANON_KEY?.trim() ?? ''
  const url = process.env.SUPABASE_URL?.trim() ?? ''

  for (const [k, v] of Object.entries(process.env)) {
    if (!k.startsWith('VITE_') || !v) continue
    if (v.startsWith('sb_secret_') || (serviceKey && v === serviceKey)) {
      errors.push(`Variável pública ${k} contém chave privilegiada (sb_secret_). Remova imediatamente.`)
    }
  }

  if (anonKey.startsWith('sb_secret_')) {
    errors.push('SUPABASE_ANON_KEY contém chave secreta (sb_secret_). Use a chave pública/anon.')
  }
  if (serviceKey.startsWith('sb_publishable_')) {
    warnings.push('SUPABASE_SERVICE_ROLE_KEY está configurada com chave pública (sb_publishable_).')
  }

  if (isSharedDeploymentEnvironment()) {
    if (!url || !anonKey) {
      errors.push('SUPABASE_URL e SUPABASE_ANON_KEY são obrigatórias em ambiente publicado.')
    }
    if (!serviceKey) {
      warnings.push('SUPABASE_SERVICE_ROLE_KEY não definida em ambiente publicado; persistência durável ficará indisponível.')
    }
  }

  for (const w of warnings) console.warn(`[env] ${w}`)
  for (const e of errors) console.error(`[env] ${e}`)

  return { ok: errors.length === 0, warnings, errors }
}

export function getSupabaseAdmin(): SupabaseClient | null {
  if (client !== undefined) return client
  const url = process.env.SUPABASE_URL?.trim()
  const key =
    process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() ||
    (!isSharedDeploymentEnvironment() && process.env.NODE_ENV !== 'test'
      ? process.env.SUPABASE_ANON_KEY?.trim()
      : undefined)
  if (!url || !key) {
    client = null
    return client
  }
  if (key.startsWith('sb_publishable_')) {
    console.warn(
      '[supabase] SUPABASE_SERVICE_ROLE_KEY está com a chave pública. Use a secret/service_role key.',
    )
  }
  client = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } })
  return client
}

export function isSupabasePersistenceEnabled() {
  return getSupabaseAdmin() !== null
}
