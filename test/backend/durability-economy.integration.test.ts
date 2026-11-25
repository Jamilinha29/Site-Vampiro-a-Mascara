import fs from 'node:fs'
import path from 'node:path'
import request from 'supertest'
import { beforeEach, describe, expect, it } from 'vitest'
import { app } from '../../backend/src/index.js'
import {
  commitDocument,
  loadDocument,
  resetDocumentRevisionsForTests,
  setRemoteDocumentBackendForTests,
} from '../../backend/src/services/campaignDocuments.js'
import { resetCampaignExtrasForTests } from '../../backend/src/services/campaignExtras.js'
import {
  createScheduledSession,
  resetEntitiesForTests,
  resetSessionsForTests,
  updateScheduledSession,
} from '../../backend/src/services/chronicleStore.js'
import { creditCoins, getCourtWallet, hasWallet, resetCourtForTests } from '../../backend/src/services/courtStore.js'
import { signDevToken } from '../../backend/src/services/devAuth.js'
import { ConflictError } from '../../backend/src/services/errors.js'
import { resetIdempotencyStoreForTests } from '../../backend/src/services/idempotencyStore.js'
import { resetOperationsForTests } from '../../backend/src/services/operationLog.js'
import {
  ensureProfile,
  getCharacter,
  listCharacterRevisions,
  resetProfilesForTests,
  restoreCharacterRevision,
  upsertCharacter,
} from '../../backend/src/services/profileStore.js'
import { buyAtTable } from '../../backend/src/services/shopPurchase.js'
import { resetShopForTests } from '../../backend/src/services/shopStore.js'

describe('durability, concurrency, rollback & idempotency (T05-T10, T19-T20)', () => {
  beforeEach(() => {
    setRemoteDocumentBackendForTests(null)
    resetDocumentRevisionsForTests()
    resetIdempotencyStoreForTests()
    resetOperationsForTests()
    resetProfilesForTests()
    resetSessionsForTests()
    resetEntitiesForTests()
    resetCourtForTests()
    resetShopForTests()
    resetCampaignExtrasForTests()
  })

  it('T05: optimistic concurrency rejects stale document commits and surfaces remote failure without silent drop', async () => {
    let remoteRev = 1
    let remoteBody: unknown = { step: 1 }
    let failWrites = false
    setRemoteDocumentBackendForTests({
      load: async () => ({ body: remoteBody, updatedAt: new Date().toISOString(), revision: remoteRev }),
      save: async (_id, envelope, expectedRevision) => {
        if (failWrites) throw new Error('Simulated DB outage')
        if (expectedRevision !== null && expectedRevision !== remoteRev) {
          throw new ConflictError('Conflito de revisão no banco remoto.')
        }
        remoteRev += 1
        remoteBody = envelope.body
        return { ...envelope, revision: remoteRev }
      },
    })

    const loaded = await loadDocument<{ step: number }>('cas-doc')
    expect(loaded?.revision).toBe(1)

    remoteRev = 3
    remoteBody = { step: 99 }
    await expect(commitDocument('cas-doc', { step: 2 })).rejects.toThrow(/Conflito/i)

    await loadDocument('cas-doc')
    failWrites = true
    await expect(commitDocument('cas-doc', { step: 100 })).rejects.toThrow(/Simulated DB outage/i)
    setRemoteDocumentBackendForTests(null)
  })

  it('T06: entities always import/create in draft visibility even if client sends published', async () => {
    const narratorToken = signDevToken('narrador.t06@ci.local', 'Narrador', 'narrator').accessToken
    const created = await request(app)
      .post('/api/v1/admin/chronicle/entities')
      .set('Authorization', `Bearer ${narratorToken}`)
      .send({
        kind: 'equipment',
        name: 'Espada Teste Draft',
        description: 'Teste',
        visibility: 'published',
      })
    expect(created.status).toBe(201)
    expect(created.body.visibility).toBe('draft')

    const imported = await request(app)
      .post('/api/v1/admin/chronicle/entities/import')
      .set('Authorization', `Bearer ${narratorToken}`)
      .send([{ kind: 'archive', archiveCategory: 'chronicles', name: 'Crônica Draft', description: 'Texto', visibility: 'published' }])
    expect(imported.status).toBe(201)
    expect(imported.body.items[0].visibility).toBe('draft')
  })

  it('T07: character patch enforces expectedRevision 409 conflict, blocks progression spoofing, and records restorable revisions', async () => {
    const playerToken = signDevToken('ficha.t07@ci.local', 'Jogador T07', 'player').accessToken
    await ensureProfile('ficha.t07@ci.local', 'Jogador T07', 'player')
    const ch = await upsertCharacter('ficha.t07@ci.local', {
      name: 'Marcus',
      species: 'Vampiro',
      level: 1,
      hp: { current: 15, max: 15 },
    })

    const spoof = await request(app)
      .patch(`/api/v1/me/characters/${ch.id}`)
      .set('Authorization', `Bearer ${playerToken}`)
      .send({
        name: 'Marcus II',
        level: 10,
        approval: 'approved',
        expectedRevision: ch.sheetRevision,
      })
    expect(spoof.status).toBe(200)
    expect(spoof.body.level).toBe(1)
    expect(spoof.body.approval).not.toBe('approved')
    expect(spoof.body.sheetRevision).toBe((ch.sheetRevision ?? 1) + 1)

    const stale = await request(app)
      .patch(`/api/v1/me/characters/${ch.id}`)
      .set('Authorization', `Bearer ${playerToken}`)
      .send({
        name: 'Marcus Stale',
        expectedRevision: ch.sheetRevision,
      })
    expect(stale.status).toBe(409)

    const revisions = listCharacterRevisions('ficha.t07@ci.local', ch.id)
    const marcusRev = revisions.find((r) => r.snapshot.name === 'Marcus') ?? revisions[0]
    expect(marcusRev).toBeDefined()

    const preview = await restoreCharacterRevision({
      email: 'ficha.t07@ci.local',
      characterId: ch.id,
      revisionId: marcusRev.id,
      actorEmail: 'admin.t07@ci.local',
      dryRun: true,
    })
    expect(preview.dryRun).toBe(true)

    const restored = await restoreCharacterRevision({
      email: 'ficha.t07@ci.local',
      characterId: ch.id,
      revisionId: marcusRev.id,
      actorEmail: 'admin.t07@ci.local',
      dryRun: false,
      confirm: 'restaurar-revisao',
    })
    expect(restored.dryRun).toBe(false)
    expect(getCharacter('ficha.t07@ci.local', ch.id)?.name).toBe('Marcus')
  })

  it('T08/T09: shop rejects uninitialized wallet debit, rolls back on commit error, and rejects reused operationId with different payload', async () => {
    const narratorToken = signDevToken('mestre.t09@ci.local', 'Mestre T09', 'narrator').accessToken
    const buyerEmail = 'comprador.t09@ci.local'
    await ensureProfile(buyerEmail, 'Comprador', 'player')
    const char = await upsertCharacter(buyerEmail, {
      name: 'Comerciante',
      species: 'Vampiro',
      level: 1,
      isPrimary: true,
      hp: { current: 12, max: 12 },
    })
    const ent = await request(app)
      .post('/api/v1/admin/chronicle/entities')
      .set('Authorization', `Bearer ${narratorToken}`)
      .send({
        kind: 'equipment',
        shopCategory: 'gear',
        name: 'Capa Nobre',
        description: 'Capa',
        priceSilver: 3,
        stockTotal: 2,
      })
    expect(ent.status).toBe(201)
    await request(app)
      .post(`/api/v1/admin/chronicle/entities/${ent.body.id}/publish`)
      .set('Authorization', `Bearer ${narratorToken}`)

    const sess = await createScheduledSession({ title: 'Mesa T09', scheduledAt: '2026-11-25T20:00:00.000Z' })
    await updateScheduledSession(sess.id, {
      status: 'open',
      seats: [{ email: buyerEmail, displayName: 'Comprador', characterId: char.id, characterName: char.name, joinedAt: '2026-11-25T20:00:00.000Z' }],
    })

    expect(hasWallet(buyerEmail)).toBe(false)
    const noWallet = await buyAtTable({
      email: buyerEmail,
      entityId: ent.body.id,
      quantity: 1,
      sessionId: sess.id,
      characterId: char.id,
      operationId: 'op-t09-nowallet',
    })
    expect(noWallet.status).toBe(409)
    expect(hasWallet(buyerEmail)).toBe(false)

    await creditCoins(buyerEmail, 'silver', 5, 'Dotação')

    setRemoteDocumentBackendForTests({
      load: async () => null,
      save: async () => {
        throw new Error('Disk/DB write failed')
      },
    })
    await expect(
      buyAtTable({
        email: buyerEmail,
        entityId: ent.body.id,
        quantity: 1,
        sessionId: sess.id,
        characterId: char.id,
        operationId: 'op-t09-rollback',
      }),
    ).rejects.toThrow(/Disk\/DB write failed/i)
    setRemoteDocumentBackendForTests(null)

    expect(getCourtWallet(buyerEmail).silver).toBe(5)
    expect(getCharacter(buyerEmail, char.id)?.inventory?.some((i) => i.name === 'Capa Nobre')).toBe(false)

    const okBuy = await buyAtTable({
      email: buyerEmail,
      entityId: ent.body.id,
      quantity: 1,
      sessionId: sess.id,
      characterId: char.id,
      operationId: 'op-t09-idemp',
    })
    expect(okBuy.status).toBe(200)

    await expect(
      buyAtTable({
        email: buyerEmail,
        entityId: ent.body.id,
        quantity: 2,
        sessionId: sess.id,
        characterId: char.id,
        operationId: 'op-t09-idemp',
      }),
    ).rejects.toThrow(/Parâmetros diferentes|Conflito/i)
  })

  it('T10: award-xp and grant-coins reject closed tables (409) and enforce idempotent operationId', async () => {
    const narratorEmail = 'mestre.t10@ci.local'
    const narratorToken = signDevToken(narratorEmail, 'Mestre T10', 'narrator').accessToken
    const playerEmail = 'player.t10@ci.local'
    await ensureProfile(playerEmail, 'Player T10', 'player')
    const ch = await upsertCharacter(playerEmail, {
      name: 'Alucard',
      species: 'Vampiro',
      level: 1,
      hp: { current: 15, max: 15 },
    })

    const sess = await createScheduledSession({
      title: 'Mesa T10',
      scheduledAt: '2026-11-25T21:00:00.000Z',
      narratorEmail,
    })
    await updateScheduledSession(sess.id, {
      status: 'open',
      seats: [{ email: playerEmail, displayName: 'Player T10', characterId: ch.id, characterName: ch.name, joinedAt: '2026-11-25T21:00:00.000Z' }],
    })

    const xp1 = await request(app)
      .post('/api/v1/admin/chronicle/award-xp')
      .set('Authorization', `Bearer ${narratorToken}`)
      .send({ sessionId: sess.id, participantDisplayName: 'Player T10', amount: 15, operationId: 'xp-op-1' })
    const xp2 = await request(app)
      .post('/api/v1/admin/chronicle/award-xp')
      .set('Authorization', `Bearer ${narratorToken}`)
      .send({ sessionId: sess.id, participantDisplayName: 'Player T10', amount: 15, operationId: 'xp-op-1' })
    expect(xp1.status).toBe(200)
    expect(xp2.status).toBe(200)
    expect(getCharacter(playerEmail, ch.id)?.xp?.current).toBe(15)

    const coin1 = await request(app)
      .post('/api/v1/court/admin/grant-coins')
      .set('Authorization', `Bearer ${narratorToken}`)
      .send({ sessionId: sess.id, participantDisplayName: 'Player T10', coin: 'silver', amount: 10, operationId: 'coin-op-1' })
    const coin2 = await request(app)
      .post('/api/v1/court/admin/grant-coins')
      .set('Authorization', `Bearer ${narratorToken}`)
      .send({ sessionId: sess.id, participantDisplayName: 'Player T10', coin: 'silver', amount: 10, operationId: 'coin-op-1' })
    expect(coin1.status).toBe(200)
    expect(coin2.status).toBe(200)
    expect(getCourtWallet(playerEmail).silver).toBe(10)

    await updateScheduledSession(sess.id, { status: 'closed' })
    const closedXp = await request(app)
      .post('/api/v1/admin/chronicle/award-xp')
      .set('Authorization', `Bearer ${narratorToken}`)
      .send({ sessionId: sess.id, participantDisplayName: 'Player T10', amount: 5 })
    expect(closedXp.status).toBe(409)
  })

  it('T19/T20: backup drill validates payload, restore requires admin, and nginx/vercel proxies are properly wired', async () => {
    const narratorToken = signDevToken('narrador.t19@ci.local', 'Nar T19', 'narrator').accessToken
    const adminToken = signDevToken('admin.t19@ci.local', 'Adm T19', 'admin').accessToken

    const forbiddenRestore = await request(app)
      .post('/api/v1/admin/chronicle/backup/restore')
      .set('Authorization', `Bearer ${narratorToken}`)
      .send({ confirm: 'restaurar-copia', backup: {} })
    expect(forbiddenRestore.status).toBe(403)

    const snapshot = await request(app)
      .get('/api/v1/admin/chronicle/backup')
      .set('Authorization', `Bearer ${adminToken}`)
    expect(snapshot.status).toBe(200)

    const drill = await request(app)
      .post('/api/v1/admin/chronicle/backup/drill')
      .set('Authorization', `Bearer ${adminToken}`)
      .send(snapshot.body)
    expect(drill.status).toBe(200)
    expect(drill.body.wrote).toBe(false)

    const nginx = fs.readFileSync(path.resolve(process.cwd(), 'docker/nginx.conf'), 'utf8')
    expect(nginx).toContain('proxy_pass http://api:4000')
    expect(nginx).not.toContain('return 404')

    const vercel = JSON.parse(fs.readFileSync(path.resolve(process.cwd(), 'vercel.json'), 'utf8'))
    expect(vercel.rewrites.some((r: { source: string }) => r.source === '/ready')).toBe(true)
  })
})
