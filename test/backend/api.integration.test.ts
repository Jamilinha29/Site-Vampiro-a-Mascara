import { beforeEach, describe, expect, it } from 'vitest'
import request from 'supertest'
import { app } from '../../backend/src/index.js'
import { resetEntitiesForTests, resetSessionsForTests } from '../../backend/src/services/chronicleStore.js'
import { ensureProfile, resetProfilesForTests } from '../../backend/src/services/profileStore.js'
import { resetRateLimitsForTests } from '../../backend/src/services/rateLimitStore.js'
import { devRoleForEmail } from '../../backend/src/services/devAuth.js'

beforeEach(() => {
  resetProfilesForTests()
  resetEntitiesForTests()
  resetSessionsForTests()
  resetRateLimitsForTests()
})

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

    // Sem confirmar participação antes, o jogador não pode entrar ao vivo
    await request(app)
      .post(`/api/v1/me/sessions/${sessionId}/join`)
      .set('Authorization', `Bearer ${playerToken}`)
      .send({ accessCode, characterId: charRes.body.id })
      .expect(403)

    // Após confirmar participação (com código na mesa privada), pode entrar no horário devido
    const presenceRes = await request(app)
      .post(`/api/v1/me/sessions/${sessionId}/presence`)
      .set('Authorization', `Bearer ${playerToken}`)
      .send({ accessCode })
      .expect(200)
    expect(presenceRes.body.hasConfirmedPresence).toBe(true)
    expect(presenceRes.body.canEnterLive).toBe(true)

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

  it('blocks live entry before scheduled time even when open and confirmed, and unlocks only for confirmed users on schedule', async () => {
    await ensureProfile('narrador.sched@test.local', 'Narrador Agenda', 'narrator')
    await ensureProfile('confirmado.sched@test.local', 'Jogador Confirmado', 'player')
    await ensureProfile('naoconfirmado.sched@test.local', 'Jogador Sem Confirmar', 'player')

    const narTok = `dev-${Buffer.from('narrador.sched@test.local').toString('base64url')}`
    const confirmedTok = `dev-${Buffer.from('confirmado.sched@test.local').toString('base64url')}`
    const unconfirmedTok = `dev-${Buffer.from('naoconfirmado.sched@test.local').toString('base64url')}`

    const charConfirmed = await request(app)
      .post('/api/v1/me/characters')
      .set('Authorization', `Bearer ${confirmedTok}`)
      .send({ name: 'Elena', species: 'Vampiro', hp: { current: 10, max: 10 } })
      .expect(201)

    const charUnconfirmed = await request(app)
      .post('/api/v1/me/characters')
      .set('Authorization', `Bearer ${unconfirmedTok}`)
      .send({ name: 'Victor', species: 'Vampiro', hp: { current: 10, max: 10 } })
      .expect(201)

    // 1) Mesa futura (2h à frente): mesmo aberta pelo narrador e com presença confirmada, não abre ao vivo antes do horário
    const futureAt = new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString()
    const futureSess = await request(app)
      .post('/api/v1/admin/chronicle/scheduled-sessions')
      .set('Authorization', `Bearer ${narTok}`)
      .send({ title: 'Vigília Futura', scheduledAt: futureAt, listing: 'public' })
      .expect(201)

    await request(app)
      .post(`/api/v1/admin/chronicle/scheduled-sessions/${futureSess.body.id}/open`)
      .set('Authorization', `Bearer ${narTok}`)
      .expect(200)

    const confirmFuture = await request(app)
      .post(`/api/v1/me/sessions/${futureSess.body.id}/presence`)
      .set('Authorization', `Bearer ${confirmedTok}`)
      .expect(200)
    expect(confirmFuture.body.hasConfirmedPresence).toBe(true)
    expect(confirmFuture.body.scheduledTimeReached).toBe(false)
    expect(confirmFuture.body.canEnterLive).toBe(false)

    const earlyJoin = await request(app)
      .post(`/api/v1/me/sessions/${futureSess.body.id}/join`)
      .set('Authorization', `Bearer ${confirmedTok}`)
      .send({ accessCode: '', characterId: charConfirmed.body.id })
      .expect(409)
    expect(earlyJoin.body.error.message).toMatch(/horário marcado/i)

    // 2) Mesa no horário devido: só abre ao vivo para quem confirmou participação
    const dueAt = new Date(Date.now() - 60_000).toISOString()
    const dueSess = await request(app)
      .post('/api/v1/admin/chronicle/scheduled-sessions')
      .set('Authorization', `Bearer ${narTok}`)
      .send({ title: 'Vigília no Horário', scheduledAt: dueAt, listing: 'public' })
      .expect(201)

    // Antes do narrador abrir: mesmo confirmado e no horário, aguarda o narrador
    await request(app)
      .post(`/api/v1/me/sessions/${dueSess.body.id}/presence`)
      .set('Authorization', `Bearer ${confirmedTok}`)
      .expect(200)

    await request(app)
      .post(`/api/v1/me/sessions/${dueSess.body.id}/join`)
      .set('Authorization', `Bearer ${confirmedTok}`)
      .send({ accessCode: '', characterId: charConfirmed.body.id })
      .expect(409)

    await request(app)
      .post(`/api/v1/admin/chronicle/scheduled-sessions/${dueSess.body.id}/open`)
      .set('Authorization', `Bearer ${narTok}`)
      .expect(200)

    // Não confirmado continua bloqueado
    const unconfirmedJoin = await request(app)
      .post(`/api/v1/me/sessions/${dueSess.body.id}/join`)
      .set('Authorization', `Bearer ${unconfirmedTok}`)
      .send({ accessCode: '', characterId: charUnconfirmed.body.id })
      .expect(403)
    expect(unconfirmedJoin.body.error.message).toMatch(/Confirme sua participação/i)

    // Board mostra canEnterLive=true só para quem confirmou
    const boardConfirmed = await request(app)
      .get('/api/v1/court/session-board?q=Vigília')
      .set('Authorization', `Bearer ${confirmedTok}`)
      .expect(200)
    const dueCardConfirmed = boardConfirmed.body.publicTables.find((t: { id: string }) => t.id === dueSess.body.id)
    expect(dueCardConfirmed?.canEnterLive).toBe(true)

    const boardUnconfirmed = await request(app)
      .get('/api/v1/court/session-board?q=Vigília')
      .set('Authorization', `Bearer ${unconfirmedTok}`)
      .expect(200)
    const dueCardUnconfirmed = boardUnconfirmed.body.publicTables.find((t: { id: string }) => t.id === dueSess.body.id)
    expect(dueCardUnconfirmed?.canEnterLive).toBe(false)

    // Confirmado entra ao vivo com sucesso
    await request(app)
      .post(`/api/v1/me/sessions/${dueSess.body.id}/join`)
      .set('Authorization', `Bearer ${confirmedTok}`)
      .send({ accessCode: '', characterId: charConfirmed.body.id })
      .expect(200)
  })
})
