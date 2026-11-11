import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'

function loadLocalEnv() {
  const path = [resolve(process.cwd(), '.env'), resolve(process.cwd(), '../.env'), resolve(process.cwd(), '../../.env')].find((file) => existsSync(file))
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

export function getSupabaseAdmin(): SupabaseClient | null {
  if (client !== undefined) return client
  const url = process.env.SUPABASE_URL?.trim()
  const key =
    process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() ||
    (process.env.NODE_ENV !== 'production' ? process.env.SUPABASE_ANON_KEY?.trim() : undefined)
  if (!url || !key) {
    client = null
    return client
  }
  if (key.startsWith('sb_publishable_')) {
    console.warn(
      '[supabase] SUPABASE_SERVICE_ROLE_KEY está com a chave pública. O banco esconde catálogo, loja e glossário. No painel do Supabase, em Project Settings → API Keys, copie a secret key e coloque no .env.',
    )
  }
  client = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } })
  return client
}

export function isSupabasePersistenceEnabled() {
  return getSupabaseAdmin() !== null
}
