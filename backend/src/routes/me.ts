import { Router } from 'express'
import { z } from 'zod'
import { requireUser } from '../middlewares/optionalUser.js'
import {
  listScheduledSessions,
  confirmSessionPresence,
  joinSessionWithCode,
  leaveSessionSeat,
  replaceSessionCharacter,
  getScheduledSession,
} from '../services/chronicleStore.js'
import {
  ensureProfile,
  getCharacterBalanceStats,
  updateProfileMedia,
  updateProfilePreferences,
  updateProfileDisplayName,
  upsertCharacter,
  patchCharacter,
  STARTING_CHARACTER_XP,
  xpRequiredToAdvance,
} from '../services/profileStore.js'

export const meRouter = Router()

meRouter.use(requireUser)

meRouter.get('/profile', (req, res) => {
  const email = req.user!.email
  const profile = ensureProfile(email, req.user!.displayName, req.user!.role)
  res.json(profile)
})

const mediaSchema = z.object({
  avatarUrl: z.string().url().or(z.string().startsWith('data:image/')).nullable().optional(),
  bannerUrl: z.string().url().or(z.string().startsWith('data:image/')).nullable().optional(),
})

meRouter.patch('/profile', (req, res, next) => {
  try {
    const body = mediaSchema.parse(req.body)
    const updated = updateProfileMedia(req.user!.email, body)
    if (!updated) {
      res.status(404).json({ error: { message: 'Perfil não encontrado' } })
      return
    }
    res.json(updated)
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

const accountSchema = z.object({
  displayName: z.string().min(2).max(80),
})

meRouter.patch('/profile/preferences', (req, res, next) => {
  try {
    const body = prefsSchema.parse(req.body)
    const updated = updateProfilePreferences(req.user!.email, body)
    if (!updated) {
      res.status(404).json({ error: { message: 'Perfil não encontrado' } })
      return
    }
    res.json(updated)
  } catch (e) {
    next(e)
  }
})

meRouter.patch('/profile/account', (req, res, next) => {
  try {
    const body = accountSchema.parse(req.body)
    const updated = updateProfileDisplayName(req.user!.email, body.displayName)
    if (!updated) {
      res.status(404).json({ error: { message: 'Perfil não encontrado' } })
      return
    }
    res.json(updated)
  } catch (e) {
    next(e)
  }
})

const poolSchema = z.object({ current: z.number(), max: z.number() })

const createCharacterSchema = z.object({
  name: z.string().min(1).max(120),
  species: z.string().min(1).max(120),
  clan: z.string().max(120).optional(),
  level: z.number().int().min(1).max(20).default(1),
  isPrimary: z.boolean().optional(),
  hp: poolSchema,
  blood: poolSchema.optional(),
  mana: poolSchema.optional(),
  will: poolSchema.optional(),
  startingXp: z.number().int().min(0).max(100_000).optional(),
  vitals: z
    .object({
      hpDie: z.string().max(10).optional(),
      manaDie: z.string().max(10).optional(),
      locked: z.boolean().optional(),
    })
    .optional(),
  balanceStats: z.record(z.string(), z.number()).optional(),
})

meRouter.post('/characters', (req, res, next) => {
  try {
    const body = createCharacterSchema.parse(req.body)
    const startingXp = body.startingXp ?? STARTING_CHARACTER_XP
    const created = upsertCharacter(req.user!.email, {
      name: body.name,
      species: body.species,
      clan: body.clan,
      level: body.level,
      isPrimary: body.isPrimary ?? true,
      hp: body.hp,
      blood: body.blood,
      mana: body.mana,
      will: body.will,
      xp: { current: startingXp, toNext: xpRequiredToAdvance(body.level) },
      subclass: null,
      balanceStats: body.balanceStats ?? null,
      vitals: {
        hpDie: body.vitals?.hpDie ?? null,
        manaDie: body.vitals?.manaDie ?? null,
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
    res.status(404).json({ error: { message: 'Personagem não encontrado' } })
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
      }),
    )
    .optional(),
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

meRouter.patch('/characters/:characterId', (req, res, next) => {
  try {
    const body = patchCharacterSchema.parse(req.body)
    const updated = patchCharacter(req.user!.email, req.params.characterId, body)
    if (!updated) {
      res.status(body.showOnHome ? 409 : 404).json({
        error: {
          message: body.showOnHome
            ? 'Já há 3 personagens destacados no Início'
            : 'Personagem não encontrado',
        },
      })
      return
    }
    res.json(updated)
  } catch (e) {
    next(e)
  }
})

/** Jogador não concede XP a si mesmo — somente o narrador na mesa. */
meRouter.post('/characters/:characterId/xp', (_req, res) => {
  res.status(403).json({
    error: { message: 'Somente o narrador concede XP na mesa da sessão.' },
  })
})

meRouter.get('/dashboard', (req, res) => {
  const profile = ensureProfile(req.user!.email, req.user!.displayName, req.user!.role)
  const scheduled = listScheduledSessions()
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
      ? { name: activeChronicle, act: nextSession ? `Próximo encontro · ${new Date(nextSession.scheduledAt).toLocaleDateString('pt-BR')}` : '' }
      : null,
    nextSession: nextSession
      ? {
          id: nextSession.id,
          title: nextSession.chronicleName ?? nextSession.title,
          scheduledAt: nextSession.scheduledAt,
          status: nextSession.status,
          accessCode: nextSession.accessCode,
        }
      : null,
    characters: displayChars.map((c) => ({
      id: c.id,
      name: c.name,
      species: c.species,
      clan: c.clan,
      selected: c.isPrimary,
      showOnHome: c.showOnHome,
      hp: c.hp,
      blood: c.blood,
      will: { current: 0, max: 8 },
      xp: { current: 0, max: 1000 },
    })),
  })
})

meRouter.post('/sessions/:sessionId/presence', (req, res) => {
  const updated = confirmSessionPresence(req.params.sessionId, {
    email: req.user!.email,
    displayName: req.user!.displayName,
  })
  if (!updated) {
    res.status(404).json({ error: { message: 'Sessão não encontrada' } })
    return
  }
  res.json(updated)
})

meRouter.post('/sessions/:sessionId/join', (req, res, next) => {
  try {
    const body = z
      .object({
        accessCode: z.string().min(4).max(32),
        characterId: z.string().min(1),
      })
      .parse(req.body)
    const profile = ensureProfile(req.user!.email, req.user!.displayName, req.user!.role)
    const character = profile.characters.find((c) => c.id === body.characterId)
    if (!character) {
      res.status(404).json({ error: { message: 'Personagem não encontrado' } })
      return
    }
    const result = joinSessionWithCode(
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
            ? 'A mesa ainda não foi aberta pelo narrador'
            : 'Sessão não encontrada'
      res.status(result.reason === 'bad_code' ? 403 : result.reason === 'not_open' ? 409 : 404).json({
        error: { message },
      })
      return
    }
    res.json(result.session)
  } catch (e) {
    next(e)
  }
})

meRouter.post('/sessions/:sessionId/leave', (req, res) => {
  const updated = leaveSessionSeat(req.params.sessionId, req.user!.email)
  if (!updated) {
    res.status(404).json({ error: { message: 'Sessão não encontrada' } })
    return
  }
  res.json(updated)
})

meRouter.post('/sessions/:sessionId/replace-character', (req, res, next) => {
  try {
    const body = z.object({ characterId: z.string().min(1) }).parse(req.body)
    const profile = ensureProfile(req.user!.email, req.user!.displayName, req.user!.role)
    const character = profile.characters.find((c) => c.id === body.characterId)
    if (!character) {
      res.status(404).json({ error: { message: 'Personagem não encontrado' } })
      return
    }
    const session = getScheduledSession(req.params.sessionId)
    if (!session) {
      res.status(404).json({ error: { message: 'Sessão não encontrada' } })
      return
    }
    const seated = session.seats.some((s) => s.email === req.user!.email && !s.leftAt)
    if (!seated) {
      res.status(403).json({ error: { message: 'Entre na mesa com o código antes de trocar o personagem' } })
      return
    }
    const updated = replaceSessionCharacter(req.params.sessionId, req.user!.email, {
      id: character.id,
      name: character.name,
    })
    res.json(updated)
  } catch (e) {
    next(e)
  }
})
