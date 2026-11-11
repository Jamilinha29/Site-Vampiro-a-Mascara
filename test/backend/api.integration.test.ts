import { describe, expect, it } from 'vitest'
import request from 'supertest'
import { app } from '../../backend/src/index.js'
import { ensureProfile } from '../../backend/src/services/profileStore.js'
import { devRoleForEmail } from '../../backend/src/services/devAuth.js'

describe('health', () => {
  it('returns ok with uptime metadata', async () => {
    const res = await request(app).get('/health')
    expect(res.status).toBe(200)
    expect(res.body.ok).toBe(true)
    expect(res.body.service).toBe('beladona-api')
    expect(typeof res.body.uptimeSec).toBe('number')
  })
})

describe('catalog clans', () => {
  it('lists 14 clans', async () => {
    const res = await request(app).get('/api/v1/catalog/clans')
    expect(res.status).toBe(200)
    expect(res.body).toHaveLength(14)
  })
})

describe('admin vs player API isolation', () => {
  const playerToken = `dev-${Buffer.from('jogador@test.local').toString('base64url')}`
  const narratorToken = `dev-${Buffer.from('narrador@test.local').toString('base64url')}`

  it('blocks player from admin chronicle routes', async () => {
    const res = await request(app)
      .get('/api/v1/admin/chronicle/entities')
      .set('Authorization', `Bearer ${playerToken}`)
    expect(res.status).toBe(403)
  })

  it('allows narrator on admin chronicle routes', async () => {
    ensureProfile('narrador@test.local', 'narrador', devRoleForEmail('narrador@test.local'))
    const res = await request(app)
      .get('/api/v1/admin/chronicle/entities')
      .set('Authorization', `Bearer ${narratorToken}`)
    expect(res.status).toBe(200)
  })

  it('player content route requires auth', async () => {
    const unauth = await request(app).get('/api/v1/content/archive?category=chronicles')
    expect(unauth.status).toBe(401)
    const ok = await request(app)
      .get('/api/v1/content/archive?category=chronicles')
      .set('Authorization', `Bearer ${playerToken}`)
    expect(ok.status).toBe(200)
    expect(Array.isArray(ok.body)).toBe(true)
  })
})

describe('auth login', () => {
  it('issues session token for valid payload', async () => {
    const res = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'jogador@ci.local', password: 'senha1234' })
    expect(res.status).toBe(200)
    expect(res.body.accessToken).toMatch(/^dev-/)
    expect(res.body.role).toBe('player')
  })

  it('rejects password shorter than 8 characters', async () => {
    const res = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'jogador@ci.local', password: 'curta' })
    expect(res.status).toBeGreaterThanOrEqual(400)
  })
})
