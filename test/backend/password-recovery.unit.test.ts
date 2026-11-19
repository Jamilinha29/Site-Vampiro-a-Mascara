import { describe, expect, it } from 'vitest'
import request from 'supertest'
import { app } from '../../backend/src/index.js'
import {
  createRecoveryToken,
  dropRecoveryToken,
  peekRecoveryToken,
} from '../../backend/src/services/passwordRecovery.js'

describe('password recovery tokens', () => {
  it('accepts a token once and rejects it after use or expiry', () => {
    const token = createRecoveryToken('user-1', 'jogador@ci.local')
    expect(peekRecoveryToken(token)?.email).toBe('jogador@ci.local')
    dropRecoveryToken(token)
    expect(peekRecoveryToken(token)).toBeNull()

    const expired = createRecoveryToken('user-1', 'jogador@ci.local', 0)
    expect(peekRecoveryToken(expired)).toBeNull()
  })
})

describe('password recovery routes', () => {
  it('answers the same way for any email and rejects a bad token', async () => {
    const sent = await request(app).post('/api/v1/auth/recover').send({ email: 'ninguem@ci.local' })
    expect(sent.status).toBe(200)
    expect(sent.body.message).toMatch(/corvo/)

    const bad = await request(app)
      .post('/api/v1/auth/recover/confirm')
      .send({ token: 'token-inexistente-com-tamanho', password: 'senha1234' })
    expect(bad.status).toBe(400)
  })
})
