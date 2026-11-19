import { randomUUID } from 'crypto'
import { Router } from 'express'
import { z } from 'zod'
import { catalogImageFolder, catalogImageIsPrivate, storeCatalogImage, withReadableImages } from '../../services/mediaStorage.js'
import { requireUser } from '../../middlewares/optionalUser.js'
import { requireNarrator } from '../../middlewares/requireNarrator.js'
import {
  createEntity,
  hydrateEntitiesFromDatabase,
  refreshEntitiesFromDatabase,
  createHandout,
  deleteEntity,
  getEntity,
  getHandout,
  listEntities,
  listHandouts,
  publishEntity,
  updateEntity,
  updateHandout,
  listScheduledSessions,
  createScheduledSession,
  updateScheduledSession,
  deleteScheduledSession,
  rescheduleSameTable,
  getScheduledSession,
  openScheduledSession,
  closeScheduledSession,
  sessionActivityLineSeries,
  adminMesaActivityStats,
  ensureHandoutForScheduledSession,
  patchMesaHandoutNarrative,
  addSceneThreat,
  applySceneThreatDelta,
  removeSceneThreat,
  addSceneNpc,
  removeSceneNpc,
  patchMesaAmbience,
  setMesaRestMode,
  listSceneThreatsForSession,
} from '../../services/chronicleStore.js'
import {
  adminPlayerCharactersByUser,
  applyCharacterXp,
  listProfiles,
  listRegisteredPlayers,
  reviewCharacter,
  advanceTurnEffects,
} from '../../services/profileStore.js'
import {
  addBoardCard,
  addSecret,
  campaignSnapshot,
  collectStorageManifest,
  drillBackup,
  listBoard,
  listSecrets,
  proposeRules,
  removeBoardCard,
  removeSecret,
  restoreBackup,
  validateStorageManifest,
  forgetSecretsForSession,
} from '../../services/campaignExtras.js'
import { listOperationsForSession } from '../../services/operationLog.js'
import { forgetRollsForSession } from '../../services/sessionRolls.js'
import { openSeats } from '../../services/chronicleStore.js'

export const adminChronicleRouter = Router()
adminChronicleRouter.use(requireUser, requireNarrator)

const attributeModSchema = z.object({
  attr: z.string().min(1).max(40),
  value: z.number().int().min(-20).max(20),
})

const entitySchema = z.object({
  kind: z.enum(['npc', 'monster', 'equipment', 'consumable', 'archive', 'download']),
  name: z.string().min(1).max(200),
  description: z.string().max(5000).default(''),
  archiveCategory: z.enum(['chronicles', 'relics', 'rituals']).optional(),
  shopCategory: z.enum(['gear', 'consumables', 'services']).optional(),
  downloadCategory: z.enum(['rules', 'sheets', 'handouts']).optional(),
  bestiaryTier: z.enum(['known', 'classified', 'rumors']).optional(),
  classification: z.enum(['grimoire', 'amulet', 'relic', 'monster']).optional(),
  creatureType: z.string().max(120).optional(),
  threatLevel: z.enum(['inofensivo', 'comum', 'perigoso', 'letal', 'cataclismico']).optional(),
  rarity: z.enum(['comum', 'incomum', 'raro', 'ancestral', 'proibido']).optional(),
  weightKg: z.number().min(0).optional(),
  imageUrl: z.string().max(1_500_000).optional(),
  hpMax: z.number().int().min(0).optional(),
  manaMax: z.number().int().min(0).optional(),
  location: z.string().max(200).optional(),
  attributeMods: z.array(attributeModSchema).max(3).optional(),
  relicAmuletType: z.string().max(120).optional(),
  magicType: z.string().max(120).optional(),
  cooldownText: z.string().max(120).optional(),
  equipmentType: z.string().max(120).optional(),
  serviceType: z.string().max(120).optional(),
  consumableKind: z.enum(['daily', 'food']).optional(),
  stockTotal: z.number().int().min(0).optional(),
  statsText: z.string().max(3000).optional(),
  priceGold: z.number().int().min(0).optional(),
  priceSilver: z.number().int().min(0).optional(),
  priceCopper: z.number().int().min(0).optional(),
  fileName: z.string().max(255).optional(),
  fileUrl: z.string().max(1_500_000).optional(),
  creatureSize: z.string().max(80).optional(),
  creatureSpeed: z.string().max(80).optional(),
  creatureSenses: z.string().max(200).optional(),
  defenseNote: z.string().max(500).optional(),
  primaryAttackName: z.string().max(120).optional(),
  primaryAttackDesc: z.string().max(2000).optional(),
  secondaryAttackName: z.string().max(120).optional(),
  secondaryAttackDesc: z.string().max(2000).optional(),
  sceneTrigger: z.string().max(2000).optional(),
  narratorNotes: z.string().max(5000).optional(),
  creatureStats: z
    .object({
      for: z.number().int().min(1).max(10),
      des: z.number().int().min(1).max(10),
      vig: z.number().int().min(1).max(10),
      int: z.number().int().min(1).max(10),
      sab: z.number().int().min(1).max(10),
      car: z.number().int().min(1).max(10),
    })
    .optional(),
  passiveTraits: z.array(z.string().max(200)).max(12).optional(),
  chronicleScope: z.string().max(160).nullable().optional(),
  narratorScope: z.string().email().nullable().optional(),
})

function mapImportRow(row: unknown, fieldMap?: Record<string, string>) {
  if (!row || typeof row !== 'object' || !fieldMap) return row
  const source = row as Record<string, unknown>
  const out: Record<string, unknown> = { ...source }
  for (const [from, to] of Object.entries(fieldMap)) {
    if (from in source) out[to] = source[from]
  }
  return out
}

adminChronicleRouter.get('/entities', async (req, res) => {
  await refreshEntitiesFromDatabase()
  const kind = req.query.kind as string | undefined
  const parsed = z.enum(['npc', 'monster', 'equipment', 'consumable', 'archive', 'download']).optional().safeParse(kind)
  const rows = listEntities(parsed.success ? { kind: parsed.data } : undefined)
  res.json(await withReadableImages(rows))
})

adminChronicleRouter.post('/entities', async (req, res, next) => {
  try {
    const body = entitySchema.parse(req.body)
    const id = randomUUID()
    const imageUrl = await storeCatalogImage(
      catalogImageFolder(body),
      id,
      body.imageUrl,
      catalogImageIsPrivate(body) ? 'private' : 'public',
    )
    res.status(201).json(await createEntity({ ...body, id, imageUrl, visibility: 'draft' }))
  } catch (e) {
    next(e)
  }
})

/** Importação em lote (planilha/JSON) — sempre rascunho até publicar no site. */
adminChronicleRouter.post('/entities/import', async (req, res, next) => {
  try {
    const envelope = z
      .union([
        z.array(z.unknown()).max(500),
        z.object({ rows: z.array(z.unknown()).max(500), fieldMap: z.record(z.string(), z.string()).optional() }),
      ])
      .parse(req.body)
    const raw = Array.isArray(envelope) ? envelope : envelope.rows
    const fieldMap = Array.isArray(envelope) ? undefined : envelope.fieldMap
    const rows: z.infer<typeof entitySchema>[] = []
    const rejected: Array<{ line: number; name?: string; message: string }> = []
    for (let index = 0; index < raw.length; index += 1) {
      const mapped = mapImportRow(raw[index], fieldMap)
      const parsed = entitySchema.safeParse(mapped)
      if (!parsed.success) {
        const name =
          raw[index] && typeof raw[index] === 'object' && 'name' in (raw[index] as object)
            ? String((raw[index] as { name?: unknown }).name ?? '')
            : undefined
        rejected.push({
          line: index + 1,
          name: name || undefined,
          message: parsed.error.issues[0]?.message ?? 'Linha inválida',
        })
        continue
      }
      rows.push(parsed.data)
    }
    if (req.query.preview === '1') {
      const names = new Set(listEntities().map((item) => `${item.kind}:${item.name.trim().toLowerCase()}`))
      let create = 0
      let duplicate = 0
      for (const row of rows) {
        const key = `${row.kind}:${row.name.trim().toLowerCase()}`
        if (names.has(key)) duplicate += 1
        else {
          create += 1
          names.add(key)
        }
      }
      res.json({
        preview: true,
        create,
        duplicate,
        rejected: rejected.length,
        rejections: rejected,
        total: raw.length,
      })
      return
    }
    if (rejected.length) {
      res.status(400).json({
        error: {
          message: 'Há linhas inválidas na importação. Use ?preview=1 antes de confirmar.',
        },
        rejected,
      })
      return
    }
    const names = new Set(listEntities().map((item) => `${item.kind}:${item.name.trim().toLowerCase()}`))
    const created = []
    let skipped = 0
    for (const row of rows) {
      const key = `${row.kind}:${row.name.trim().toLowerCase()}`
      if (names.has(key)) {
        skipped += 1
        continue
      }
      names.add(key)
      created.push(await createEntity({ ...row, visibility: 'draft' }))
    }
    res.status(201).json({ imported: created.length, skipped, items: created })
  } catch (e) {
    next(e)
  }
})

adminChronicleRouter.post('/entities/sync-from-database', async (_req, res, next) => {
  try {
    await hydrateEntitiesFromDatabase()
    res.json({ ok: true })
  } catch (e) {
    next(e)
  }
})

adminChronicleRouter.patch('/entities/:id', async (req, res, next) => {
  try {
    const body = entitySchema.partial().parse(req.body)
    const current = getEntity(req.params.id)
    if (!current) {
      res.status(404).json({ error: { message: 'Registro não encontrado' } })
      return
    }
    const patch = { ...body }
    if (body.imageUrl !== undefined) {
      const nextKind = { ...current, ...body }
      patch.imageUrl = await storeCatalogImage(
        catalogImageFolder(nextKind),
        current.id,
        body.imageUrl,
        catalogImageIsPrivate(nextKind) ? 'private' : 'public',
      )
    }
    const updated = await updateEntity(req.params.id, patch)
    if (!updated) {
      res.status(404).json({ error: { message: 'Registro não encontrado' } })
      return
    }
    res.json(updated)
  } catch (e) {
    next(e)
  }
})

adminChronicleRouter.post('/entities/:id/publish', async (req, res, next) => {
  try {
    const updated = await publishEntity(req.params.id)
    if (!updated) {
      res.status(404).json({ error: { message: 'Registro não encontrado' } })
      return
    }
    res.json(updated)
  } catch (e) {
    next(e)
  }
})

adminChronicleRouter.delete('/entities/:id', async (req, res, next) => {
  try {
    if (!getEntity(req.params.id)) {
      res.status(404).json({ error: { message: 'Registro não encontrado' } })
      return
    }
    await deleteEntity(req.params.id)
    res.status(204).send()
  } catch (e) {
    next(e)
  }
})

const handoutSchema = z.object({
  title: z.string().min(1).max(200),
  narrativeSummary: z.string().max(20_000).default(''),
  npcIds: z.array(z.string()).default([]),
  monstersSlain: z
    .array(
      z.object({
        entityId: z.string(),
        name: z.string(),
        statsText: z.string().optional(),
      }),
    )
    .default([]),
  participants: z
    .array(
      z.object({
        displayName: z.string(),
        characterName: z.string(),
        rewards: z.array(
          z.object({
            type: z.enum(['equipment', 'consumable', 'currency', 'xp']),
            label: z.string(),
            entityId: z.string().optional(),
            gold: z.number().int().min(0).optional(),
            silver: z.number().int().min(0).optional(),
            xp: z.number().int().min(1).max(250).optional(),
          }),
        ),
      }),
    )
    .default([]),
  missions: z
    .array(
      z.object({
        title: z.string(),
        priority: z.enum(['baixa', 'media', 'alta']),
      }),
    )
    .default([]),
})

adminChronicleRouter.get('/handouts', (_req, res) => {
  res.json(listHandouts(true))
})

adminChronicleRouter.post('/handouts', (req, res, next) => {
  try {
    const body = handoutSchema.parse(req.body)
    res.status(201).json(createHandout(body))
  } catch (e) {
    next(e)
  }
})

adminChronicleRouter.patch('/handouts/:id', (req, res, next) => {
  try {
    const patch = handoutSchema
      .partial()
      .extend({
        status: z.enum(['pending_close', 'closed']).optional(),
        publishedToPlayers: z.boolean().optional(),
        restMode: z.boolean().optional(),
        chronicleAmbience: z
          .object({
            environment: z.string(),
            climate: z.string(),
            moon: z.string(),
            atmosphere: z.string(),
          })
          .optional(),
      })
      .parse(req.body)
    const updated = updateHandout(req.params.id, patch)
    if (!updated) {
      res.status(404).json({ error: { message: 'Handout não encontrado' } })
      return
    }
    res.json(updated)
  } catch (e) {
    next(e)
  }
})

adminChronicleRouter.get('/handouts/:id', (req, res) => {
  const row = getHandout(req.params.id)
  if (!row) {
    res.status(404).json({ error: { message: 'Handout não encontrado' } })
    return
  }
  res.json(row)
})

adminChronicleRouter.get('/scheduled-sessions', (_req, res) => {
  res.json(listScheduledSessions())
})

const sessionTableMetaSchema = z.object({
  rpgTitle: z.string().max(200).optional().default(''),
  campaignName: z.string().max(120).optional().default(''),
  sessionLabel: z.string().max(120).optional().default(''),
  arcTitle: z.string().max(200).optional().default(''),
  missionTitle: z.string().max(200).optional().default(''),
  playerGroup: z.string().max(120).optional().default(''),
  targetDuration: z.string().max(80).optional().default(''),
  recommendedLevels: z.string().max(120).optional().default(''),
  sessionOrdinal: z.number().optional(),
})

const scheduledSchema = z.object({
  title: z.string().min(1).max(200),
  scheduledAt: z.string().min(1),
  chronicleName: z.string().min(1).max(120).optional(),
  tableMeta: sessionTableMetaSchema.optional(),
  listing: z.enum(['public', 'private']).optional(),
})

const patchScheduledSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  chronicleName: z.string().min(1).max(120).optional(),
  tableMeta: sessionTableMetaSchema.optional(),
  listing: z.enum(['public', 'private']).optional(),
})

adminChronicleRouter.post('/scheduled-sessions', (req, res, next) => {
  try {
    const body = scheduledSchema.parse(req.body)
    const tableMeta = body.tableMeta
      ? {
          rpgTitle: body.tableMeta.rpgTitle,
          campaignName: body.tableMeta.campaignName,
          sessionLabel: body.tableMeta.sessionLabel,
          arcTitle: body.tableMeta.arcTitle,
          missionTitle: body.tableMeta.missionTitle,
          playerGroup: body.tableMeta.playerGroup,
          targetDuration: body.tableMeta.targetDuration,
          recommendedLevels: body.tableMeta.recommendedLevels,
          sessionOrdinal: body.tableMeta.sessionOrdinal,
        }
      : undefined
    res.status(201).json(
      createScheduledSession({
        title: body.title,
        scheduledAt: body.scheduledAt,
        chronicleName: body.chronicleName,
        tableMeta,
        narratorEmail: req.user!.email,
        listing: body.listing,
      }),
    )
  } catch (e) {
    next(e)
  }
})

adminChronicleRouter.patch('/scheduled-sessions/:sessionId', (req, res, next) => {
  try {
    const body = patchScheduledSchema.parse(req.body)
    const row = getScheduledSession(req.params.sessionId)
    if (!row) {
      res.status(404).json({ error: { message: 'Mesa não encontrada' } })
      return
    }
    const tableMeta = body.tableMeta
      ? {
          rpgTitle: body.tableMeta.rpgTitle,
          campaignName: body.tableMeta.campaignName,
          sessionLabel: body.tableMeta.sessionLabel,
          arcTitle: body.tableMeta.arcTitle,
          missionTitle: body.tableMeta.missionTitle,
          playerGroup: body.tableMeta.playerGroup,
          targetDuration: body.tableMeta.targetDuration,
          recommendedLevels: body.tableMeta.recommendedLevels,
          sessionOrdinal: body.tableMeta.sessionOrdinal,
        }
      : undefined
    const nextRow = updateScheduledSession(req.params.sessionId, {
      ...body,
      tableMeta,
    })
    res.json(nextRow)
  } catch (e) {
    next(e)
  }
})

adminChronicleRouter.delete('/scheduled-sessions/:sessionId', (req, res) => {
  const result = deleteScheduledSession(req.params.sessionId, req.user!.email)
  if (!result.ok) {
    if (result.reason === 'open') {
      res.status(409).json({
        error: { message: 'Encerre a mesa ao vivo antes de excluí-la.' },
      })
      return
    }
    res.status(result.reason === 'forbidden' ? 403 : 404).json({
      error: { message: result.reason === 'forbidden' ? 'Sem permissão nesta mesa' : 'Mesa não encontrada' },
    })
    return
  }
  forgetSecretsForSession(req.params.sessionId)
  forgetRollsForSession(req.params.sessionId)
  res.status(204).end()
})

adminChronicleRouter.post('/scheduled-sessions/:sessionId/reschedule', (req, res) => {
  const result = rescheduleSameTable(req.params.sessionId, req.user!.email)
  if (!result.ok) {
    const message =
      result.reason === 'forbidden'
        ? 'Sem permissão nesta mesa'
        : result.reason === 'not_closed'
          ? 'Só uma mesa encerrada pode ser remarcada.'
          : 'Mesa não encontrada'
    res.status(result.reason === 'forbidden' ? 403 : result.reason === 'not_closed' ? 409 : 404).json({ error: { message } })
    return
  }
  res.status(201).json(result.session)
})

adminChronicleRouter.post('/scheduled-sessions/:sessionId/open', (req, res) => {
  const result = openScheduledSession(req.params.sessionId, req.user!.email)
  if (!result.ok) {
    const message =
      result.reason === 'forbidden'
        ? 'Sem permissão nesta mesa'
        : result.reason === 'closed'
          ? 'Mesa encerrada. Remarque uma nova sessão nesta mesa.'
          : 'Mesa não encontrada'
    res.status(result.reason === 'forbidden' ? 403 : result.reason === 'closed' ? 409 : 404).json({ error: { message } })
    return
  }
  res.json(result.session)
})

adminChronicleRouter.post('/scheduled-sessions/:sessionId/close', (req, res) => {
  const result = closeScheduledSession(req.params.sessionId, req.user!.email)
  if (!result.ok) {
    res.status(result.reason === 'forbidden' ? 403 : 404).json({
      error: { message: result.reason === 'forbidden' ? 'Sem permissão nesta mesa' : 'Mesa não encontrada' },
    })
    return
  }
  res.json(result.session)
})

adminChronicleRouter.get('/scheduled-sessions/:sessionId/handout', (req, res) => {
  const row = ensureHandoutForScheduledSession(req.params.sessionId)
  if (!row) {
    res.status(404).json({ error: { message: 'Mesa não encontrada' } })
    return
  }
  res.json(row)
})

adminChronicleRouter.patch('/scheduled-sessions/:sessionId/handout/narrative', (req, res, next) => {
  try {
    const { narrativeSummary } = z.object({ narrativeSummary: z.string().max(20_000) }).parse(req.body)
    const updated = patchMesaHandoutNarrative(req.params.sessionId, narrativeSummary)
    if (!updated) {
      res.status(404).json({ error: { message: 'Handout da mesa não encontrado' } })
      return
    }
    res.json(updated)
  } catch (e) {
    next(e)
  }
})

adminChronicleRouter.post('/scheduled-sessions/:sessionId/scene-threats', (req, res, next) => {
  try {
    const { entityId } = z.object({ entityId: z.string().min(1) }).parse(req.body)
    const result = addSceneThreat(req.params.sessionId, entityId, req.user!.email)
    if (!result.ok) {
      if (result.reason === 'forbidden') {
        res.status(403).json({ error: { message: 'Somente o mestre que abriu esta mesa pode adicionar ameaças.' } })
        return
      }
      if (result.reason === 'bad_entity') {
        res.status(400).json({ error: { message: 'Selecione um monstro válido do bestiário.' } })
        return
      }
      res.status(404).json({ error: { message: 'Mesa não encontrada' } })
      return
    }
    res.status(201).json(result.handout)
  } catch (e) {
    next(e)
  }
})

adminChronicleRouter.patch('/scheduled-sessions/:sessionId/scene-threats/:threatId', (req, res, next) => {
  try {
    const body = z
      .object({
        hpDelta: z.number().int().optional(),
        manaDelta: z.number().int().optional(),
      })
      .parse(req.body)
    const result = applySceneThreatDelta(req.params.sessionId, req.params.threatId, req.user!.email, body)
    if (!result.ok) {
      if (result.reason === 'forbidden') {
        res.status(403).json({ error: { message: 'Somente o mestre que abriu esta mesa pode alterar ameaças.' } })
        return
      }
      res.status(404).json({ error: { message: 'Ameaça ou mesa não encontrada' } })
      return
    }
    res.json(result.handout)
  } catch (e) {
    next(e)
  }
})

adminChronicleRouter.delete('/scheduled-sessions/:sessionId/scene-threats/:threatId', (req, res) => {
  const result = removeSceneThreat(req.params.sessionId, req.params.threatId, req.user!.email)
  if (!result.ok) {
    if (result.reason === 'forbidden') {
      res.status(403).json({ error: { message: 'Somente o mestre que abriu esta mesa pode remover ameaças.' } })
      return
    }
    res.status(404).json({ error: { message: 'Ameaça ou mesa não encontrada' } })
    return
  }
  res.json(result.handout)
})

adminChronicleRouter.post('/scheduled-sessions/:sessionId/scene-npcs', (req, res, next) => {
  try {
    const { entityId } = z.object({ entityId: z.string().min(1) }).parse(req.body)
    const result = addSceneNpc(req.params.sessionId, entityId, req.user!.email)
    if (!result.ok) {
      if (result.reason === 'forbidden') {
        res.status(403).json({ error: { message: 'Somente o mestre que abriu esta mesa pode adicionar NPCs.' } })
        return
      }
      if (result.reason === 'bad_entity') {
        res.status(400).json({ error: { message: 'Selecione um NPC válido do acervo.' } })
        return
      }
      res.status(404).json({ error: { message: 'Mesa não encontrada' } })
      return
    }
    res.status(201).json(result.handout)
  } catch (e) {
    next(e)
  }
})

adminChronicleRouter.delete('/scheduled-sessions/:sessionId/scene-npcs/:npcId', (req, res) => {
  const result = removeSceneNpc(req.params.sessionId, req.params.npcId, req.user!.email)
  if (!result.ok) {
    if (result.reason === 'forbidden') {
      res.status(403).json({ error: { message: 'Somente o mestre que abriu esta mesa pode remover NPCs.' } })
      return
    }
    res.status(404).json({ error: { message: 'NPC ou mesa não encontrada' } })
    return
  }
  res.json(result.handout)
})

adminChronicleRouter.patch('/scheduled-sessions/:sessionId/handout/ambience', (req, res, next) => {
  try {
    const body = z
      .object({
        environment: z.string().max(120).optional(),
        climate: z.string().max(120).optional(),
        moon: z.string().max(120).optional(),
        atmosphere: z.string().max(120).optional(),
      })
      .parse(req.body)
    const result = patchMesaAmbience(req.params.sessionId, body, req.user!.email)
    if (!result.ok) {
      if (result.reason === 'forbidden') {
        res.status(403).json({ error: { message: 'Somente o mestre que abriu esta mesa pode alterar a governança.' } })
        return
      }
      res.status(404).json({ error: { message: 'Mesa não encontrada' } })
      return
    }
    res.json(result.handout)
  } catch (e) {
    next(e)
  }
})

adminChronicleRouter.patch('/scheduled-sessions/:sessionId/handout/rest-mode', (req, res, next) => {
  try {
    const { restMode } = z.object({ restMode: z.boolean() }).parse(req.body)
    const result = setMesaRestMode(req.params.sessionId, restMode, req.user!.email)
    if (!result.ok) {
      if (result.reason === 'forbidden') {
        res.status(403).json({ error: { message: 'Somente o mestre que abriu esta mesa pode alterar o descanso.' } })
        return
      }
      res.status(404).json({ error: { message: 'Mesa não encontrada' } })
      return
    }
    res.json(result.handout)
  } catch (e) {
    next(e)
  }
})

/** Concede XP real ao personagem do assento na mesa (+ registro no handout). */
adminChronicleRouter.post('/award-xp', (req, res, next) => {
  try {
    const body = z
      .object({
        sessionId: z.string().min(1),
        participantDisplayName: z.string().min(1),
        amount: z.number().int().min(1).max(250),
      })
      .parse(req.body)

    const session = getScheduledSession(body.sessionId)
    if (!session) {
      res.status(404).json({ error: { message: 'Sessão não encontrada' } })
      return
    }

    const seat =
      (session.seats ?? []).find(
        (s) =>
          !s.leftAt &&
          s.displayName.trim().toLowerCase() === body.participantDisplayName.trim().toLowerCase(),
      ) ?? null

    if (!seat) {
      res.status(404).json({
        error: { message: 'Participante sem assento na mesa. O jogador precisa entrar com personagem.' },
      })
      return
    }

    const updated = applyCharacterXp(seat.email, seat.characterId, body.amount, {
      actorEmail: req.user!.email,
      sessionId: body.sessionId,
    })
    if (!updated) {
      res.status(404).json({ error: { message: 'Personagem do participante não encontrado' } })
      return
    }

    const handout = ensureHandoutForScheduledSession(body.sessionId)
    if (handout) {
      const participants = handout.participants.map((p) => {
        if (p.displayName.trim().toLowerCase() !== body.participantDisplayName.trim().toLowerCase()) {
          return p
        }
        return {
          ...p,
          rewards: [
            ...p.rewards,
            { type: 'xp' as const, label: `+${body.amount} XP`, xp: body.amount },
          ],
        }
      })
      const hasParticipant = participants.some(
        (p) => p.displayName.trim().toLowerCase() === body.participantDisplayName.trim().toLowerCase(),
      )
      const nextParticipants = hasParticipant
        ? participants
        : [
            ...participants,
            {
              displayName: seat.displayName,
              characterName: seat.characterName,
              rewards: [{ type: 'xp' as const, label: `+${body.amount} XP`, xp: body.amount }],
            },
          ]
      updateHandout(handout.id, { participants: nextParticipants })
    }

    res.json(updated)
  } catch (e) {
    next(e)
  }
})

adminChronicleRouter.get('/character-reviews', (_req, res) => {
  const rows = listProfiles().flatMap((profile) =>
    profile.characters
      .filter((character) => character.approval)
      .map((character) => ({
        email: profile.email,
        displayName: profile.displayName,
        characterId: character.id,
        name: character.name,
        level: character.level,
        clan: character.clan ?? null,
        approval: character.approval,
        reviewNote: character.reviewNote ?? null,
      })),
  )
  rows.sort((a, b) => {
    const rank = (status: string | undefined) => (status === 'submitted' ? 0 : status === 'changes' ? 1 : 2)
    return rank(a.approval) - rank(b.approval) || a.displayName.localeCompare(b.displayName)
  })
  res.json(rows)
})

adminChronicleRouter.post('/characters/:email/:characterId/review', (req, res, next) => {
  try {
    const body = z
      .object({ status: z.enum(['approved', 'changes']), note: z.string().max(500).optional() })
      .parse(req.body)
    const updated = reviewCharacter(
      req.params.email,
      req.params.characterId,
      body.status,
      body.note ?? '',
      req.user!.email,
    )
    if (!updated) {
      res.status(404).json({ error: { message: 'Personagem não encontrado' } })
      return
    }
    res.json(updated)
  } catch (e) {
    next(e)
  }
})

adminChronicleRouter.get('/backup', (_req, res) => {
  res.json(campaignSnapshot())
})

adminChronicleRouter.post('/backup/drill', (req, res, next) => {
  try {
    res.json(drillBackup(req.body ?? {}))
  } catch (e) {
    next(e)
  }
})

adminChronicleRouter.post('/backup/validate-storage', (req, res, next) => {
  try {
    const body = z
      .object({ paths: z.array(z.string()).max(2000).optional() })
      .parse(req.body ?? {})
    const paths = body.paths?.length ? body.paths : collectStorageManifest()
    res.json(validateStorageManifest(paths))
  } catch (e) {
    next(e)
  }
})

adminChronicleRouter.post('/backup/restore', (req, res, next) => {
  try {
    const body = z.object({ confirm: z.literal('restaurar-copia'), backup: z.record(z.string(), z.unknown()) }).parse(req.body)
    res.json(restoreBackup(body.backup as Parameters<typeof restoreBackup>[0]))
  } catch (e) {
    next(e)
  }
})

adminChronicleRouter.get('/board', (_req, res) => {
  res.json(listBoard())
})

adminChronicleRouter.post('/board', (req, res, next) => {
  try {
    const body = z
      .object({
        kind: z.enum(['mystery', 'mission', 'place', 'pending', 'npc']),
        title: z.string().min(1).max(160),
        status: z.enum(['confirmed', 'proposed', 'pending']),
        detail: z.string().max(2000).optional(),
        owner: z.string().max(120).optional(),
        priority: z.enum(['baixa', 'media', 'alta']).optional(),
      })
      .parse(req.body)
    res.status(201).json(
      addBoardCard({
        kind: body.kind,
        title: body.title,
        status: body.status,
        detail: body.detail ?? '',
        owner: body.owner ?? '',
        priority: body.priority ?? 'media',
      }),
    )
  } catch (e) {
    next(e)
  }
})

adminChronicleRouter.delete('/board/:id', (req, res) => {
  if (!removeBoardCard(req.params.id)) {
    res.status(404).json({ error: { message: 'Cartão não encontrado' } })
    return
  }
  res.json({ ok: true })
})

adminChronicleRouter.get('/rules', (_req, res) => {
  res.json(campaignSnapshot().rules)
})

adminChronicleRouter.post('/rules', (req, res, next) => {
  try {
    const body = z
      .object({
        maxLevel: z.number().int().min(1).max(20),
        subclassLevel: z.number().int().min(1).max(20),
        startingXp: z.number().int().min(0).max(10_000).optional(),
        shopBudgetCopper: z.number().int().min(0).max(1_000_000).optional(),
        decision: z.enum(['keep-existing', 'mark-review']),
      })
      .parse(req.body)
    res.json(
      proposeRules(
        {
          maxLevel: body.maxLevel,
          subclassLevel: body.subclassLevel,
          startingXp: body.startingXp ?? 0,
          shopBudgetCopper: body.shopBudgetCopper ?? 0,
        },
        body.decision,
      ),
    )
  } catch (e) {
    next(e)
  }
})

adminChronicleRouter.get('/secrets', (req, res) => {
  const sessionId = typeof req.query.sessionId === 'string' ? req.query.sessionId : undefined
  res.json(listSecrets(sessionId))
})

adminChronicleRouter.post('/secrets', (req, res, next) => {
  try {
    const body = z
      .object({
        sessionId: z.string().min(1),
        entityId: z.string().min(1),
        audienceEmail: z.string().email().nullable().optional(),
        text: z.string().min(1).max(2000),
      })
      .parse(req.body)
    res.status(201).json(
      addSecret({
        sessionId: body.sessionId,
        entityId: body.entityId,
        audienceEmail: body.audienceEmail ?? null,
        text: body.text,
      }),
    )
  } catch (e) {
    next(e)
  }
})

adminChronicleRouter.delete('/secrets/:id', (req, res) => {
  if (!removeSecret(req.params.id)) {
    res.status(404).json({ error: { message: 'Segredo não encontrado' } })
    return
  }
  res.json({ ok: true })
})

adminChronicleRouter.post('/sessions/:sessionId/advance-turn', (req, res) => {
  const targets = openSeats(req.params.sessionId).map((seat) => ({
    email: seat.email,
    characterId: seat.characterId,
  }))
  res.json({ changed: advanceTurnEffects(targets) })
})

adminChronicleRouter.get('/analytics/session-line', (_req, res) => {
  res.json(sessionActivityLineSeries())
})

adminChronicleRouter.get('/analytics/mesa-activity', (_req, res) => {
  res.json(adminMesaActivityStats())
})

adminChronicleRouter.get('/analytics/player-characters', (_req, res) => {
  res.json(adminPlayerCharactersByUser())
})

adminChronicleRouter.get('/sessions/:sessionId/operations', (req, res) => {
  res.json(listOperationsForSession(req.params.sessionId))
})

adminChronicleRouter.get('/registered-players', (_req, res) => {
  res.json(listRegisteredPlayers())
})
