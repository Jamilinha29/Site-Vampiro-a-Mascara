import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import request from 'supertest'
import { app } from '../../backend/src/index.js'
import { signDevToken } from '../../backend/src/services/devAuth.js'
import { resetRateLimitsForTests } from '../../backend/src/services/rateLimitStore.js'
import { allowDevAuth, resolveUserFromAuthHeader, roleFromSupabaseUser } from '../../backend/src/services/supabaseAuth.js'
import { resetSupabaseClientForTests, validateStartupEnvironment } from '../../backend/src/services/supabaseClient.js'

const SAVED_ENV = { ...process.env }

function restoreEnv() {
  for (const key of Object.keys(process.env)) {
    if (!(key in SAVED_ENV)) delete process.env[key]
  }
  Object.assign(process.env, SAVED_ENV)
  resetSupabaseClientForTests()
}

describe('security, auth bypass & environment checks (T01-T04, T18)', () => {
  beforeEach(() => {
    resetRateLimitsForTests()
  })

  afterEach(() => {
    restoreEnv()
  })

  it('T01/T02: blocks dev auth and dev- tokens when NODE_ENV=production or VERCEL=1', async () => {
    process.env.NODE_ENV = 'production'
    expect(allowDevAuth()).toBe(false)

    const token = signDevToken('player@ci.local', 'Player').accessToken
    expect(await resolveUserFromAuthHeader(`Bearer ${token}`)).toBeNull()

    process.env.NODE_ENV = 'test'
    process.env.VERCEL = '1'
    expect(allowDevAuth()).toBe(false)
    expect(await resolveUserFromAuthHeader(`Bearer ${token}`)).toBeNull()
  })

  it('T01: never trusts email prefixes like narrador@ without allowlist or app_metadata', () => {
    delete process.env.NARRATOR_EMAILS
    delete process.env.ADMIN_EMAILS
    expect(roleFromSupabaseUser('narrador@evil.test', {})).toBe('player')
    expect(roleFromSupabaseUser('mestre@evil.test', {})).toBe('player')

    process.env.NARRATOR_EMAILS = 'narrador.oficial@chronicle.test'
    process.env.ADMIN_EMAILS = 'adm.oficial@chronicle.test'
    expect(roleFromSupabaseUser('narrador.oficial@chronicle.test', {})).toBe('narrator')
    expect(roleFromSupabaseUser('adm.oficial@chronicle.test', {})).toBe('admin')
    expect(roleFromSupabaseUser('other@chronicle.test', { role: 'narrator' })).toBe('narrator')
  })

  it('T02: startup validation fails on sb_secret_ keys in client/anon env vars or shared deploy without DB', () => {
    process.env.VITE_SUPABASE_ANON_KEY = 'sb_secret_leaked'
    const badKey = validateStartupEnvironment()
    expect(badKey.ok).toBe(false)
    expect(badKey.errors.some((e) => /sb_secret_/i.test(e))).toBe(true)

    delete process.env.VITE_SUPABASE_ANON_KEY
    process.env.VERCEL = '1'
    delete process.env.SUPABASE_URL
    const noDb = validateStartupEnvironment()
    expect(noDb.ok).toBe(false)
    expect(noDb.errors.some((e) => /Supabase|Persistência/i.test(e))).toBe(true)
  })

  it('T03/T18: /health and /ready respond safely and invalid JSON triggers structured 400 error', async () => {
    const health = await request(app).get('/health')
    expect(health.status).toBe(200)
    expect(health.body.ok).toBe(true)

    const readyRes = await request(app).get('/ready')
    expect(readyRes.status).toBe(200)
    expect(readyRes.body.ok).toBe(true)

    const malformed = await request(app)
      .post('/api/v1/auth/login')
      .set('Content-Type', 'application/json')
      .send('{broken-json')
    expect(malformed.status).toBe(400)
    expect(malformed.body.error.code).toBe('INVALID_JSON')
    expect(typeof malformed.body.error.requestId).toBe('string')
  })

  it('T04: password recovery rate-limits excessive requests for same IP+email', async () => {
    for (let i = 0; i < 6; i += 1) {
      const res = await request(app).post('/api/v1/auth/recover').send({ email: 'flood@ci.local' })
      expect(res.status).toBe(200)
    }
    const blocked = await request(app).post('/api/v1/auth/recover').send({ email: 'flood@ci.local' })
    expect(blocked.status).toBe(429)
    expect(blocked.body.error.code).toBe('RATE_LIMITED')
  })
})
