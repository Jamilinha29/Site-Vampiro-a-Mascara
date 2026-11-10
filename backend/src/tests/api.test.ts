import { describe, expect, it } from 'vitest'
import request from 'supertest'
import { app } from '../index.js'
import { ensureProfile } from '../services/profileStore.js'
import { devRoleForEmail } from '../services/devAuth.js'

describe('health', () => {
  it('returns ok', async () => {
    const res = await request(app).get('/health')
    expect(res.status).toBe(200)
    expect(res.body.ok).toBe(true)
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

  it('keeps narrator access when profile role was downgraded to player', async () => {
    ensureProfile('narrador@test.local', 'narrador', 'player')
    const res = await request(app)
      .get('/api/v1/admin/chronicle/entities')
      .set('Authorization', `Bearer ${narratorToken}`)
    expect(res.status).toBe(200)
  })

  it('allows narrator email before profile exists (e.g. after API restart)', async () => {
    const freshToken = `dev-${Buffer.from('mestre@fresh.local').toString('base64url')}`
    const res = await request(app)
      .get('/api/v1/admin/chronicle/entities')
      .set('Authorization', `Bearer ${freshToken}`)
    expect(res.status).toBe(200)
  })

  it('player content route requires auth but not narrator role', async () => {
    const unauth = await request(app).get('/api/v1/content/archive?category=chronicles')
    expect(unauth.status).toBe(401)
    const ok = await request(app)
      .get('/api/v1/content/archive?category=chronicles')
      .set('Authorization', `Bearer ${playerToken}`)
    expect(ok.status).toBe(200)
    expect(Array.isArray(ok.body)).toBe(true)
  })
})
