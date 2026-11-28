import request from 'supertest'
import { beforeEach, describe, expect, it } from 'vitest'
import { app } from '../../backend/src/index.js'
import {
  createScheduledSession,
  resetEntitiesForTests,
  resetSessionsForTests,
  updateScheduledSession,
} from '../../backend/src/services/chronicleStore.js'
import { resetCourtForTests } from '../../backend/src/services/courtStore.js'
import { signDevToken } from '../../backend/src/services/devAuth.js'
import {
  inspectDownloadAsset,
  isSafePublicMediaUrl,
  parsePrivateObjectRef,
} from '../../backend/src/services/mediaStorage.js'
import {
  ensureProfile,
  getCharacter,
  migrateLegacyCharacter,
  replaceProfiles,
  resetProfilesForTests,
  upsertCharacter,
} from '../../backend/src/services/profileStore.js'
import { resetRateLimitsForTests } from '../../backend/src/services/rateLimitStore.js'
import { mergeReferenceKind, resetReferenceCatalogForTests } from '../../backend/src/services/referenceCatalog.js'
import { resetRulesForTests } from '../../backend/src/services/rulesState.js'

describe('isolation, privacy, media security & progression 0-10/5/7 (T11-T17)', () => {
  beforeEach(() => {
    resetProfilesForTests()
    resetSessionsForTests()
    resetEntitiesForTests()
    resetRateLimitsForTests()
    resetCourtForTests()
    resetRulesForTests()
    resetReferenceCatalogForTests()
  })

  it('T11/T12/T13: isolates narrators per table, hides accessCode from player dashboard, and rate-limits join codes', async () => {
    const narA = 'narrador.a@ci.local'
    const narB = 'narrador.b@ci.local'
    const playerEmail = 'p1.t11@ci.local'
    const tokenNarB = signDevToken(narB, 'Narrador B', 'narrator').accessToken
    const tokenAdmin = signDevToken('admin.t11@ci.local', 'Admin', 'admin').accessToken
    const tokenPlayer = signDevToken(playerEmail, 'Jogador 1', 'player').accessToken

    await ensureProfile(playerEmail, 'Jogador 1', 'player')
    const sessionA = await createScheduledSession({
      title: 'Mesa Privada A',
      scheduledAt: '2026-11-26T20:00:00.000Z',
      narratorEmail: narA,
      listing: 'private',
    })

    const forbiddenRotate = await request(app)
      .post(`/api/v1/admin/chronicle/scheduled-sessions/${sessionA.id}/rotate-code`)
      .set('Authorization', `Bearer ${tokenNarB}`)
    expect(forbiddenRotate.status).toBe(403)

    const adminRotate = await request(app)
      .post(`/api/v1/admin/chronicle/scheduled-sessions/${sessionA.id}/rotate-code`)
      .set('Authorization', `Bearer ${tokenAdmin}`)
    expect(adminRotate.status).toBe(200)
    expect(adminRotate.body.accessCode).toBeTruthy()
    expect(adminRotate.body.accessCode).not.toBe(sessionA.accessCode)

    const dash = await request(app)
      .get('/api/v1/me/dashboard')
      .set('Authorization', `Bearer ${tokenPlayer}`)
    expect(dash.status).toBe(200)
    expect(dash.body.nextSession?.accessCode).toBeUndefined()

    const unseatedArchive = await request(app)
      .get(`/api/v1/content/archive?category=chronicles&sessionId=${sessionA.id}`)
      .set('Authorization', `Bearer ${tokenPlayer}`)
    expect(unseatedArchive.status).toBe(403)

    for (let i = 0; i < 8; i += 1) {
      const attempt = await request(app)
        .post('/api/v1/sessions/join-by-code')
        .set('Authorization', `Bearer ${tokenPlayer}`)
        .send({ code: `ERRADO-${i}` })
      expect(attempt.status).toBe(404)
    }
    const limited = await request(app)
      .post('/api/v1/sessions/join-by-code')
      .set('Authorization', `Bearer ${tokenPlayer}`)
      .send({ code: adminRotate.body.accessCode })
    expect(limited.status).toBe(429)
  })

  it('T14: court player search enforces min query length >= 2 and omits player email', async () => {
    const token = signDevToken('busca.t14@ci.local', 'Buscador', 'player').accessToken
    await ensureProfile('alvo.t14@ci.local', 'Alvo Secreto', 'player')

    const tooShort = await request(app)
      .get('/api/v1/court/players?q=a')
      .set('Authorization', `Bearer ${token}`)
    expect(tooShort.status).toBe(200)
    expect(tooShort.body).toEqual([])

    const match = await request(app)
      .get('/api/v1/court/players?q=Alvo')
      .set('Authorization', `Bearer ${token}`)
    expect(match.status).toBe(200)
    expect(match.body).toHaveLength(1)
    expect(match.body[0].id).toMatch(/^\d{10}$/)
    expect(match.body[0].email).toBeUndefined()
  })

  it('T15: media validation rejects SSRF URLs, forged private refs, path traversal, and invalid file magic bytes', () => {
    expect(isSafePublicMediaUrl('https://cdn.example.com/arte.png')).toBe(true)
    expect(isSafePublicMediaUrl('http://169.254.169.254/latest/meta-data')).toBe(false)
    expect(isSafePublicMediaUrl('http://127.0.0.1:4000/health')).toBe(false)
    expect(isSafePublicMediaUrl('javascript:alert(1)')).toBe(false)
    expect(isSafePublicMediaUrl('private://perfis/foo.png')).toBe(false)

    expect(parsePrivateObjectRef('private://revelacoes/ficha.pdf')).toEqual({
      bucket: 'revelacoes',
      path: 'ficha.pdf',
    })
    expect(parsePrivateObjectRef('private://revelacoes/../secret.pdf')).toBeNull()

    const fakePdf = `data:application/pdf;base64,${Buffer.from('<script>alert(1)</script>').toString('base64')}`
    expect(() => inspectDownloadAsset(fakePdf)).toThrow()

    const realPdf = `data:application/pdf;base64,${Buffer.from('%PDF-1.7\n1 0 obj\n').toString('base64')}`
    expect(inspectDownloadAsset(realPdf).contentType).toBe('application/pdf')
  })

  it('T16/T17: progression enforces level 0-10, subclass I at 5, subclass II at 7, and non-destructive legacy review', async () => {
    await mergeReferenceKind('subclass', [
      { name: 'Taumaturgo', className: 'Ocultista', description: 'Sangue e rituais' },
      { name: 'Alquimista', className: 'Ocultista', description: 'Poções e transmutação' },
    ])

    const email = 'prog.t16@ci.local'
    const playerToken = signDevToken(email, 'Prog', 'player').accessToken
    const adminToken = signDevToken('admin.t16@ci.local', 'Adm', 'admin').accessToken
    await ensureProfile(email, 'Prog', 'player')

    const progMeta = await request(app).get('/api/v1/catalog/progression')
    expect(progMeta.status).toBe(200)
    expect(progMeta.body).toMatchObject({
      minLevel: 0,
      maxLevel: 10,
      subclassLevel: 5,
      secondarySubclassLevel: 7,
    })

    const created = await request(app)
      .post('/api/v1/me/characters')
      .set('Authorization', `Bearer ${playerToken}`)
      .send({
        name: 'Neófito',
        species: 'Vampiro',
        clan: 'Tremere',
        characterClass: 'Ocultista',
        level: 0,
        hp: { current: 10, max: 10 },
      })
    expect(created.status).toBe(201)
    expect(created.body.level).toBe(0)
    expect(created.body.xp).toEqual({ current: 0, toNext: 25 })

    const earlySub = await request(app)
      .patch(`/api/v1/me/characters/${created.body.id}`)
      .set('Authorization', `Bearer ${playerToken}`)
      .send({ subclass: 'Taumaturgo' })
    expect(earlySub.status).toBe(403)

    await upsertCharacter(email, { ...getCharacter(email, created.body.id)!, level: 5 })
    const sub1 = await request(app)
      .patch(`/api/v1/me/characters/${created.body.id}`)
      .set('Authorization', `Bearer ${playerToken}`)
      .send({ subclass: 'Taumaturgo' })
    expect(sub1.status).toBe(200)
    expect(sub1.body.subclass).toBe('Taumaturgo')

    const earlySub2 = await request(app)
      .patch(`/api/v1/me/characters/${created.body.id}`)
      .set('Authorization', `Bearer ${playerToken}`)
      .send({ secondarySubclass: 'Alquimista' })
    expect(earlySub2.status).toBe(403)

    await upsertCharacter(email, { ...getCharacter(email, created.body.id)!, level: 7 })
    const dupSub2 = await request(app)
      .patch(`/api/v1/me/characters/${created.body.id}`)
      .set('Authorization', `Bearer ${playerToken}`)
      .send({ secondarySubclass: 'Taumaturgo' })
    expect(dupSub2.status).toBe(400)

    const okSub2 = await request(app)
      .patch(`/api/v1/me/characters/${created.body.id}`)
      .set('Authorization', `Bearer ${playerToken}`)
      .send({ secondarySubclass: 'Alquimista' })
    expect(okSub2.status).toBe(200)
    expect(okSub2.body.secondarySubclass).toBe('Alquimista')

    const legacyChar = migrateLegacyCharacter({
      id: 'legacy-anciao',
      name: 'Ancião Legado',
      species: 'Vampiro',
      level: 14,
      subclass: 'Taumaturgo',
      hp: { current: 80, max: 80 },
      xp: { current: 100, toNext: 0 },
    })
    const existingProfile = (await ensureProfile(email, 'Prog', 'player'))
    await replaceProfiles([{ ...existingProfile, characters: [...existingProfile.characters, legacyChar] }])

    expect(legacyChar.level).toBe(14)
    expect(legacyChar.subclass).toBe('Taumaturgo')
    expect(legacyChar.needsRuleReview).toBe(true)

    const reviews = await request(app)
      .get('/api/v1/admin/chronicle/character-reviews')
      .set('Authorization', `Bearer ${adminToken}`)
    expect(reviews.status).toBe(200)
    expect(
      reviews.body.some(
        (r: { characterId: string; needsRuleReview: boolean }) =>
          r.characterId === legacyChar.id && r.needsRuleReview,
      ),
    ).toBe(true)

    await updateScheduledSession(
      (await createScheduledSession({ title: 'Cleanup', scheduledAt: '2026-11-26T22:00:00.000Z' })).id,
      { status: 'closed' },
    )
  })

  it('T18/T19: allows friend search by publicId including narrators, and co-narrator join only when allowed', async () => {
    const narMain = 'nar.main@ci.local'
    const narSec = 'nar.sec@ci.local'
    const playerEmail = 'jog.friend@ci.local'

    const narProfile = await ensureProfile(narMain, 'Mestre Principal', 'narrator')
    await ensureProfile(narSec, 'Mestre Secundário', 'narrator')
    await ensureProfile(playerEmail, 'Jogador Amigo', 'player')

    const tokenPlayer = signDevToken(playerEmail, 'Jogador Amigo', 'player').accessToken
    const tokenMain = signDevToken(narMain, 'Mestre Principal', 'narrator').accessToken
    const tokenSec = signDevToken(narSec, 'Mestre Secundário', 'narrator').accessToken

    // Jogador encontra narrador pelo Código ID numérico e envia pedido de amizade
    expect(narProfile.publicId).toMatch(/^\d{10}$/)
    const searchNar = await request(app)
      .get(`/api/v1/court/players?q=${encodeURIComponent(narProfile.publicId!)}`)
      .set('Authorization', `Bearer ${tokenPlayer}`)
    expect(searchNar.status).toBe(200)
    expect(searchNar.body).toHaveLength(1)
    expect(searchNar.body[0].id).toBe(narProfile.publicId)
    expect(searchNar.body[0].role).toBe('narrator')

    const reqFriend = await request(app)
      .post('/api/v1/court/friends')
      .set('Authorization', `Bearer ${tokenPlayer}`)
      .send({ playerId: narProfile.publicId })
    expect(reqFriend.status).toBe(201)

    // Mesa privada ao vivo: bloqueia co-narrador enquanto allowCoNarrator=false
    const mesa = await createScheduledSession({
      title: 'Crônica Conjunta',
      scheduledAt: '2026-11-26T20:00:00.000Z',
      narratorEmail: narMain,
      listing: 'private',
      allowCoNarrator: false,
    })
    await updateScheduledSession(mesa.id, { status: 'open' })

    const deniedCo = await request(app)
      .post(`/api/v1/admin/chronicle/scheduled-sessions/${mesa.id}/join-co-narrator`)
      .set('Authorization', `Bearer ${tokenSec}`)
      .send({ accessCode: mesa.accessCode })
    expect(deniedCo.status).toBe(403)

    // Principal libera co-narrador; código errado falha, código certo entra
    await request(app)
      .patch(`/api/v1/admin/chronicle/scheduled-sessions/${mesa.id}`)
      .set('Authorization', `Bearer ${tokenMain}`)
      .send({ allowCoNarrator: true })

    const wrongCodeCo = await request(app)
      .post(`/api/v1/admin/chronicle/scheduled-sessions/${mesa.id}/join-co-narrator`)
      .set('Authorization', `Bearer ${tokenSec}`)
      .send({ accessCode: 'WRONG1' })
    expect(wrongCodeCo.status).toBe(403)

    const okCo = await request(app)
      .post(`/api/v1/admin/chronicle/scheduled-sessions/${mesa.id}/join-co-narrator`)
      .set('Authorization', `Bearer ${tokenSec}`)
      .send({ accessCode: mesa.accessCode })
    expect(okCo.status).toBe(200)

    const liveList = await request(app)
      .get('/api/v1/admin/chronicle/live-mesas')
      .set('Authorization', `Bearer ${tokenSec}`)
    expect(liveList.status).toBe(200)
    const entry = liveList.body.find((m: { id: string }) => m.id === mesa.id)
    expect(entry?.isCoNarrator).toBe(true)
    expect(entry?.accessCode).toBeUndefined()
  })

  it('hardens media URLs against IPv6/CGNAT SSRF, forged private:// refs, narrator ownership and backup access', async () => {
    expect(isSafePublicMediaUrl('http://[::ffff:169.254.169.254]/latest')).toBe(false)
    expect(isSafePublicMediaUrl('http://[fc00::1]/secret')).toBe(false)
    expect(isSafePublicMediaUrl('http://[fe80::1]/secret')).toBe(false)
    expect(isSafePublicMediaUrl('http://100.64.0.1/internal')).toBe(false)
    expect(isSafePublicMediaUrl('http://app.localhost/internal')).toBe(false)
    expect(isSafePublicMediaUrl('javascript:alert(1)')).toBe(false)

    const adminToken = signDevToken('admin.hardening@ci.local', 'Admin', 'admin').accessToken
    const narratorToken = signDevToken('narrador.hardening@ci.local', 'Narrador', 'narrator').accessToken

    // Forjar private:// ou javascript: em entidade ou importação é bloqueado
    const forgedCreate = await request(app)
      .post('/api/v1/admin/chronicle/entities')
      .set('Authorization', `Bearer ${narratorToken}`)
      .send({
        kind: 'download',
        name: 'Arquivo Forjado',
        description: 'Tentativa IDOR',
        downloadCategory: 'rules',
        fileName: 'segredo.pdf',
        fileUrl: 'private://revelacoes/outro-usuario.pdf',
      })
    expect(forgedCreate.status).toBe(400)

    const forgedImport = await request(app)
      .post('/api/v1/admin/chronicle/entities/import')
      .set('Authorization', `Bearer ${narratorToken}`)
      .send([
        {
          kind: 'archive',
          name: 'XSS Import',
          description: 'Teste',
          imageUrl: 'javascript:alert(1)',
        },
      ])
    expect(forgedImport.status).toBe(400)

    // Entidade global criada por admin não pode ser editada nem apagada por narrador comum
    const adminEntity = await request(app)
      .post('/api/v1/admin/chronicle/entities')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        kind: 'archive',
        archiveCategory: 'chronicles',
        name: 'Códice Global',
        description: 'Canônico',
      })
    expect(adminEntity.status).toBe(201)

    const narratorPatch = await request(app)
      .patch(`/api/v1/admin/chronicle/entities/${adminEntity.body.id}`)
      .set('Authorization', `Bearer ${narratorToken}`)
      .send({ name: 'Sequestrado' })
    expect(narratorPatch.status).toBe(403)

    const narratorDelete = await request(app)
      .delete(`/api/v1/admin/chronicle/entities/${adminEntity.body.id}`)
      .set('Authorization', `Bearer ${narratorToken}`)
    expect(narratorDelete.status).toBe(403)

    // Endpoints de backup exigem estritamente admin
    const narratorBackup = await request(app)
      .get('/api/v1/admin/chronicle/backup')
      .set('Authorization', `Bearer ${narratorToken}`)
    expect(narratorBackup.status).toBe(403)

    const narratorDrill = await request(app)
      .post('/api/v1/admin/chronicle/backup/drill')
      .set('Authorization', `Bearer ${narratorToken}`)
      .send({ backup: {} })
    expect(narratorDrill.status).toBe(403)

    const adminBackup = await request(app)
      .get('/api/v1/admin/chronicle/backup')
      .set('Authorization', `Bearer ${adminToken}`)
    expect(adminBackup.status).toBe(200)
  })

  it('organizes published species sheets and clan books in Compêndio and prevents players from uploading', async () => {
    const adminToken = signDevToken('mestre@ci.local', 'Mestre', 'narrator').accessToken
    const playerToken = signDevToken('jogador.fichas@ci.local', 'Jogador Fichas', 'player').accessToken

    const forbiddenUpload = await request(app)
      .post('/api/v1/admin/chronicle/entities')
      .set('Authorization', `Bearer ${playerToken}`)
      .send({
        kind: 'download',
        downloadCategory: 'rules',
        clan: 'Ravnos',
        name: 'Tentativa Jogador',
        fileName: 'livro.pdf',
      })
    expect(forbiddenUpload.status).toBe(403)

    const sheetRes = await request(app)
      .post('/api/v1/admin/chronicle/entities')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        kind: 'download',
        downloadCategory: 'sheets',
        sheetType: 'Vampiro',
        name: 'Ficha Vampiro Oficial',
        fileName: 'ficha-vampiro.pdf',
        fileUrl: 'https://cdn.example.org/fichas/vampiro.pdf',
      })
    expect(sheetRes.status).toBe(201)
    expect(sheetRes.body.sheetType).toBe('Vampiro')
    await request(app)
      .post(`/api/v1/admin/chronicle/entities/${sheetRes.body.id}/publish`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200)

    for (const idx of [1, 2, 3]) {
      const created = await request(app)
        .post('/api/v1/admin/chronicle/entities')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          kind: 'download',
          downloadCategory: 'rules',
          clan: 'Ravnos',
          name: `Livro Ravnos ${idx}`,
          fileName: `ravnos-${idx}.pdf`,
          fileUrl: `https://cdn.example.org/compendio/ravnos-${idx}.pdf`,
        })
      expect(created.status).toBe(201)
      expect(created.body.clan).toBe('Ravnos')

      await request(app)
        .post(`/api/v1/admin/chronicle/entities/${created.body.id}/publish`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200)
    }

    const playerSheets = await request(app)
      .get('/api/v1/content/downloads?category=sheets')
      .set('Authorization', `Bearer ${playerToken}`)
    expect(playerSheets.status).toBe(200)
    expect(playerSheets.body.files).toHaveLength(1)
    expect(playerSheets.body.files[0].sheetType).toBe('Vampiro')

    const playerBooks = await request(app)
      .get('/api/v1/content/downloads?category=rules')
      .set('Authorization', `Bearer ${playerToken}`)
    expect(playerBooks.status).toBe(200)
    expect(playerBooks.body.files).toHaveLength(3)
    expect(playerBooks.body.files.every((f: { clan?: string }) => f.clan === 'Ravnos')).toBe(true)
  })

  it('stores NPC and monster defense, abilities, classification, and updates lifeStatus to dead at 0 HP', async () => {
    const adminToken = signDevToken('admin.npc@ci.local', 'Adm', 'admin').accessToken
    const session = await createScheduledSession({
      title: 'Caçada Noturna',
      scheduledAt: '2026-11-28T21:00:00.000Z',
      narratorEmail: 'admin.npc@ci.local',
      listing: 'public',
    })

    const npcRes = await request(app)
      .post('/api/v1/admin/chronicle/entities')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        kind: 'npc',
        name: 'Lord Valerius',
        creatureType: 'Vampiro',
        threatLevel: 'perigoso',
        lifeStatus: 'alive',
        hpMax: 45,
        manaMax: 20,
        defense: 14,
        abilities: ['Dominação', 'Presença'],
      })
    expect(npcRes.status).toBe(201)
    expect(npcRes.body).toMatchObject({
      defense: 14,
      abilities: ['Dominação', 'Presença'],
      threatLevel: 'perigoso',
      lifeStatus: 'alive',
    })

    const monRes = await request(app)
      .post('/api/v1/admin/chronicle/entities')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        kind: 'monster',
        name: 'Gárgula Ancestral',
        creatureType: 'Constructo',
        threatLevel: 'letal',
        lifeStatus: 'alive',
        hpMax: 10,
        manaMax: 5,
        defense: 16,
        abilities: ['Pele de Pedra', 'Investida'],
      })
    expect(monRes.status).toBe(201)

    await request(app)
      .post(`/api/v1/admin/chronicle/entities/${monRes.body.id}/publish`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200)

    const addThreatRes = await request(app)
      .post(`/api/v1/admin/chronicle/scheduled-sessions/${session.id}/scene-threats`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ entityId: monRes.body.id })
    expect(addThreatRes.status).toBe(201)
    const threatId = addThreatRes.body.sceneThreats[0].id as string

    await request(app)
      .patch(`/api/v1/admin/chronicle/scheduled-sessions/${session.id}/scene-threats/${threatId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ hpDelta: -10 })
      .expect(200)

    const listRes = await request(app)
      .get('/api/v1/admin/chronicle/entities?kind=monster')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200)
    const updatedMonster = listRes.body.find((m: { id: string }) => m.id === monRes.body.id)
    expect(updatedMonster?.lifeStatus).toBe('dead')
  })
})
