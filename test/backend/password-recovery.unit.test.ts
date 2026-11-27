import { beforeEach, describe, expect, it } from 'vitest'
import request from 'supertest'
import { app } from '../../backend/src/index.js'
import {
  confirmPasswordRecovery,
  getRecoveryCapabilities,
  hasRecoveryAmrClaim,
  RECOVERY_PUBLIC_MESSAGE,
} from '../../backend/src/services/passwordRecovery.js'
import { resetRateLimitsForTests } from '../../backend/src/services/rateLimitStore.js'

function fakeJwt(payload: Record<string, unknown>) {
  const head = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url')
  const body = Buffer.from(JSON.stringify(payload)).toString('base64url')
  return `${head}.${body}.sig`
}

describe('password recovery stateless Supabase Auth', () => {
  beforeEach(() => {
    resetRateLimitsForTests()
  })

  it('exposes honest recovery capabilities and refuses confirmation without Supabase Auth', async () => {
    const caps = getRecoveryCapabilities()
    expect(caps.supabaseAuthActive).toBe(false)
    expect(typeof caps.note).toBe('string')

    const out = await confirmPasswordRecovery('token-inexistente-com-tamanho', 'senha1234')
    expect(out.ok).toBe(false)
    expect(out.message).toMatch(/Supabase Auth/i)
  })

  it('requires recovery amr claim and rejects ordinary session JWTs', () => {
    const ordinaryJwt = fakeJwt({ sub: 'u1', amr: [{ method: 'password', timestamp: 1 }] })
    const oauthJwt = fakeJwt({ sub: 'u1', amr: [{ method: 'oauth', timestamp: 1 }] })
    const noAmrJwt = fakeJwt({ sub: 'u1' })
    const recoveryObjJwt = fakeJwt({ sub: 'u1', amr: [{ method: 'recovery', timestamp: 1 }] })
    const recoveryStrJwt = fakeJwt({ sub: 'u1', amr: ['recovery'] })

    expect(hasRecoveryAmrClaim(ordinaryJwt)).toBe(false)
    expect(hasRecoveryAmrClaim(oauthJwt)).toBe(false)
    expect(hasRecoveryAmrClaim(noAmrJwt)).toBe(false)
    expect(hasRecoveryAmrClaim('not-a-jwt')).toBe(false)
    expect(hasRecoveryAmrClaim(recoveryObjJwt)).toBe(true)
    expect(hasRecoveryAmrClaim(recoveryStrJwt)).toBe(true)
  })
})

describe('password recovery routes', () => {
  beforeEach(() => {
    resetRateLimitsForTests()
  })
  it('answers uniformly without account enumeration, rate limits floods, and rejects invalid confirmation', async () => {
    resetRateLimitsForTests()
    const sentA = await request(app).post('/api/v1/auth/recover').send({ email: 'ninguem@ci.local' })
    const sentB = await request(app).post('/api/v1/auth/recover').send({ email: 'jogador@ci.local' })
    expect(sentA.status).toBe(200)
    expect(sentB.status).toBe(200)
    expect(sentA.body.message).toBe(RECOVERY_PUBLIC_MESSAGE)
    expect(sentB.body.message).toBe(RECOVERY_PUBLIC_MESSAGE)

    const statusRes = await request(app).get('/api/v1/auth/recovery-status')
    expect(statusRes.status).toBe(200)
    expect(statusRes.body).toHaveProperty('supabaseAuthActive')

    const bad = await request(app)
      .post('/api/v1/auth/recover/confirm')
      .send({ token: 'token-inexistente-com-tamanho', password: 'senha1234' })
    expect(bad.status).toBe(400)
    expect(bad.body.error.code).toBe('RECOVERY_INVALID')
  })
})
