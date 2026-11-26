import { Router } from 'express'
import { z } from 'zod'
import { requireUser } from '../middlewares/optionalUser.js'
import { readSavedFilters, writeSavedFilters } from '../services/campaignExtras.js'
import {
  confirmSessionPresence,
  getScheduledSession,
  joinSessionWithCode,
  leaveSessionSeat,
  listPublishedSessionsForPlayers,
  replaceSessionCharacter,
  syncSessionsIfStale,
  toParticipantSessionDTO,
} from '../services/chronicleStore.js'
import { errorPayload } from '../services/errors.js'
import { deleteStoredMedia, storeProfileImage } from '../services/mediaStorage.js'
import { listOperationsFor } from '../services/operationLog.js'
import {
  STARTING_CHARACTER_XP,
  ensureProfile,
  getCharacter,
  getCharacterBalanceStats,
  getProfile,
  patchCharacter,
  publicPlayerId,
  refreshEffects,
  submitCharacter,
  syncProfilesIfStale,
  updateProfileAccount,
  updateProfileMedia,
  updateProfilePreferences,
  upsertCharacter,
  xpRequiredToAdvance,
} from '../services/profileStore.js'
import { checkSharedRateLimit, resetSharedRateLimit } from '../services/rateLimitStore.js'
import { readRules } from '../services/rulesState.js'
import { classFromHouse, listSubclassesForClass } from '../services/subclassCatalog.js'

export const meRouter = Router()

meRouter.use(requireUser)

meRouter.get('/profile', async (req, res, next) => {
  try {
    const email = req.user!.email
    const profile = await ensureProfile(email, req.user!.displayName, req.user!.role)
    await refreshEffects(email)
    res.json({
      ...profile,
      publicId: publicPlayerId(profile.email),
    })
  } catch (e) {
    next(e)
  }
})

const mediaSchema = z.object({
  avatarUrl: z.string().url().or(z.string().startsWith('data:image/')).nullable().optional(),
  bannerUrl: z.string().url().or(z.string().startsWith('data:image/')).nullable().optional(),
})

meRouter.patch('/profile', async (req, res, next) => {
  try {
    const body = mediaSchema.parse(req.body)
    const email = req.user!.email
    const previous = getProfile(email)
    const avatarUrl = await storeProfileImage('avatar', body.avatarUrl)
    const bannerUrl = await storeProfileImage('banner', body.bannerUrl)
    const updated = await updateProfileMedia(email, { ...body, avatarUrl, bannerUrl })
    if (!updated) {
      res.status(404).json(errorPayload('NOT_FOUND', 'Perfil não encontrado', { requestId: req.requestId }))
      return
    }
    if (body.avatarUrl !== undefined && previous?.avatarUrl && previous.avatarUrl !== updated.avatarUrl) {
      void deleteStoredMedia(previous.avatarUrl)
    }
    if (body.bannerUrl !== undefined && previous?.bannerUrl && previous.bannerUrl !== updated.bannerUrl) {
      void deleteStoredMedia(previous.bannerUrl)
    }
    res.json({ ...updated, publicId: publicPlayerId(updated.email) })
  } catch (e) {
    next(e)
  }
})

const prefsSchema = z.object({
  fiefOrigin: z.string().max(200).nullable().optional(),
  narrativePreference: z.string().max(200).nullable().optional(),
  bio: z.string().max(500).nullable().optional(),
  visibility: z.enum(['private', 'court', 'open']).optional(),
  notifySessions: z.boolean().optional(),
  notifyChronicle: z.boolean().optional(),
  courtTitle: z.string().max(120).nullable().optional(),
  chronicleSlogan: z.string().max(200).nullable().optional(),
  archiveFocus: z.string().max(200).nullable().optional(),
  defaultRpgTitle: z.string().max(200).nullable().optional(),
})

const accountSchema = z
  .object({
    displayName: z.string().trim().min(2).max(80).optional(),
    handle: z.string().trim().min(3).max(32).optional(),
  })
  .refine((v) => v.displayName !== undefined || v.handle !== undefined, {
    message: 'Informe o nome de exibição ou o @usuário.',
  })

meRouter.patch('/profile/preferences', async (req, res, next) => {
  try {
    const body = prefsSchema.parse(req.body)
    const updated = await updateProfilePreferences(req.user!.email, body)
    if (!updated) {
      res.status(404).json(errorPayload('NOT_FOUND', 'Perfil não encontrado', { requestId: req.requestId }))
      return
    }
    res.json({ ...updated, publicId: publicPlayerId(updated.email) })
  } catch (e) {
    next(e)
  }
})

meRouter.patch('/profile/account', async (req, res, next) => {
  try {
    const body = accountSchema.parse(req.body)
    const updated = await updateProfileAccount(req.user!.email, body)
    if (!updated) {
      res.status(404).json(errorPayload('NOT_FOUND', 'Perfil não encontrado', { requestId: req.requestId }))
      return
    }
    res.json({ ...updated, publicId: publicPlayerId(updated.email) })
  } catch (e) {
    next(e)
  }
})

const poolSchema = z.object({ current: z.number(), max: z.number() })

const createCharacterSchema = z.object({
  name: z.string().min(1).max(120),
  species: z.string().min(1).max(120),
  clan: z.string().max(120).optional(),
  level: z.number().int().min(0).max(20).optional(),
  isPrimary: z.boolean().optional(),
  hp: poolSchema,
  blood: poolSchema.optional(),
  mana: poolSchema.optional(),
  will: poolSchema.optional(),
  vitals: z
    .object({
      hpDie: z.string().max(10).optional(),
      manaDie: z.string().max(10).optional(),
      caDie: z.string().max(10).optional(),
      caValue: z.number().int().min(1).max(20).optional(),
      locked: z.boolean().optional(),
    })
    .optional(),
  balanceStats: z.record(z.string(), z.number()).optional(),
  characterClass: z.string().min(1).max(80).nullable().optional(),
})

meRouter.post('/characters', async (req, res, next) => {
  try {
    const body = createCharacterSchema.parse(req.body)
    const startLevel = body.level === 0 ? 0 : 1
    const created = await upsertCharacter(req.user!.email, {
      name: body.name,
      species: body.species,
      clan: body.clan,
      level: startLevel,
      isPrimary: body.isPrimary ?? true,
      hp: body.hp,
      blood: body.blood,
      mana: body.mana,
      will: body.will,
      xp: { current: STARTING_CHARACTER_XP, toNext: xpRequiredToAdvance(startLevel) },
      subclass: null,
      secondarySubclass: null,
      characterClass: body.characterClass ?? null,
      balanceStats: body.balanceStats ?? null,
      vitals: {
        hpDie: body.vitals?.hpDie ?? null,
        manaDie: body.vitals?.manaDie ?? null,
        caDie: body.vitals?.caDie ?? null,
        caValue: body.vitals?.caValue ?? null,
        locked: body.vitals?.locked ?? true,
      },
    })
    res.status(201).json(created)
  } catch (e) {
    next(e)
  }
})

meRouter.get('/characters/:characterId/balance-stats', (req, res) => {
  const result = getCharacterBalanceStats(req.user!.email, req.params.characterId)
  if (!result.found) {
    res.status(404).json(errorPayload('NOT_FOUND', 'Personagem não encontrado', { requestId: req.requestId }))
    return
  }
  res.json(result)
})

const patchCharacterSchema = z.object({
  name: z.string().min(1).max(120).optional(),
  clan: z.string().max(120).optional(),
  faith: z.string().max(120).nullable().optional(),
  portraitUrl: z.string().url().or(z.string().startsWith('data:image/')).nullable().optional(),
  isPrimary: z.boolean().optional(),
  showOnHome: z.boolean().optional(),
  hp: poolSchema.optional(),
  blood: poolSchema.optional(),
  mana: poolSchema.optional(),
  will: poolSchema.optional(),
  subclass: z.string().min(1).max(120).nullable().optional(),
  secondarySubclass: z.string().min(1).max(120).nullable().optional(),
  characterClass: z.string().min(1).max(80).nullable().optional(),
  identityPatch: z
    .object({
      house: z.string().max(120).nullable().optional(),
      nature: z.string().max(120).nullable().optional(),
      demeanor: z.string().max(120).nullable().optional(),
      concept: z.string().max(120).nullable().optional(),
      residence: z.string().max(120).nullable().optional(),
    })
    .optional(),
  inventory: z
    .array(
      z.object({
        id: z.string(),
        name: z.string(),
        description: z.string().optional(),
        category: z.enum(['weapon', 'armor', 'elixir', 'ritual', 'material', 'trinket', 'other']),
        rarity: z.enum(['comum', 'incomum', 'raro', 'ancestral', 'proibido']),
        weightKg: z.number(),
        equipped: z.boolean().optional(),
        slot: z.enum(['head', 'torso', 'hands', 'feet', 'rings', 'accessory']).nullable().optional(),
        status: z.enum(['ok', 'broken', 'cooldown', 'drop']).optional(),
        statsLabel: z.string().optional(),
        durability: z.object({ current: z.number(), max: z.number() }).optional(),
        charges: z.number().int().min(0).max(999).optional(),
      }),
    )
    .optional(),
  expectedRevision: z.number().int().min(0).optional(),
  createdSkills: z
    .array(
      z.object({
        id: z.string(),
        name: z.string().min(1).max(120),
        die: z.string().min(1).max(40),
        attribute: z.string().min(1).max(80),
        attributeMod: z.number().int().min(-10).max(10),
        howItWorks: z.string().max(2000),
        manaCost: z.number().int().min(0).max(100).optional(),
      }),
    )
    .optional(),
  balanceStats: z.record(z.string(), z.number()).nullable().optional(),
})

meRouter.patch('/characters/:characterId', async (req, res, next) => {
  try {
    const body = patchCharacterSchema.parse(req.body)
    const current = getCharacter(req.user!.email, req.params.characterId)
    if (!current) {
      res.status(404).json(errorPayload('NOT_FOUND', 'Personagem não encontrado', { requestId: req.requestId }))
      return
    }
    const rules = readRules()
    const resolvedClass = body.characterClass ?? current.characterClass ?? classFromHouse(current.identity?.house)

    if (body.subclass) {
      if (current.level < rules.subclassLevel) {
        res.status(403).json(
          errorPayload(
            'FORBIDDEN',
            `A subclasse I só pode ser escolhida a partir do nível ${rules.subclassLevel}.`,
            { requestId: req.requestId },
          ),
        )
        return
      }
      if (!resolvedClass) {
        res.status(400).json(
          errorPayload('VALIDATION_ERROR', 'Este personagem não tem classe para filtrar as subclasses.', {
            requestId: req.requestId,
          }),
        )
        return
      }
      const options = await listSubclassesForClass(resolvedClass)
      if (!options.includes(body.subclass)) {
        res.status(400).json(
          errorPayload('VALIDATION_ERROR', `Subclasse indisponível para a classe ${resolvedClass}.`, {
            requestId: req.requestId,
          }),
        )
        return
      }
    }

    if (body.secondarySubclass) {
      if (current.level < rules.secondarySubclassLevel) {
        res.status(403).json(
          errorPayload(
            'FORBIDDEN',
            `A subclasse II só pode ser escolhida a partir do nível ${rules.secondarySubclassLevel}.`,
            { requestId: req.requestId },
          ),
        )
        return
      }
      if (!resolvedClass) {
        res.status(400).json(
          errorPayload('VALIDATION_ERROR', 'Este personagem não tem classe para filtrar as subclasses.', {
            requestId: req.requestId,
          }),
        )
        return
      }
      const options = await listSubclassesForClass(resolvedClass)
      if (!options.includes(body.secondarySubclass)) {
        res.status(400).json(
          errorPayload('VALIDATION_ERROR', `Subclasse II indisponível para a classe ${resolvedClass}.`, {
            requestId: req.requestId,
          }),
        )
        return
      }
      const primary = body.subclass !== undefined ? body.subclass : current.subclass
      if (primary && primary === body.secondarySubclass) {
        res.status(400).json(
          errorPayload('VALIDATION_ERROR', 'A subclasse II deve ser diferente da subclasse I.', {
            requestId: req.requestId,
          }),
        )
        return
      }
    }

    const updated = await patchCharacter(req.user!.email, req.params.characterId, body)
    if (!updated) {
      res.status(body.showOnHome ? 409 : 404).json(
        errorPayload(
          body.showOnHome ? 'CONFLICT' : 'NOT_FOUND',
          body.showOnHome ? 'Já há 3 personagens destacados no Início' : 'Personagem não encontrado',
          { requestId: req.requestId },
        ),
      )
      return
    }
    res.json(updated)
  } catch (e) {
    next(e)
  }
})

/** Jogador não concede XP a si mesmo — somente o narrador na mesa. */
meRouter.post('/characters/:characterId/submit', async (req, res, next) => {
  try {
    const updated = await submitCharacter(req.user!.email, req.params.characterId)
    if (!updated) {
      res.status(404).json(errorPayload('NOT_FOUND', 'Personagem não encontrado', { requestId: req.requestId }))
      return
    }
    res.json(updated)
  } catch (e) {
    next(e)
  }
})

meRouter.get('/operations', (req, res) => {
  res.json(listOperationsFor(req.user!.email, req.user!))
})

meRouter.get('/filters', (req, res) => {
  res.json(readSavedFilters(req.user!.email))
})

meRouter.put('/filters', async (req, res, next) => {
  try {
    const body = z
      .object({
        shopCategory: z.enum(['gear', 'consumables', 'services']).optional(),
        shopQuery: z.string().max(80).optional(),
        archiveQuery: z.string().max(80).optional(),
        archiveRarity: z.string().max(40).optional(),
      })
      .parse(req.body)
    res.json(await writeSavedFilters(req.user!.email, body))
  } catch (e) {
    next(e)
  }
})

meRouter.post('/characters/:characterId/xp', (_req, res) => {
  res.status(403).json(
    errorPayload('FORBIDDEN', 'Somente o narrador concede XP na mesa da sessão.'),
  )
})

meRouter.get('/dashboard', async (req, res, next) => {
  try {
    await Promise.all([syncProfilesIfStale(), syncSessionsIfStale()])
    const profile = await ensureProfile(req.user!.email, req.user!.displayName, req.user!.role)
    const scheduled = listPublishedSessionsForPlayers(req.user!.email)
    const now = Date.now()
    const upcoming = scheduled.filter((s) => s.status !== 'closed' && new Date(s.scheduledAt).getTime() >= now)
    const nextSession =
      upcoming.find((s) => s.status === 'open') ??
      upcoming[0] ??
      scheduled.filter((s) => s.status !== 'closed').sort((a, b) => a.scheduledAt.localeCompare(b.scheduledAt))[0] ??
      null
    const activeChronicle = nextSession?.chronicleName ?? nextSession?.title ?? null
    const homeCharacters =
      profile.characters.length > 10
        ? profile.characters.filter((c) => c.showOnHome).slice(0, 3)
        : profile.characters
    const displayChars = homeCharacters.length > 0 ? homeCharacters : profile.characters.slice(0, 3)
    res.json({
      activeChronicle: activeChronicle
        ? {
          name: activeChronicle,
          act: nextSession
            ? `Próximo encontro · ${new Date(nextSession.scheduledAt).toLocaleDateString('pt-BR')}`
            : '',
        }
        : null,
      nextSession: nextSession
        ? {
          id: nextSession.id,
          title: nextSession.chronicleName ?? nextSession.title,
          scheduledAt: nextSession.scheduledAt,
          status: nextSession.status,
        }
        : null,
      characters: displayChars.map((c) => ({
        id: c.id,
        name: c.name,
        species: c.species,
        clan: c.clan,
        level: c.level,
        subclass: c.subclass ?? null,
        secondarySubclass: c.secondarySubclass ?? null,
        needsRuleReview: Boolean(c.needsRuleReview),
        selected: c.isPrimary,
        showOnHome: c.showOnHome,
        hp: c.hp,
        blood: c.blood,
        will: c.will ?? { current: 0, max: 0 },
        xp: { current: c.xp?.current ?? 0, max: c.xp?.toNext ?? 0 },
      })),
    })
  } catch (e) {
    next(e)
  }
})

meRouter.post('/sessions/:sessionId/presence', async (req, res, next) => {
  try {
    const result = await confirmSessionPresence(req.params.sessionId, {
      email: req.user!.email,
      displayName: req.user!.displayName,
    })
    if (!result.ok) {
      const status = result.reason === 'closed' ? 409 : result.reason === 'forbidden' ? 403 : 404
      const message =
        result.reason === 'closed'
          ? 'A mesa já foi encerrada.'
          : result.reason === 'forbidden'
            ? 'Sem permissão para confirmar nesta mesa.'
            : 'Sessão não encontrada'
      res.status(status).json(
        errorPayload(status === 409 ? 'CONFLICT' : status === 403 ? 'FORBIDDEN' : 'NOT_FOUND', message, {
          requestId: req.requestId,
        }),
      )
      return
    }
    res.json(toParticipantSessionDTO(result.session, req.user!.email))
  } catch (e) {
    next(e)
  }
})

meRouter.post('/sessions/:sessionId/join', async (req, res, next) => {
  try {
    const key = `session-join:${req.user!.email.toLowerCase()}`
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

    const body = z
      .object({
        accessCode: z.string().max(32).optional().default(''),
        characterId: z.string().min(1),
      })
      .parse(req.body)
    const profile = await ensureProfile(req.user!.email, req.user!.displayName, req.user!.role)
    const character = profile.characters.find((c) => c.id === body.characterId)
    if (!character) {
      res.status(404).json(errorPayload('NOT_FOUND', 'Personagem não encontrado', { requestId: req.requestId }))
      return
    }
    const result = await joinSessionWithCode(
      req.params.sessionId,
      body.accessCode,
      { email: req.user!.email, displayName: req.user!.displayName },
      { id: character.id, name: character.name },
    )
    if (!result.ok) {
      const message =
        result.reason === 'bad_code'
          ? 'Código da mesa inválido'
          : result.reason === 'not_open'
            ? 'A mesa ainda não foi aberta ou já foi encerrada pelo narrador'
            : 'Sessão não encontrada'
      const status = result.reason === 'bad_code' ? 403 : result.reason === 'not_open' ? 409 : 404
      res.status(status).json(errorPayload(status === 403 ? 'FORBIDDEN' : status === 409 ? 'CONFLICT' : 'NOT_FOUND', message, { requestId: req.requestId }))
      return
    }
    await resetSharedRateLimit(key)
    res.json(toParticipantSessionDTO(result.session, req.user!.email))
  } catch (e) {
    next(e)
  }
})

meRouter.post('/sessions/:sessionId/leave', async (req, res, next) => {
  try {
    const result = await leaveSessionSeat(req.params.sessionId, req.user!)
    if (!result.ok) {
      const status = result.reason === 'forbidden' ? 403 : 404
      res.status(status).json(
        errorPayload(
          status === 403 ? 'FORBIDDEN' : 'NOT_FOUND',
          status === 403 ? 'Sem permissão nesta mesa.' : 'Sessão não encontrada',
          { requestId: req.requestId },
        ),
      )
      return
    }
    res.json(toParticipantSessionDTO(result.session, req.user!.email))
  } catch (e) {
    next(e)
  }
})

meRouter.post('/sessions/:sessionId/replace-character', async (req, res, next) => {
  try {
    const body = z.object({ characterId: z.string().min(1) }).parse(req.body)
    const profile = await ensureProfile(req.user!.email, req.user!.displayName, req.user!.role)
    const character = profile.characters.find((c) => c.id === body.characterId)
    if (!character) {
      res.status(404).json(errorPayload('NOT_FOUND', 'Personagem não encontrado', { requestId: req.requestId }))
      return
    }
    const session = getScheduledSession(req.params.sessionId)
    if (!session) {
      res.status(404).json(errorPayload('NOT_FOUND', 'Sessão não encontrada', { requestId: req.requestId }))
      return
    }
    const seated = session.seats.some((s) => s.email === req.user!.email && !s.leftAt)
    if (!seated) {
      res.status(403).json(
        errorPayload('FORBIDDEN', 'Entre na mesa com o código antes de trocar o personagem', {
          requestId: req.requestId,
        }),
      )
      return
    }
    const updated = await replaceSessionCharacter(req.params.sessionId, req.user!.email, {
      id: character.id,
      name: character.name,
    })
    res.json(updated ? toParticipantSessionDTO(updated, req.user!.email) : null)
  } catch (e) {
    next(e)
  }
})
