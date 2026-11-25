import { describe, expect, it } from 'vitest'
import request from 'supertest'
import { app } from '../../backend/src/index.js'
import {
  confirmPasswordRecovery,
  getRecoveryCapabilities,
  RECOVERY_PUBLIC_MESSAGE,
} from '../../backend/src/services/passwordRecovery.js'
import { resetRateLimitsForTests } from '../../backend/src/services/rateLimitStore.js'

describe('password recovery stateless Supabase Auth', () => {
  it('exposes honest recovery capabilities and refuses confirmation without Supabase Auth', async () => {
    const caps = getRecoveryCapabilities()
    expect(caps.supabaseAuthActive).toBe(false)
    expect(typeof caps.note).toBe('string')

    const out = await confirmPasswordRecovery('token-inexistente-com-tamanho', 'senha1234')
    expect(out.ok).toBe(false)
    expect(out.message).toMatch(/Supabase Auth/i)
  })
})

describe('password recovery routes', () => {
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
