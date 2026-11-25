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
    expect(res.body.uptimeSec).toBeUndefined()
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

describe('character creation', () => {
  const playerToken = `dev-${Buffer.from('jogador.ficha@ci.local').toString('base64url')}`

  it('ignores level and xp sent by the client', async () => {
    const res = await request(app)
      .post('/api/v1/me/characters')
      .set('Authorization', `Bearer ${playerToken}`)
      .send({
        name: 'Recém-nascido',
        species: 'Vampiro',
        level: 20,
        startingXp: 9000,
        hp: { current: 12, max: 12 },
      })
    expect(res.status).toBe(201)
    expect(res.body.level).toBe(1)
    expect(res.body.xp.current).toBe(0)
  })
})

describe('auth login', () => {
  it('issues session token for valid payload', async () => {
    const previousUrl = process.env.SUPABASE_URL
    const previousAnon = process.env.SUPABASE_ANON_KEY
    delete process.env.SUPABASE_URL
    delete process.env.SUPABASE_ANON_KEY
    try {
      const res = await request(app)
        .post('/api/v1/auth/login')
        .send({ email: 'jogador@ci.local', password: 'senha1234' })
      expect(res.status).toBe(200)
      expect(res.body.accessToken).toMatch(/^dev-/)
      expect(res.body.role).toBe('player')
    } finally {
      if (previousUrl === undefined) delete process.env.SUPABASE_URL
      else process.env.SUPABASE_URL = previousUrl
      if (previousAnon === undefined) delete process.env.SUPABASE_ANON_KEY
      else process.env.SUPABASE_ANON_KEY = previousAnon
    }
  })

  it('refuses local tokens when the server is in production without Supabase', async () => {
    const previousEnv = process.env.NODE_ENV
    const previousUrl = process.env.SUPABASE_URL
    const previousAnon = process.env.SUPABASE_ANON_KEY
    process.env.NODE_ENV = 'production'
    delete process.env.SUPABASE_URL
    delete process.env.SUPABASE_ANON_KEY
    try {
      const res = await request(app)
        .post('/api/v1/auth/login')
        .send({ email: 'mestre@ci.local', password: 'senha1234' })
      expect(res.status).toBe(503)
      expect(res.body.accessToken).toBeUndefined()
    } finally {
      process.env.NODE_ENV = previousEnv
      if (previousUrl === undefined) delete process.env.SUPABASE_URL
      else process.env.SUPABASE_URL = previousUrl
      if (previousAnon === undefined) delete process.env.SUPABASE_ANON_KEY
      else process.env.SUPABASE_ANON_KEY = previousAnon
    }
  })

  it('rejects password shorter than 8 characters', async () => {
    const res = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'jogador@ci.local', password: 'curta' })
    expect(res.status).toBeGreaterThanOrEqual(400)
  })
})

describe('unified live session state endpoint', () => {
  const narratorToken = `dev-${Buffer.from('narrador.live@test.local').toString('base64url')}`
  const playerToken = `dev-${Buffer.from('jogador.live@test.local').toString('base64url')}`
  const outsiderToken = `dev-${Buffer.from('outsider.live@test.local').toString('base64url')}`

  it('returns consolidated live state for seated participant and blocks outsiders', async () => {
    await ensureProfile('narrador.live@test.local', 'Narrador Live', 'narrator')
    await ensureProfile('jogador.live@test.local', 'Jogador Live', 'player')
    await ensureProfile('outsider.live@test.local', 'Outsider Live', 'player')

    const charRes = await request(app)
      .post('/api/v1/me/characters')
      .set('Authorization', `Bearer ${playerToken}`)
      .send({ name: 'Helena', species: 'Vampiro', hp: { current: 10, max: 10 } })
    expect(charRes.status).toBe(201)

    const sessRes = await request(app)
      .post('/api/v1/admin/chronicle/scheduled-sessions')
      .set('Authorization', `Bearer ${narratorToken}`)
      .send({ title: 'Ato da Névoa', scheduledAt: new Date().toISOString(), listing: 'private' })
    expect(sessRes.status).toBe(201)
    const sessionId = sessRes.body.id as string
    const accessCode = sessRes.body.accessCode as string

    await request(app)
      .post(`/api/v1/admin/chronicle/scheduled-sessions/${sessionId}/open`)
      .set('Authorization', `Bearer ${narratorToken}`)
      .expect(200)

    await request(app)
      .post(`/api/v1/me/sessions/${sessionId}/join`)
      .set('Authorization', `Bearer ${playerToken}`)
      .send({ accessCode, characterId: charRes.body.id })
      .expect(200)

    await request(app)
      .get(`/api/v1/content/sessions/${sessionId}/live-state`)
      .set('Authorization', `Bearer ${outsiderToken}`)
      .expect(403)

    const liveRes = await request(app)
      .get(`/api/v1/content/sessions/${sessionId}/live-state`)
      .set('Authorization', `Bearer ${playerToken}`)
      .expect(200)

    expect(Array.isArray(liveRes.body.threats)).toBe(true)
    expect(Array.isArray(liveRes.body.actions)).toBe(true)
    expect(Array.isArray(liveRes.body.rolls)).toBe(true)
    expect(Array.isArray(liveRes.body.myBag?.rewards)).toBe(true)
  })
})
