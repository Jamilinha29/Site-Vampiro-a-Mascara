import { runExclusive } from './campaignDocuments.js'
import { getSupabaseAdmin } from './supabaseClient.js'

const localWindows = new Map<string, { count: number; since: number }>()
const SCHEMA_RETRY_COOLDOWN_MS = 10 * 60_000
let rateLimitRpcUnavailableUntil = 0

export function resetRateLimitsForTests() {
  localWindows.clear()
  rateLimitRpcUnavailableUntil = 0
}

/**
 * Limitador compartilhado para tentativas de entrada/descoberta de código (C11).
 * Usa RPC PostgreSQL `beladona_check_rate_limit` quando Supabase está ativo; fallback em memória em dev/test.
 */
export async function checkSharedRateLimit(
  key: string,
  windowMs: number,
  maxTries: number,
): Promise<{ allowed: boolean; remaining: number; retryAfterSec: number }> {
  const sb = getSupabaseAdmin()
  if (
    sb &&
    Date.now() >= rateLimitRpcUnavailableUntil &&
    (process.env.NODE_ENV !== 'test' || process.env.BELADONA_TEST_USE_ENV === 'true')
  ) {
    const { data, error } = await sb.rpc('beladona_check_rate_limit', {
      p_key: key,
      p_window_ms: windowMs,
      p_max_tries: maxTries,
    })
    if (error) {
      if (
        error.code === 'PGRST202' ||
        /beladona_check_rate_limit|schema cache|does not exist|could not find the function/i.test(error.message)
      ) {
        rateLimitRpcUnavailableUntil = Date.now() + SCHEMA_RETRY_COOLDOWN_MS
      }
    } else if (Array.isArray(data) && data[0]) {
      const row = data[0] as { allowed: boolean; remaining: number; retry_after_sec: number }
      return {
        allowed: Boolean(row.allowed),
        remaining: Number(row.remaining ?? 0),
        retryAfterSec: Number(row.retry_after_sec ?? 0),
      }
    }
  }

  return runExclusive(`rl:${key}`, () => {
    const now = Date.now()
    const current = localWindows.get(key)
    const fresh = !current || now - current.since > windowMs ? { count: 0, since: now } : { ...current }
    if (fresh.count >= maxTries) {
      const retryAfterSec = Math.max(1, Math.ceil((windowMs - (now - fresh.since)) / 1000))
      return { allowed: false, remaining: 0, retryAfterSec }
    }
    fresh.count += 1
    localWindows.set(key, fresh)
    return { allowed: true, remaining: Math.max(0, maxTries - fresh.count), retryAfterSec: 0 }
  })
}

export async function resetSharedRateLimit(key: string): Promise<void> {
  localWindows.delete(key)
  const sb = getSupabaseAdmin()
  if (
    sb &&
    Date.now() >= rateLimitRpcUnavailableUntil &&
    (process.env.NODE_ENV !== 'test' || process.env.BELADONA_TEST_USE_ENV === 'true')
  ) {
    const { error } = await sb.rpc('beladona_reset_rate_limit', { p_key: key })
    if (
      error &&
      (error.code === 'PGRST202' ||
        /beladona_reset_rate_limit|schema cache|does not exist|could not find the function/i.test(error.message))
    ) {
      rateLimitRpcUnavailableUntil = Date.now() + SCHEMA_RETRY_COOLDOWN_MS
    }
  }
}
