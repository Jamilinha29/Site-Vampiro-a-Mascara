import { randomUUID } from 'node:crypto'
import { Router } from 'express'
import { z } from 'zod'
import { requireUser } from '../../middlewares/optionalUser.js'
import { requireAdmin, requireNarrator } from '../../middlewares/requireNarrator.js'
import {
  addBoardCard,
  addSecret,
  campaignSnapshot,
  collectStorageManifest,
  drillBackup,
  forgetSecretsForSession,
  listBackupMetadata,
  listBoard,
  listSecrets,
  proposeRules,
  removeBoardCard,
  removeSecret,
  restoreBackup,
  validateStorageManifest,
} from '../../services/campaignExtras.js'
import {
  addSceneNpc,
  addSceneThreat,
  adminMesaActivityStats,
  applySceneThreatDelta,
  closeScheduledSession,
  createEntity,
  createHandout,
  createScheduledSession,
  deleteEntity,
  deleteScheduledSession,
  ensureHandoutForScheduledSession,
  getEntity,
  getHandout,
  hydrateEntitiesFromDatabase,
  isSessionManager,
  joinSessionAsCoNarrator,
  listEntities,
  listHandouts,
  listLiveMesasForNarrator,
  listScheduledSessionsForManager,
  listSessionActions,
  openScheduledSession,
  openSeats,
  patchMesaAmbience,
  patchMesaHandoutNarrative,
  patchMesaHandoutWhisper,
  publishEntity,
  refreshEntitiesFromDatabase,
  removeSceneNpc,
  removeSceneThreat,
  requireSessionManager,
  rescheduleSameTable,
  rotateSessionAccessCode,
  sessionActivityLineSeries,
  setMesaRestMode,
  sharesAnyManagedSession,
  syncSessionsIfStale,
  toNarratorSessionDTO,
  updateEntity,
  updateHandout,
  updateScheduledSession,
} from '../../services/chronicleStore.js'
import { areFriends } from '../../services/courtStore.js'
import { errorPayload, ValidationError } from '../../services/errors.js'
import { runIdempotent } from '../../services/idempotencyStore.js'
import {
  catalogImageFolder,
  catalogImageIsPrivate,
  deleteStoredMedia,
  isSafePublicMediaUrl,
  storeCatalogDownloadFile,
  storeCatalogImage,
  withReadableImages,
} from '../../services/mediaStorage.js'
import { listOperationsForSession } from '../../services/operationLog.js'
import { checkSharedRateLimit, resetSharedRateLimit } from '../../services/rateLimitStore.js'
import {
  MAX_CHARACTER_LEVEL,
  adminPlayerCharactersByUser,
  advanceTurnEffects,
  applyCharacterXp,
  listCharacterRevisions,
  listProfiles,
  listRegisteredPlayers,
  publicPlayerId,
  restoreCharacterRevision,
  reviewCharacter,
  syncProfilesIfStale,
} from '../../services/profileStore.js'
import { forgetRollsForSession } from '../../services/sessionRolls.js'

export const adminChronicleRouter = Router()
adminChronicleRouter.use(requireUser, requireNarrator)
adminChronicleRouter.use((_req, _res, next) => {
  void Promise.all([syncSessionsIfStale(), syncProfilesIfStale()])
    .then(() => next())
    .catch(() => next())
})

function canManageEntity(entity: { narratorScope?: string | null }, user: { email: string; role: string }) {
  if (user.role === 'admin') return true
  if (!entity.narratorScope) return true
  return entity.narratorScope.trim().toLowerCase() === user.email.trim().toLowerCase()
}

function canEditEntity(entity: { narratorScope?: string | null }, user: { email: string; role: string }) {
  if (user.role === 'admin') return true
  if (!entity.narratorScope) return false
  return entity.narratorScope.trim().toLowerCase() === user.email.trim().toLowerCase()
}

function validateNonDownloadFileUrl(url?: string) {
  if (!url) return url
  if (!isSafePublicMediaUrl(url)) {
    throw new ValidationError('URL de arquivo inválida.')
  }
  return url
}

function canInspectPlayer(narrator: { email: string; role: string }, playerEmail: string) {
  if (narrator.role === 'admin') return true
  return (
    sharesAnyManagedSession(narrator.email, playerEmail) ||
    areFriends(narrator.email, playerEmail)
  )
}

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
  imageUrl: z.string().max(1_500_000).nullable().optional(),
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

adminChronicleRouter.get('/entities', async (req, res, next) => {
  try {
    await refreshEntitiesFromDatabase()
    const kind = req.query.kind as string | undefined
    const parsed = z
      .enum(['npc', 'monster', 'equipment', 'consumable', 'archive', 'download'])
      .optional()
      .safeParse(kind)
    const rows = listEntities(parsed.success ? { kind: parsed.data } : undefined).filter((row) =>
      canManageEntity(row, req.user!),
    )
    res.json(await withReadableImages(rows))
  } catch (e) {
    next(e)
  }
})

adminChronicleRouter.post('/entities', async (req, res, next) => {
  try {
    const body = entitySchema.parse(req.body)
    const id = randomUUID()
    const imageUrl = body.imageUrl
      ? await storeCatalogImage(
          catalogImageFolder(body),
          id,
          body.imageUrl,
          catalogImageIsPrivate(body) ? 'private' : 'public',
        )
      : undefined
    const fileUrl =
      body.kind === 'download' && body.fileUrl
        ? await storeCatalogDownloadFile(id, body.fileUrl, undefined)
        : validateNonDownloadFileUrl(body.fileUrl)
    const narratorScope =
      req.user!.role === 'admin' ? (body.narratorScope ?? null) : req.user!.email.toLowerCase()
    const created = await createEntity({
      ...body,
      id,
      imageUrl,
      fileUrl,
      narratorScope,
      visibility: 'draft',
    })
    res.status(201).json((await withReadableImages([created]))[0])
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
        ...errorPayload('VALIDATION_ERROR', 'Há linhas inválidas na importação. Use ?preview=1 antes de confirmar.', {
          requestId: req.requestId,
        }),
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
      const id = randomUUID()
      const imageUrl = row.imageUrl
        ? await storeCatalogImage(
            catalogImageFolder(row),
            id,
            row.imageUrl,
            catalogImageIsPrivate(row) ? 'private' : 'public',
            undefined,
          )
        : undefined
      const fileUrl =
        row.kind === 'download' && row.fileUrl
          ? await storeCatalogDownloadFile(id, row.fileUrl, undefined)
          : validateNonDownloadFileUrl(row.fileUrl)
      const narratorScope =
        req.user!.role === 'admin' ? (row.narratorScope ?? null) : req.user!.email.toLowerCase()
      created.push(await createEntity({ ...row, id, imageUrl, fileUrl, narratorScope, visibility: 'draft' }))
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
    await refreshEntitiesFromDatabase()
    const body = entitySchema.partial().parse(req.body)
    const current = getEntity(req.params.id)
    if (!current) {
      res.status(404).json(errorPayload('NOT_FOUND', 'Registro não encontrado', { requestId: req.requestId }))
      return
    }
    if (!canEditEntity(current, req.user!)) {
      res.status(403).json(errorPayload('FORBIDDEN', 'Sem permissão para alterar este item.', { requestId: req.requestId }))
      return
    }
    const { imageUrl: rawImageUrl, ...restBody } = body
    const patch: Partial<Omit<typeof current, 'id' | 'createdAt'>> = { ...restBody }
    if (req.user!.role !== 'admin') {
      delete patch.narratorScope
    }
    if (rawImageUrl !== undefined) {
      if (rawImageUrl === null || rawImageUrl === '') {
        patch.imageUrl = undefined
      } else {
        const nextKind = { ...current, ...restBody }
        patch.imageUrl = await storeCatalogImage(
          catalogImageFolder(nextKind),
          current.id,
          rawImageUrl,
          catalogImageIsPrivate(nextKind) ? 'private' : 'public',
          current.imageUrl,
        )
      }
    }
    if (body.fileUrl !== undefined) {
      if ((body.kind ?? current.kind) === 'download') {
        patch.fileUrl = await storeCatalogDownloadFile(current.id, body.fileUrl, current.fileUrl)
      } else {
        patch.fileUrl = validateNonDownloadFileUrl(body.fileUrl)
      }
    }
    const updated = await updateEntity(req.params.id, patch)
    if (!updated) {
      res.status(404).json(errorPayload('NOT_FOUND', 'Registro não encontrado', { requestId: req.requestId }))
      return
    }
    if (patch.imageUrl !== undefined && current.imageUrl && current.imageUrl !== updated.imageUrl) {
      void deleteStoredMedia(current.imageUrl)
    }
    if (patch.fileUrl !== undefined && current.fileUrl && current.fileUrl !== updated.fileUrl) {
      void deleteStoredMedia(current.fileUrl)
    }
    res.json((await withReadableImages([updated]))[0])
  } catch (e) {
    next(e)
  }
})

adminChronicleRouter.post('/entities/:id/publish', async (req, res, next) => {
  try {
    await refreshEntitiesFromDatabase()
    const current = getEntity(req.params.id)
    if (!current) {
      res.status(404).json(errorPayload('NOT_FOUND', 'Registro não encontrado', { requestId: req.requestId }))
      return
    }
    if (!canEditEntity(current, req.user!)) {
      res.status(403).json(errorPayload('FORBIDDEN', 'Sem permissão para publicar este item.', { requestId: req.requestId }))
      return
    }
    const updated = await publishEntity(req.params.id)
    if (!updated) {
      res.status(404).json(errorPayload('NOT_FOUND', 'Registro não encontrado', { requestId: req.requestId }))
      return
    }
    res.json((await withReadableImages([updated]))[0])
  } catch (e) {
    next(e)
  }
})

adminChronicleRouter.delete('/entities/:id', async (req, res, next) => {
  try {
    await refreshEntitiesFromDatabase()
    const current = getEntity(req.params.id)
    if (!current) {
      res.status(404).json(errorPayload('NOT_FOUND', 'Registro não encontrado', { requestId: req.requestId }))
      return
    }
    if (!canEditEntity(current, req.user!)) {
      res.status(403).json(errorPayload('FORBIDDEN', 'Sem permissão para excluir este item.', { requestId: req.requestId }))
      return
    }
    await deleteEntity(req.params.id)
    void deleteStoredMedia(current.imageUrl)
    void deleteStoredMedia(current.fileUrl)
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

adminChronicleRouter.get('/handouts', (req, res) => {
  const rows = listHandouts(true).filter((h) => {
    if (req.user!.role === 'admin') return true
    if (!h.scheduledSessionId) return !h.narratorEmail || h.narratorEmail.toLowerCase() === req.user!.email.toLowerCase()
    return isSessionManager(h.scheduledSessionId, req.user!)
  })
  res.json(rows)
})

adminChronicleRouter.post('/handouts', async (req, res, next) => {
  try {
    const body = handoutSchema.parse(req.body)
    res.status(201).json(await createHandout({ ...body, narratorEmail: req.user!.email }))
  } catch (e) {
    next(e)
  }
})

adminChronicleRouter.patch('/handouts/:id', async (req, res, next) => {
  try {
    const existing = getHandout(req.params.id)
    if (!existing) {
      res.status(404).json(errorPayload('NOT_FOUND', 'Handout não encontrado', { requestId: req.requestId }))
      return
    }
    if (existing.scheduledSessionId) {
      requireSessionManager(existing.scheduledSessionId, req.user!)
    } else if (
      req.user!.role !== 'admin' &&
      existing.narratorEmail &&
      existing.narratorEmail.toLowerCase() !== req.user!.email.toLowerCase()
    ) {
      res.status(403).json(errorPayload('FORBIDDEN', 'Sem permissão neste handout.', { requestId: req.requestId }))
      return
    }
    const patch = handoutSchema
      .partial()
      .extend({
        status: z.enum(['pending_close', 'closed']).optional(),
        publishedToPlayers: z.boolean().optional(),
        restMode: z.boolean().optional(),
        narratorWhisper: z.string().max(4000).optional(),
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
    const updated = await updateHandout(req.params.id, patch)
    if (!updated) {
      res.status(404).json(errorPayload('NOT_FOUND', 'Handout não encontrado', { requestId: req.requestId }))
      return
    }
    res.json(updated)
  } catch (e) {
    next(e)
  }
})

adminChronicleRouter.get('/handouts/:id', (req, res, next) => {
  try {
    const row = getHandout(req.params.id)
    if (!row) {
      res.status(404).json(errorPayload('NOT_FOUND', 'Handout não encontrado', { requestId: req.requestId }))
      return
    }
    if (row.scheduledSessionId) {
      requireSessionManager(row.scheduledSessionId, req.user!)
    } else if (
      req.user!.role !== 'admin' &&
      row.narratorEmail &&
      row.narratorEmail.toLowerCase() !== req.user!.email.toLowerCase()
    ) {
      res.status(403).json(errorPayload('FORBIDDEN', 'Sem permissão neste handout.', { requestId: req.requestId }))
      return
    }
    res.json(row)
  } catch (e) {
    next(e)
  }
})

adminChronicleRouter.get('/scheduled-sessions', (req, res) => {
  res.json(listScheduledSessionsForManager(req.user!).map(toNarratorSessionDTO))
})

adminChronicleRouter.get('/live-mesas', (req, res) => {
  res.json(listLiveMesasForNarrator(req.user!))
})

adminChronicleRouter.post('/scheduled-sessions/:sessionId/join-co-narrator', async (req, res, next) => {
  try {
    const key = `co-narrator:${req.user!.email.toLowerCase()}`
    const rate = await checkSharedRateLimit(key, 15 * 60_000, 10)
    if (!rate.allowed) {
      res.setHeader('Retry-After', String(rate.retryAfterSec))
      res.status(429).json(
        errorPayload('RATE_LIMITED', 'Muitas tentativas seguidas. Espere alguns minutos.', {
          requestId: req.requestId,
        }),
      )
      return
    }
    const body = z.object({ accessCode: z.string().max(32).optional().default('') }).parse(req.body ?? {})
    const result = await joinSessionAsCoNarrator(req.params.sessionId, req.user!, body.accessCode)
    if (!result.ok) {
      const status =
        result.reason === 'bad_code' || result.reason === 'co_narrator_disabled'
          ? 403
          : result.reason === 'closed'
            ? 409
            : 404
      const message =
        result.reason === 'bad_code'
          ? 'Código da mesa inválido.'
          : result.reason === 'co_narrator_disabled'
            ? 'O narrador principal não liberou entrada de narrador secundário nesta mesa.'
            : result.reason === 'closed'
              ? 'Esta mesa já foi encerrada.'
              : 'Mesa não encontrada.'
      res.status(status).json(
        errorPayload(
          status === 403 ? 'FORBIDDEN' : status === 409 ? 'CONFLICT' : 'NOT_FOUND',
          message,
          { requestId: req.requestId },
        ),
      )
      return
    }
    await resetSharedRateLimit(key)
    res.json(toNarratorSessionDTO(result.session))
  } catch (e) {
    next(e)
  }
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
  allowCoNarrator: z.boolean().optional(),
})

const patchScheduledSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  chronicleName: z.string().min(1).max(120).optional(),
  tableMeta: sessionTableMetaSchema.optional(),
  listing: z.enum(['public', 'private']).optional(),
  allowCoNarrator: z.boolean().optional(),
})

adminChronicleRouter.post('/scheduled-sessions', async (req, res, next) => {
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
    const created = await createScheduledSession({
      title: body.title,
      scheduledAt: body.scheduledAt,
      chronicleName: body.chronicleName,
      tableMeta,
      narratorEmail: req.user!.email,
      listing: body.listing,
      allowCoNarrator: body.allowCoNarrator,
    })
    res.status(201).json(toNarratorSessionDTO(created))
  } catch (e) {
    next(e)
  }
})

adminChronicleRouter.patch('/scheduled-sessions/:sessionId', async (req, res, next) => {
  try {
    requireSessionManager(req.params.sessionId, req.user!)
    const body = patchScheduledSchema.parse(req.body)
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
    const nextRow = await updateScheduledSession(req.params.sessionId, {
      ...body,
      tableMeta,
    })
    res.json(nextRow ? toNarratorSessionDTO(nextRow) : null)
  } catch (e) {
    next(e)
  }
})

adminChronicleRouter.post('/scheduled-sessions/:sessionId/rotate-code', async (req, res, next) => {
  try {
    const updated = await rotateSessionAccessCode(req.params.sessionId, req.user!)
    if (!updated) {
      res.status(404).json(errorPayload('NOT_FOUND', 'Mesa não encontrada', { requestId: req.requestId }))
      return
    }
    res.json({ accessCode: updated.accessCode, session: toNarratorSessionDTO(updated) })
  } catch (e) {
    next(e)
  }
})

adminChronicleRouter.delete('/scheduled-sessions/:sessionId', async (req, res, next) => {
  try {
    const result = await deleteScheduledSession(req.params.sessionId, req.user!)
    if (!result.ok) {
      if (result.reason === 'open') {
        res.status(409).json(
          errorPayload('CONFLICT', 'Encerre a mesa ao vivo antes de excluí-la.', { requestId: req.requestId }),
        )
        return
      }
      res.status(result.reason === 'forbidden' ? 403 : 404).json(
        errorPayload(
          result.reason === 'forbidden' ? 'FORBIDDEN' : 'NOT_FOUND',
          result.reason === 'forbidden' ? 'Sem permissão nesta mesa' : 'Mesa não encontrada',
          { requestId: req.requestId },
        ),
      )
      return
    }
    await Promise.all([
      forgetSecretsForSession(req.params.sessionId),
      forgetRollsForSession(req.params.sessionId),
    ])
    res.status(204).end()
  } catch (e) {
    next(e)
  }
})

adminChronicleRouter.post('/scheduled-sessions/:sessionId/reschedule', async (req, res, next) => {
  try {
    const result = await rescheduleSameTable(req.params.sessionId, req.user!)
    if (!result.ok) {
      const message =
        result.reason === 'forbidden'
          ? 'Sem permissão nesta mesa'
          : result.reason === 'not_closed'
            ? 'Só uma mesa encerrada pode ser remarcada.'
            : 'Mesa não encontrada'
      const status = result.reason === 'forbidden' ? 403 : result.reason === 'not_closed' ? 409 : 404
      res.status(status).json(errorPayload('CONFLICT', message, { requestId: req.requestId }))
      return
    }
    res.status(201).json(toNarratorSessionDTO(result.session))
  } catch (e) {
    next(e)
  }
})

adminChronicleRouter.post('/scheduled-sessions/:sessionId/open', async (req, res, next) => {
  try {
    const result = await openScheduledSession(req.params.sessionId, req.user!)
    if (!result.ok) {
      const message =
        result.reason === 'forbidden'
          ? 'Sem permissão nesta mesa'
          : result.reason === 'closed'
            ? 'Mesa encerrada. Remarque uma nova sessão nesta mesa.'
            : 'Mesa não encontrada'
      const status = result.reason === 'forbidden' ? 403 : result.reason === 'closed' ? 409 : 404
      res.status(status).json(errorPayload('CONFLICT', message, { requestId: req.requestId }))
      return
    }
    res.json(toNarratorSessionDTO(result.session))
  } catch (e) {
    next(e)
  }
})

adminChronicleRouter.post('/scheduled-sessions/:sessionId/close', async (req, res, next) => {
  try {
    const result = await closeScheduledSession(req.params.sessionId, req.user!)
    if (!result.ok) {
      res.status(result.reason === 'forbidden' ? 403 : 404).json(
        errorPayload(
          result.reason === 'forbidden' ? 'FORBIDDEN' : 'NOT_FOUND',
          result.reason === 'forbidden' ? 'Sem permissão nesta mesa' : 'Mesa não encontrada',
          { requestId: req.requestId },
        ),
      )
      return
    }
    res.json(toNarratorSessionDTO(result.session))
  } catch (e) {
    next(e)
  }
})

adminChronicleRouter.get('/scheduled-sessions/:sessionId/handout', async (req, res, next) => {
  try {
    requireSessionManager(req.params.sessionId, req.user!)
    const row = await ensureHandoutForScheduledSession(req.params.sessionId)
    if (!row) {
      res.status(404).json(errorPayload('NOT_FOUND', 'Mesa não encontrada', { requestId: req.requestId }))
      return
    }
    res.json(row)
  } catch (e) {
    next(e)
  }
})

adminChronicleRouter.patch('/scheduled-sessions/:sessionId/handout/narrative', async (req, res, next) => {
  try {
    requireSessionManager(req.params.sessionId, req.user!)
    const { narrativeSummary } = z.object({ narrativeSummary: z.string().max(20_000) }).parse(req.body)
    const updated = await patchMesaHandoutNarrative(req.params.sessionId, narrativeSummary)
    if (!updated) {
      res.status(404).json(errorPayload('NOT_FOUND', 'Handout da mesa não encontrado', { requestId: req.requestId }))
      return
    }
    res.json(updated)
  } catch (e) {
    next(e)
  }
})

adminChronicleRouter.patch('/scheduled-sessions/:sessionId/handout/whisper', async (req, res, next) => {
  try {
    requireSessionManager(req.params.sessionId, req.user!)
    const { narratorWhisper } = z.object({ narratorWhisper: z.string().max(4000) }).parse(req.body)
    const updated = await patchMesaHandoutWhisper(req.params.sessionId, narratorWhisper)
    if (!updated) {
      res.status(404).json(errorPayload('NOT_FOUND', 'Handout da mesa não encontrado', { requestId: req.requestId }))
      return
    }
    res.json(updated)
  } catch (e) {
    next(e)
  }
})

adminChronicleRouter.get('/scheduled-sessions/:sessionId/actions', (req, res, next) => {
  try {
    requireSessionManager(req.params.sessionId, req.user!)
    const limit = z.coerce.number().int().min(1).max(200).optional().parse(req.query.limit)
    res.json(listSessionActions(req.params.sessionId, limit ?? 80))
  } catch (e) {
    next(e)
  }
})

adminChronicleRouter.post('/scheduled-sessions/:sessionId/scene-threats', async (req, res, next) => {
  try {
    requireSessionManager(req.params.sessionId, req.user!)
    const { entityId } = z.object({ entityId: z.string().min(1) }).parse(req.body)
    const result = await addSceneThreat(req.params.sessionId, entityId, req.user!)
    if (!result.ok) {
      if (result.reason === 'forbidden') {
        res.status(403).json(
          errorPayload('FORBIDDEN', 'Somente o mestre que abriu esta mesa pode adicionar ameaças.', {
            requestId: req.requestId,
          }),
        )
        return
      }
      if (result.reason === 'bad_entity') {
        res.status(400).json(
          errorPayload('VALIDATION_ERROR', 'Selecione um monstro válido do bestiário.', { requestId: req.requestId }),
        )
        return
      }
      res.status(404).json(errorPayload('NOT_FOUND', 'Mesa não encontrada', { requestId: req.requestId }))
      return
    }
    res.status(201).json(result.handout)
  } catch (e) {
    next(e)
  }
})

adminChronicleRouter.patch('/scheduled-sessions/:sessionId/scene-threats/:threatId', async (req, res, next) => {
  try {
    requireSessionManager(req.params.sessionId, req.user!)
    const body = z
      .object({
        hpDelta: z.number().int().optional(),
        manaDelta: z.number().int().optional(),
      })
      .parse(req.body)
    const result = await applySceneThreatDelta(req.params.sessionId, req.params.threatId, req.user!, body)
    if (!result.ok) {
      if (result.reason === 'forbidden') {
        res.status(403).json(
          errorPayload('FORBIDDEN', 'Somente o mestre que abriu esta mesa pode alterar ameaças.', {
            requestId: req.requestId,
          }),
        )
        return
      }
      res.status(404).json(errorPayload('NOT_FOUND', 'Ameaça ou mesa não encontrada', { requestId: req.requestId }))
      return
    }
    res.json(result.handout)
  } catch (e) {
    next(e)
  }
})

adminChronicleRouter.delete('/scheduled-sessions/:sessionId/scene-threats/:threatId', async (req, res, next) => {
  try {
    requireSessionManager(req.params.sessionId, req.user!)
    const result = await removeSceneThreat(req.params.sessionId, req.params.threatId, req.user!)
    if (!result.ok) {
      if (result.reason === 'forbidden') {
        res.status(403).json(
          errorPayload('FORBIDDEN', 'Somente o mestre que abriu esta mesa pode remover ameaças.', {
            requestId: req.requestId,
          }),
        )
        return
      }
      res.status(404).json(errorPayload('NOT_FOUND', 'Ameaça ou mesa não encontrada', { requestId: req.requestId }))
      return
    }
    res.json(result.handout)
  } catch (e) {
    next(e)
  }
})

adminChronicleRouter.post('/scheduled-sessions/:sessionId/scene-npcs', async (req, res, next) => {
  try {
    requireSessionManager(req.params.sessionId, req.user!)
    const { entityId } = z.object({ entityId: z.string().min(1) }).parse(req.body)
    const result = await addSceneNpc(req.params.sessionId, entityId, req.user!)
    if (!result.ok) {
      if (result.reason === 'forbidden') {
        res.status(403).json(
          errorPayload('FORBIDDEN', 'Somente o mestre que abriu esta mesa pode adicionar NPCs.', {
            requestId: req.requestId,
          }),
        )
        return
      }
      if (result.reason === 'bad_entity') {
        res.status(400).json(
          errorPayload('VALIDATION_ERROR', 'Selecione um NPC válido do acervo.', { requestId: req.requestId }),
        )
        return
      }
      res.status(404).json(errorPayload('NOT_FOUND', 'Mesa não encontrada', { requestId: req.requestId }))
      return
    }
    res.status(201).json(result.handout)
  } catch (e) {
    next(e)
  }
})

adminChronicleRouter.delete('/scheduled-sessions/:sessionId/scene-npcs/:npcId', async (req, res, next) => {
  try {
    requireSessionManager(req.params.sessionId, req.user!)
    const result = await removeSceneNpc(req.params.sessionId, req.params.npcId, req.user!)
    if (!result.ok) {
      if (result.reason === 'forbidden') {
        res.status(403).json(
          errorPayload('FORBIDDEN', 'Somente o mestre que abriu esta mesa pode remover NPCs.', {
            requestId: req.requestId,
          }),
        )
        return
      }
      res.status(404).json(errorPayload('NOT_FOUND', 'NPC ou mesa não encontrada', { requestId: req.requestId }))
      return
    }
    res.json(result.handout)
  } catch (e) {
    next(e)
  }
})

adminChronicleRouter.patch('/scheduled-sessions/:sessionId/handout/ambience', async (req, res, next) => {
  try {
    requireSessionManager(req.params.sessionId, req.user!)
    const body = z
      .object({
        environment: z.string().max(120).optional(),
        climate: z.string().max(120).optional(),
        moon: z.string().max(120).optional(),
        atmosphere: z.string().max(120).optional(),
      })
      .parse(req.body)
    const result = await patchMesaAmbience(req.params.sessionId, body, req.user!)
    if (!result.ok) {
      if (result.reason === 'forbidden') {
        res.status(403).json(
          errorPayload('FORBIDDEN', 'Somente o mestre que abriu esta mesa pode alterar a governança.', {
            requestId: req.requestId,
          }),
        )
        return
      }
      res.status(404).json(errorPayload('NOT_FOUND', 'Mesa não encontrada', { requestId: req.requestId }))
      return
    }
    res.json(result.handout)
  } catch (e) {
    next(e)
  }
})

adminChronicleRouter.patch('/scheduled-sessions/:sessionId/handout/rest-mode', async (req, res, next) => {
  try {
    requireSessionManager(req.params.sessionId, req.user!)
    const { restMode } = z.object({ restMode: z.boolean() }).parse(req.body)
    const result = await setMesaRestMode(req.params.sessionId, restMode, req.user!)
    if (!result.ok) {
      if (result.reason === 'forbidden') {
        res.status(403).json(
          errorPayload('FORBIDDEN', 'Somente o mestre que abriu esta mesa pode alterar o descanso.', {
            requestId: req.requestId,
          }),
        )
        return
      }
      res.status(404).json(errorPayload('NOT_FOUND', 'Mesa não encontrada', { requestId: req.requestId }))
      return
    }
    res.json(result.handout)
  } catch (e) {
    next(e)
  }
})

/** Concede XP real ao personagem do assento na mesa (+ registro no handout) de forma idempotente. */
adminChronicleRouter.post('/award-xp', async (req, res, next) => {
  try {
    const body = z
      .object({
        sessionId: z.string().min(1),
        participantDisplayName: z.string().min(1),
        amount: z.number().int().min(1).max(250),
        operationId: z.string().trim().min(4).max(160).optional(),
      })
      .parse(req.body)

    const session = requireSessionManager(body.sessionId, req.user!)
    if (session.status === 'closed') {
      res.status(409).json(
        errorPayload('CONFLICT', 'Não é possível conceder XP em mesa encerrada.', { requestId: req.requestId }),
      )
      return
    }

    const seat =
      (session.seats ?? []).find(
        (s) =>
          !s.leftAt &&
          s.displayName.trim().toLowerCase() === body.participantDisplayName.trim().toLowerCase(),
      ) ?? null

    if (!seat) {
      res.status(404).json(
        errorPayload('NOT_FOUND', 'Participante sem assento na mesa. O jogador precisa entrar com personagem.', {
          requestId: req.requestId,
        }),
      )
      return
    }

    const op = await runIdempotent({
      actorEmail: req.user!.email,
      operationId: body.operationId,
      kind: 'award-xp',
      requestPayload: {
        sessionId: body.sessionId,
        participantDisplayName: body.participantDisplayName.trim().toLowerCase(),
        amount: body.amount,
      },
      execute: async () => {
        const updated = await applyCharacterXp(seat.email, seat.characterId, body.amount, {
          actorEmail: req.user!.email,
          sessionId: body.sessionId,
        })
        if (!updated) {
          return {
            status: 404,
            body: errorPayload('NOT_FOUND', 'Personagem do participante não encontrado', {
              requestId: req.requestId,
            }),
          }
        }

        const handout = await ensureHandoutForScheduledSession(body.sessionId)
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
          await updateHandout(handout.id, { participants: nextParticipants })
        }

        return { status: 200, body: updated as unknown as Record<string, unknown> }
      },
    })

    res.status(op.status).json(op.body)
  } catch (e) {
    next(e)
  }
})

adminChronicleRouter.get('/character-reviews', (req, res) => {
  const rows = listProfiles()
    .filter((profile) => canInspectPlayer(req.user!, profile.email))
    .flatMap((profile) =>
      profile.characters
        .filter((character) => character.approval || character.needsRuleReview)
        .map((character) => ({
          email: profile.email,
          playerId: publicPlayerId(profile.email),
          displayName: profile.displayName,
          characterId: character.id,
          name: character.name,
          level: character.level,
          clan: character.clan ?? null,
          subclass: character.subclass ?? null,
          secondarySubclass: character.secondarySubclass ?? null,
          needsRuleReview: Boolean(character.needsRuleReview),
          ruleReviewNote: character.ruleReviewNote ?? null,
          sheetRevision: character.sheetRevision ?? 1,
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

adminChronicleRouter.post('/characters/:email/:characterId/review', async (req, res, next) => {
  try {
    const targetEmail = decodeURIComponent(req.params.email)
    if (!canInspectPlayer(req.user!, targetEmail)) {
      res.status(403).json(
        errorPayload('FORBIDDEN', 'Você só pode revisar personagens de jogadores da sua mesa ou corte.', {
          requestId: req.requestId,
        }),
      )
      return
    }
    const body = z
      .object({ status: z.enum(['approved', 'changes']), note: z.string().max(500).optional() })
      .parse(req.body)
    const updated = await reviewCharacter(
      targetEmail,
      req.params.characterId,
      body.status,
      body.note ?? '',
      req.user!.email,
    )
    if (!updated) {
      res.status(404).json(errorPayload('NOT_FOUND', 'Personagem não encontrado', { requestId: req.requestId }))
      return
    }
    res.json(updated)
  } catch (e) {
    next(e)
  }
})

adminChronicleRouter.get('/characters/:email/:characterId/revisions', (req, res) => {
  const targetEmail = decodeURIComponent(req.params.email)
  if (!canInspectPlayer(req.user!, targetEmail)) {
    res.status(403).json(
      errorPayload('FORBIDDEN', 'Sem permissão para consultar revisões deste personagem.', {
        requestId: req.requestId,
      }),
    )
    return
  }
  res.json(listCharacterRevisions(targetEmail, req.params.characterId))
})

adminChronicleRouter.post('/characters/:email/:characterId/restore-revision', requireAdmin, async (req, res, next) => {
  try {
    const body = z
      .object({
        revisionId: z.string().min(1),
        dryRun: z.boolean().optional(),
        confirm: z.literal('restaurar-revisao').optional(),
      })
      .parse(req.body)
    const out = await restoreCharacterRevision({
      email: decodeURIComponent(String(req.params.email)),
      characterId: String(req.params.characterId),
      revisionId: body.revisionId,
      actorEmail: req.user!.email,
      dryRun: body.dryRun ?? body.confirm !== 'restaurar-revisao',
      confirm: body.confirm,
    })
    res.json(out)
  } catch (e) {
    next(e)
  }
})

adminChronicleRouter.get('/backup', requireAdmin, (req, res) => {
  res.json(campaignSnapshot(req.user!))
})

adminChronicleRouter.get('/backup/metadata', requireAdmin, (_req, res) => {
  res.json(listBackupMetadata())
})

adminChronicleRouter.post('/backup/drill', requireAdmin, (req, res, next) => {
  try {
    res.json(drillBackup(req.body ?? {}))
  } catch (e) {
    next(e)
  }
})

adminChronicleRouter.post('/backup/validate-storage', requireAdmin, (req, res, next) => {
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

adminChronicleRouter.post('/backup/restore', requireAdmin, async (req, res, next) => {
  try {
    const body = z
      .object({
        confirm: z.literal('restaurar-copia'),
        backup: z.record(z.string(), z.unknown()),
      })
      .parse(req.body)
    res.json(await restoreBackup(body.backup as Parameters<typeof restoreBackup>[0], req.user!.email))
  } catch (e) {
    next(e)
  }
})

adminChronicleRouter.get('/board', (_req, res) => {
  res.json(listBoard())
})

adminChronicleRouter.post('/board', async (req, res, next) => {
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
      await addBoardCard({
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

adminChronicleRouter.delete('/board/:id', async (req, res, next) => {
  try {
    if (!(await removeBoardCard(req.params.id))) {
      res.status(404).json(errorPayload('NOT_FOUND', 'Cartão não encontrado', { requestId: req.requestId }))
      return
    }
    res.json({ ok: true })
  } catch (e) {
    next(e)
  }
})

adminChronicleRouter.get('/rules', (req, res) => {
  res.json(campaignSnapshot(req.user!).rules)
})

adminChronicleRouter.post('/rules', requireAdmin, async (req, res, next) => {
  try {
    const body = z
      .object({
        maxLevel: z.number().int().min(1).max(MAX_CHARACTER_LEVEL),
        subclassLevel: z.number().int().min(1).max(MAX_CHARACTER_LEVEL),
        secondarySubclassLevel: z.number().int().min(1).max(MAX_CHARACTER_LEVEL).optional(),
        startingXp: z.number().int().min(0).max(10_000).optional(),
        shopBudgetCopper: z.number().int().min(0).max(1_000_000).optional(),
        decision: z.enum(['keep-existing', 'mark-review']),
      })
      .parse(req.body)
    res.json(
      await proposeRules(
        {
          maxLevel: body.maxLevel,
          subclassLevel: body.subclassLevel,
          secondarySubclassLevel: body.secondarySubclassLevel,
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

adminChronicleRouter.get('/secrets', (req, res, next) => {
  try {
    const sessionId = typeof req.query.sessionId === 'string' ? req.query.sessionId : undefined
    if (sessionId) {
      requireSessionManager(sessionId, req.user!)
      res.json(listSecrets(sessionId))
      return
    }
    if (req.user!.role === 'admin') {
      res.json(listSecrets())
      return
    }
    const managedIds = new Set(listScheduledSessionsForManager(req.user!).map((s) => s.id))
    res.json(listSecrets().filter((s) => managedIds.has(s.sessionId)))
  } catch (e) {
    next(e)
  }
})

adminChronicleRouter.post('/secrets', async (req, res, next) => {
  try {
    const body = z
      .object({
        sessionId: z.string().min(1),
        entityId: z.string().min(1),
        audienceEmail: z.string().email().nullable().optional(),
        text: z.string().min(1).max(2000),
      })
      .parse(req.body)
    requireSessionManager(body.sessionId, req.user!)
    res.status(201).json(
      await addSecret({
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

adminChronicleRouter.delete('/secrets/:id', async (req, res, next) => {
  try {
    const existing = listSecrets().find((s) => s.id === req.params.id)
    if (!existing) {
      res.status(404).json(errorPayload('NOT_FOUND', 'Segredo não encontrado', { requestId: req.requestId }))
      return
    }
    requireSessionManager(existing.sessionId, req.user!)
    await removeSecret(req.params.id)
    res.json({ ok: true })
  } catch (e) {
    next(e)
  }
})

adminChronicleRouter.post('/sessions/:sessionId/advance-turn', async (req, res, next) => {
  try {
    requireSessionManager(req.params.sessionId, req.user!)
    const targets = openSeats(req.params.sessionId).map((seat) => ({
      email: seat.email,
      characterId: seat.characterId,
    }))
    res.json({ changed: await advanceTurnEffects(targets) })
  } catch (e) {
    next(e)
  }
})

adminChronicleRouter.get('/analytics/session-line', (req, res) => {
  res.json(sessionActivityLineSeries(req.user!))
})

adminChronicleRouter.get('/analytics/mesa-activity', (req, res) => {
  res.json(adminMesaActivityStats(req.user!))
})

adminChronicleRouter.get('/analytics/player-characters', (_req, res) => {
  res.json(adminPlayerCharactersByUser())
})

adminChronicleRouter.get('/sessions/:sessionId/operations', (req, res, next) => {
  try {
    requireSessionManager(req.params.sessionId, req.user!)
    const query = z
      .object({
        limit: z.coerce.number().int().min(1).max(200).optional(),
        offset: z.coerce.number().int().min(0).max(10_000).optional(),
      })
      .parse(req.query)
    res.json(listOperationsForSession(req.params.sessionId, query))
  } catch (e) {
    next(e)
  }
})

adminChronicleRouter.get('/registered-players', (req, res) => {
  const rows = listRegisteredPlayers()
    .filter((p) => canInspectPlayer(req.user!, p.email))
    .map((p) => ({
      id: p.id,
      publicId: p.id,
      displayName: p.displayName,
      handle: p.handle,
      memberSince: p.memberSince,
      characters: p.characters,
      ...(req.user!.role === 'admin' ? { email: p.email } : {}),
    }))
  res.json(rows)
})
