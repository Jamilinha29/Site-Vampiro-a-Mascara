import { createClient, type SupabaseClient } from '@supabase/supabase-js'

let client: SupabaseClient | null = null

export function getSupabaseBrowser(): SupabaseClient | null {
  if (client) return client
  const url = (import.meta.env.VITE_SUPABASE_URL as string | undefined)?.trim()
  const anonKey = (import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined)?.trim()
  if (!url || !anonKey) return null
  if (anonKey.startsWith('sb_secret_')) {
    console.error('[auth] VITE_SUPABASE_ANON_KEY inválida: chave secreta detectada no navegador.')
    return null
  }
  client = createClient(url, anonKey, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
      flowType: 'pkce',
    },
  })
  return client
}

export function isSupabaseBrowserConfigured(): boolean {
  return Boolean(getSupabaseBrowser())
}
