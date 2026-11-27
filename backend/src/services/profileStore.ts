import { createHash, randomUUID } from 'node:crypto'
import {
  checkRemoteDocumentRevision,
  commitDocument,
  documentWeight,
  getLoadedDocumentRevision,
  loadDocument,
  runExclusive,
} from './campaignDocuments.js'
import { recordOperationStrict } from './operationLog.js'
import { computeCharacterBalanceFromSheet } from './characterBalance.js'
import { readRules } from './rulesState.js'
import { mirrorProfileToSql } from './profileSqlMirror.js'
import { ConflictError, ForbiddenError, NotFoundError, ValidationError } from './errors.js'
import { getSupabaseAdmin } from './supabaseClient.js'
import {
  MAX_CHARACTER_LEVEL,
  MIN_CHARACTER_LEVEL,
  SECOND_SUBCLASS_CHOICE_LEVEL,
  STARTING_CHARACTER_XP,
  SUBCLASS_CHOICE_LEVEL,
  VITALS_PER_LEVEL,
  xpRequiredToAdvance,
} from './progressionRules.js'

export {
  MIN_CHARACTER_LEVEL,
  MAX_CHARACTER_LEVEL,
  SUBCLASS_CHOICE_LEVEL,
  SECOND_SUBCLASS_CHOICE_LEVEL,
  STARTING_CHARACTER_XP,
  VITALS_PER_LEVEL,
  xpRequiredToAdvance,
}

export type CharacterInventoryItem = {
  id: string
  name: string
  description?: string
  category: 'weapon' | 'armor' | 'elixir' | 'ritual' | 'material' | 'trinket' | 'other'
  rarity: 'comum' | 'incomum' | 'raro' | 'ancestral' | 'proibido'
  weightKg: number
  equipped?: boolean
  slot?: 'head' | 'torso' | 'hands' | 'feet' | 'rings' | 'accessory' | null
  status?: 'ok' | 'broken' | 'cooldown' | 'drop'
  statsLabel?: string
  durability?: { current: number; max: number }
  charges?: number
}

export type CharacterIdentity = {
  faith?: string | null
  house?: string | null
  nature?: string | null
  demeanor?: string | null
  concept?: string | null
  residence?: string | null
  sire?: string | null
  ambition?: string | null
  secretWeakness?: string | null
  sireRelation?: string | null
  patrons: string[]
  chronicleName?: string | null
  editCounts: {
    house: number
    nature: number
    demeanor: number
    concept: number
    residence: number
  }
}

export type CreatedSkill = {
  id: string
  name: string
  die: string
  attribute: string
  attributeMod: number
  howItWorks: string
  manaCost?: number
}

export type CharacterVitalsMeta = {
  hpDie?: string | null
  manaDie?: string | null
  caDie?: string | null
  caValue?: number | null
  locked?: boolean
}

export type ProfileCharacter = {
  id: string
  name: string
  species: string
  clan?: string
  level: number
  isPrimary?: boolean
  showOnHome?: boolean
  portraitUrl?: string | null
  hp: { current: number; max: number }
  blood?: { current: number; max: number }
  mana?: { current: number; max: number }
  will?: { current: number; max: number }
  xp: { current: number; toNext: number }
  /** Subclasse I (desbloqueada no nível 5). */
  subclass?: string | null
  /** Subclasse adicional (desbloqueada no nível 7). */
  secondarySubclass?: string | null
  approval?: 'draft' | 'submitted' | 'changes' | 'approved'
  reviewNote?: string | null
  /** Marca fichas legadas fora da regra 0–10 sem apagar nível ou subclasse. */
  needsRuleReview?: boolean
  ruleReviewNote?: string | null
  characterClass?: string | null
  identity: CharacterIdentity
  inventory: CharacterInventoryItem[]
  createdSkills: CreatedSkill[]
  carryCapacityKg: number
  balanceStats?: Record<string, number> | null
  vitals?: CharacterVitalsMeta | null
  effects?: ActiveEffect[]
  sheetRevision?: number
}

export type ActiveEffect = {
  id: string
  itemId: string
  pausedAt?: string | null
  name: string
  startedAt: string
  remainingTurns: number | null
  endsAt: string | null
}

export type CharacterRevisionRecord = {
  id: string
  characterId: string
  profileEmail: string
  revision: number
  reason: string
  actorEmail: string
  createdAt: string
  snapshot: ProfileCharacter
}

export function defaultIdentity(): CharacterIdentity {
  return {
    faith: null,
    house: null,
    nature: null,
    demeanor: null,
    concept: null,
    residence: null,
    patrons: [],
    chronicleName: null,
    editCounts: { house: 0, nature: 0, demeanor: 0, concept: 0, residence: 0 },
  }
}

export type UserProfile = {
  userId: string
  email: string
  publicId?: string
  displayName: string
  handle: string
  role: 'player' | 'narrator' | 'admin'
  memberSince: string
  avatarUrl: string | null
  bannerUrl: string | null
  badges: string[]
  preferences: {
    fiefOrigin: string | null
    narrativePreference: string | null
    bio: string | null
    visibility: 'private' | 'court' | 'open'
    notifySessions: boolean
    notifyChronicle: boolean
    courtTitle: string | null
    chronicleSlogan: string | null
    archiveFocus: string | null
    defaultRpgTitle: string | null
  }
  accountMetrics: {
    characters: number | null
    sessions: number | null
    chronicles: number | null
    totalXp: number | null
  }
  lineageStats: {
    charactersCreated: number | null
    sessionsParticipated: number | null
    hoursPlayed: number | null
    chronicleWins: number | null
    xpAccumulated: number | null
    favoriteClass: string | null
  }
  characters: ProfileCharacter[]
}

const PROFILES_DOC = 'profiles'
const REVISIONS_DOC = 'character-revisions'
const SCHEMA_RETRY_COOLDOWN_MS = 10 * 60_000
const profiles = new Map<string, UserProfile>()
const revisionsByChar = new Map<string, CharacterRevisionRecord[]>()
let revisionsTableUnavailableUntil = 0

export function publicPlayerId(email: string): string {
  const hex = createHash('sha256').update(email.trim().toLowerCase()).digest('hex')
  const num = (BigInt(`0x${hex.slice(0, 15)}`) % 9_000_000_000n) + 1_000_000_000n
  return num.toString()
}

function resolveNumericPublicId(email: string, stored?: string | null): string {
  const trimmed = stored?.trim()
  if (trimmed && /^\d{8,12}$/.test(trimmed)) return trimmed
  return publicPlayerId(email)
}

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T
}

function revKey(email: string, characterId: string) {
  return `${email.trim().toLowerCase()}::${characterId}`
}

export type LegacyProfileCharacterInput = Omit<
  ProfileCharacter,
  'identity' | 'inventory' | 'createdSkills' | 'carryCapacityKg'
> & {
  identity?: Partial<CharacterIdentity>
  inventory?: CharacterInventoryItem[]
  createdSkills?: CreatedSkill[]
  carryCapacityKg?: number
}

/** Migra ficha legada de forma não destrutiva e idempotente (C12). */
export function migrateLegacyCharacter(ch: LegacyProfileCharacterInput): ProfileCharacter {
  const next: ProfileCharacter = {
    ...ch,
    identity: { ...defaultIdentity(), ...ch.identity },
    inventory: ch.inventory ?? [],
    createdSkills: ch.createdSkills ?? [],
    carryCapacityKg: ch.carryCapacityKg ?? 28,
    secondarySubclass: ch.secondarySubclass ?? null,
    sheetRevision: ch.sheetRevision ?? 0,
  }

  const reasons: string[] = []
  if (next.level > MAX_CHARACTER_LEVEL) {
    reasons.push(`Nível legado (${next.level}) acima do teto atual (${MAX_CHARACTER_LEVEL}).`)
  }
  if (next.subclass && next.level < SUBCLASS_CHOICE_LEVEL) {
    reasons.push(`Subclasse principal (${next.subclass}) registrada abaixo do nível ${SUBCLASS_CHOICE_LEVEL}.`)
  }
  if (next.secondarySubclass && next.level < SECOND_SUBCLASS_CHOICE_LEVEL) {
    reasons.push(`Subclasse adicional (${next.secondarySubclass}) registrada abaixo do nível ${SECOND_SUBCLASS_CHOICE_LEVEL}.`)
  }

  if (reasons.length > 0) {
    next.needsRuleReview = true
    next.ruleReviewNote = next.ruleReviewNote || reasons.join(' ')
    if (next.level > MAX_CHARACTER_LEVEL) {
      next.xp = { current: next.xp?.current ?? 0, toNext: 0 }
    }
  } else if (next.level >= MIN_CHARACTER_LEVEL && next.level <= MAX_CHARACTER_LEVEL) {
    const expectedToNext = xpRequiredToAdvance(next.level)
    if (!next.xp || next.xp.toNext !== expectedToNext) {
      next.xp = {
        current: next.level >= MAX_CHARACTER_LEVEL ? 0 : Math.max(0, next.xp?.current ?? 0),
        toNext: expectedToNext,
      }
    }
  }

  return next
}

async function commitProfiles(changedProfiles?: UserProfile[]): Promise<void> {
  await commitDocument(PROFILES_DOC, [...profiles.values()])
  if (changedProfiles?.length) {
    for (const p of changedProfiles) {
      await mirrorProfileToSql(p)
    }
  }
}

async function persistRevisionRecord(record: CharacterRevisionRecord) {
  const key = revKey(record.profileEmail, record.characterId)
  const list = revisionsByChar.get(key) ?? []
  list.unshift(record)
  if (list.length > 30) list.length = 30
  revisionsByChar.set(key, list)

  const sb = getSupabaseAdmin()
  if (
    sb &&
    Date.now() >= revisionsTableUnavailableUntil &&
    (process.env.NODE_ENV !== 'test' || process.env.BELADONA_TEST_USE_ENV === 'true')
  ) {
    const { error } = await sb.from('RevisoesPersonagem').insert({
      id: record.id,
      character_id: record.characterId,
      profile_email: record.profileEmail.trim().toLowerCase(),
      revision: record.revision,
      snapshot: record.snapshot,
      reason: record.reason,
      actor_email: record.actorEmail.trim().toLowerCase(),
      created_at: record.createdAt,
    })
    if (error) {
      if (error.code === 'PGRST205' || /RevisoesPersonagem|schema cache|does not exist/i.test(error.message)) {
        revisionsTableUnavailableUntil = Date.now() + SCHEMA_RETRY_COOLDOWN_MS
      } else {
        console.warn('[revisoes] Falha ao gravar RevisoesPersonagem:', error.message)
      }
    }
  }

  const allRevs = [...revisionsByChar.values()].flat().slice(0, 600)
  await commitDocument(REVISIONS_DOC, allRevs)
}

export async function syncProfilesIfStale() {
  const remoteRev = await checkRemoteDocumentRevision(PROFILES_DOC)
  if (remoteRev > getLoadedDocumentRevision(PROFILES_DOC)) {
    await hydrateProfiles()
  }
}

export async function hydrateProfiles() {
  const [doc, revDoc] = await Promise.all([
    loadDocument<UserProfile[]>(PROFILES_DOC),
    loadDocument<CharacterRevisionRecord[]>(REVISIONS_DOC),
  ])
  if (doc && documentWeight(doc.body) > 0) {
    profiles.clear()
    for (const profile of doc.body) {
      if (profile?.email) {
        const publicId = resolveNumericPublicId(profile.email, profile.publicId)
        const legacyEmailHandle = handleFromEmail(profile.email)
        const handle =
          !profile.handle || profile.handle === legacyEmailHandle
            ? defaultHandleFor(profile.displayName || 'cainita', publicId)
            : profile.handle
        const normalized: UserProfile = {
          ...profile,
          publicId,
          handle,
          preferences: { ...defaultPreferences(), ...profile.preferences },
          characters: (profile.characters ?? []).map(migrateLegacyCharacter),
        }
        profiles.set(profile.email, normalized)
      }
    }
  }
  if (revDoc && documentWeight(revDoc.body) > 0) {
    revisionsByChar.clear()
    for (const rev of revDoc.body) {
      if (!rev?.characterId || !rev?.profileEmail) continue
      const k = revKey(rev.profileEmail, rev.characterId)
      const arr = revisionsByChar.get(k) ?? []
      arr.push(rev)
      revisionsByChar.set(k, arr)
    }
  }
}

export function resetProfilesForTests() {
  profiles.clear()
  revisionsByChar.clear()
}

function handleFromEmail(email: string) {
  return `@${email.split('@')[0]?.replace(/\W/g, '_') ?? 'cainita'}`
}

function defaultHandleFor(displayName: string, publicId: string) {
  const slug = displayName
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9_]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 16)
  const suffix = publicId.replace(/\D/g, '').slice(-4) || '0000'
  return `@${slug || 'cainita'}_${suffix}`
}

export function normalizeHandleInput(raw: string): string {
  const cleaned = raw
    .trim()
    .replace(/^@+/, '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9_]/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_+|_+$/g, '')
  if (cleaned.length < 3 || cleaned.length > 30) {
    throw new ValidationError('O @usuário precisa ter entre 3 e 30 caracteres (letras, números ou _).')
  }
  return `@${cleaned}`
}

const defaultPreferences = (): UserProfile['preferences'] => ({
  fiefOrigin: null,
  narrativePreference: null,
  bio: null,
  visibility: 'court',
  notifySessions: true,
  notifyChronicle: true,
  courtTitle: null,
  chronicleSlogan: null,
  archiveFocus: null,
  defaultRpgTitle: null,
})

function findProfileKey(email: string): string | null {
  if (profiles.has(email)) return email
  const target = email.trim().toLowerCase()
  for (const key of profiles.keys()) {
    if (key.trim().toLowerCase() === target) return key
  }
  return null
}

async function runProfileMutation<T>(fn: () => Promise<T> | T): Promise<T> {
  return runExclusive('store:profiles', async () => {
    await syncProfilesIfStale()
    const backup = clone([...profiles.entries()])
    try {
      return await fn()
    } catch (err) {
      profiles.clear()
      for (const [k, v] of backup) profiles.set(k, v)
      throw err
    }
  })
}

export async function ensureProfile(
  email: string,
  displayName: string,
  role: UserProfile['role'] = 'player',
  options?: { authoritative?: boolean },
): Promise<UserProfile> {
  return runProfileMutation(async () => {
    const existingKey = findProfileKey(email)
    if (existingKey) {
      const p = profiles.get(existingKey)!
      const previousName = p.displayName
      const previousRole = p.role
      const previousPublicId = p.publicId
      p.preferences = { ...defaultPreferences(), ...p.preferences }
      p.publicId = resolveNumericPublicId(p.email, p.publicId)
      p.displayName = displayName
      if (role === 'narrator' || role === 'admin' || options?.authoritative) {
        p.role = role
        if (role === 'narrator' || role === 'admin') {
          if (!p.badges.includes('Mestre da Mesa')) p.badges.push('Mestre da Mesa')
        }
      } else if (p.role !== 'narrator' && p.role !== 'admin') {
        p.role = role
      }
      const previousHandle = p.handle
      const legacyEmailHandle = handleFromEmail(email)
      if (!p.handle || p.handle === legacyEmailHandle) {
        p.handle = defaultHandleFor(p.displayName, p.publicId)
      }
      if (
        previousName !== p.displayName ||
        previousRole !== p.role ||
        previousPublicId !== p.publicId ||
        previousHandle !== p.handle
      ) {
        await commitProfiles([p])
      }
      return p
    }
    const numericId = publicPlayerId(email)
    const profile: UserProfile = {
      userId: email,
      email,
      publicId: numericId,
      displayName,
      handle: defaultHandleFor(displayName, numericId),
      role,
      memberSince: new Date().toISOString(),
      avatarUrl: null,
      bannerUrl: null,
      badges: role === 'narrator' || role === 'admin' ? ['Mestre da Mesa'] : [],
      preferences: defaultPreferences(),
      accountMetrics: {
        characters: null,
        sessions: null,
        chronicles: null,
        totalXp: null,
      },
      lineageStats: {
        charactersCreated: null,
        sessionsParticipated: null,
        hoursPlayed: null,
        chronicleWins: null,
        xpAccumulated: null,
        favoriteClass: null,
      },
      characters: [],
    }
    profiles.set(email, profile)
    syncDerivedMetrics(profile)
    await commitProfiles([profile])
    return profile
  })
}

function syncDerivedMetrics(profile: UserProfile) {
  const count = profile.characters.length
  profile.accountMetrics.characters = count > 0 ? count : null
  profile.lineageStats.charactersCreated = count > 0 ? count : null
  const totalXp = profile.characters.reduce((sum, ch) => sum + (ch.xp?.current ?? 0), 0)
  profile.accountMetrics.totalXp = count > 0 ? totalXp : null
  profile.lineageStats.xpAccumulated = count > 0 ? totalXp : null
  if (count === 0) {
    profile.lineageStats.favoriteClass = null
  }
}

export function getProfile(email: string) {
  const key = findProfileKey(email)
  return key ? profiles.get(key) ?? null : null
}

export function findProfileByPublicId(publicIdOrEmail: string): UserProfile | null {
  const direct = getProfile(publicIdOrEmail)
  if (direct) return direct
  const needle = publicIdOrEmail.trim().toLowerCase()
  if (!needle) return null
  const needleHandle = needle.startsWith('@') ? needle : `@${needle}`
  for (const p of profiles.values()) {
    const pub = resolveNumericPublicId(p.email, p.publicId).toLowerCase()
    const h = p.handle.toLowerCase()
    if (pub === needle || h === needle || h === needleHandle) {
      return p
    }
  }
  return null
}

export function adminPlayerCharactersByUser() {
  const slices: { label: string; count: number }[] = []
  for (const profile of profiles.values()) {
    if (profile.role !== 'player') continue
    const count = profile.characters.length
    if (count <= 0) continue
    slices.push({ label: profile.displayName || profile.handle, count })
  }
  slices.sort((a, b) => b.count - a.count)
  return slices
}

export function listRegisteredPlayers() {
  return [...profiles.values()]
    .filter((p) => p.role === 'player')
    .map((p) => ({
      id: resolveNumericPublicId(p.email, p.publicId),
      email: p.email,
      displayName: p.displayName,
      handle: p.handle,
      role: p.role,
      memberSince: p.memberSince,
      characters: p.characters.length,
    }))
    .sort((a, b) => a.displayName.localeCompare(b.displayName))
}

/** Lista todas as contas cadastradas (jogadores e narradores) para busca de amizades. */
export function listSearchableAccounts() {
  return [...profiles.values()]
    .map((p) => ({
      id: resolveNumericPublicId(p.email, p.publicId),
      email: p.email,
      displayName: p.displayName,
      handle: p.handle,
      role: p.role,
      memberSince: p.memberSince,
      characters: p.characters.length,
    }))
    .sort((a, b) => a.displayName.localeCompare(b.displayName))
}

export async function updateProfileMedia(
  email: string,
  patch: { avatarUrl?: string | null; bannerUrl?: string | null },
) {
  return runProfileMutation(async () => {
    const p = getProfile(email)
    if (!p) return null
    if (patch.avatarUrl !== undefined) p.avatarUrl = patch.avatarUrl
    if (patch.bannerUrl !== undefined) p.bannerUrl = patch.bannerUrl
    await commitProfiles([p])
    return p
  })
}

export async function updateProfilePreferences(
  email: string,
  patch: Partial<UserProfile['preferences']>,
) {
  return runProfileMutation(async () => {
    const p = getProfile(email)
    if (!p) return null
    p.preferences = { ...p.preferences, ...patch }
    await commitProfiles([p])
    return p
  })
}

export async function updateProfileAccount(
  email: string,
  patch: { displayName?: string; handle?: string },
) {
  return runProfileMutation(async () => {
    const p = getProfile(email)
    if (!p) return null
    if (patch.displayName !== undefined) {
      p.displayName = patch.displayName.trim()
    }
    if (patch.handle !== undefined) {
      const normalized = normalizeHandleInput(patch.handle)
      const meKey = p.email.trim().toLowerCase()
      const taken = [...profiles.values()].some(
        (other) => other.email.trim().toLowerCase() !== meKey && other.handle.toLowerCase() === normalized,
      )
      if (taken) {
        throw new ConflictError('Este @usuário já está em uso por outra conta.')
      }
      p.handle = normalized
    }
    await commitProfiles([p])
    return p
  })
}

export async function updateProfileDisplayName(email: string, displayName: string) {
  return updateProfileAccount(email, { displayName })
}

export function listCharacters(email: string) {
  return getProfile(email)?.characters ?? []
}

export function getCharacter(email: string, characterId: string) {
  return listCharacters(email).find((c) => c.id === characterId) ?? null
}

export async function patchCharacter(
  email: string,
  characterId: string,
  patch: Partial<
    Pick<
      ProfileCharacter,
      | 'name'
      | 'clan'
      | 'portraitUrl'
      | 'hp'
      | 'blood'
      | 'mana'
      | 'will'
      | 'subclass'
      | 'secondarySubclass'
      | 'characterClass'
      | 'inventory'
      | 'carryCapacityKg'
      | 'isPrimary'
      | 'showOnHome'
      | 'createdSkills'
      | 'balanceStats'
    >
  > & {
    faith?: string | null
    expectedRevision?: number
    identityPatch?: Partial<
      Pick<
        CharacterIdentity,
        'house' | 'nature' | 'demeanor' | 'concept' | 'residence' | 'sire' | 'ambition' | 'secretWeakness' | 'sireRelation'
      >
    >
  },
) {
  return runProfileMutation(async () => {
    const p = getProfile(email)
    if (!p) return null
    const idx = p.characters.findIndex((c) => c.id === characterId)
    if (idx < 0) return null
    const current = p.characters[idx]

    if (patch.expectedRevision != null && (current.sheetRevision ?? 0) !== patch.expectedRevision) {
      throw new ConflictError('Outra aba ou dispositivo alterou esta ficha. Recarregue e tente de novo.', {
        revision: current.sheetRevision ?? 0,
        character: current,
      })
    }

    const identity: CharacterIdentity = {
      ...defaultIdentity(),
      ...current.identity,
      editCounts: { ...defaultIdentity().editCounts, ...current.identity?.editCounts },
    }
    if (patch.faith !== undefined) identity.faith = patch.faith

    if (patch.identityPatch) {
      const limit = 2
      for (const key of ['house', 'nature', 'demeanor', 'concept', 'residence'] as const) {
        const next = patch.identityPatch[key]
        if (next === undefined) continue
        if ((identity.editCounts[key] ?? 0) >= limit) continue
        if ((identity[key] ?? '') === (next ?? '')) continue
        identity[key] = next
        identity.editCounts[key] = (identity.editCounts[key] ?? 0) + 1
      }
      for (const key of ['sire', 'ambition', 'secretWeakness', 'sireRelation'] as const) {
        const next = patch.identityPatch[key]
        if (next !== undefined) identity[key] = next
      }
    }

    if (patch.isPrimary === true) {
      p.characters = p.characters.map((c) => ({ ...c, isPrimary: c.id === characterId }))
    }

    if (patch.showOnHome === true && p.characters.length > 10) {
      const already = p.characters.filter((c) => c.showOnHome && c.id !== characterId).length
      if (already >= 3) {
        throw new ConflictError('Já há 3 personagens destacados no Início')
      }
    }

    const { faith: _f, identityPatch: _i, expectedRevision: _rev, ...rest } = patch

    // Garante que patch do jogador nunca altera campos controlados pelo narrador
    delete (rest as Record<string, unknown>).level
    delete (rest as Record<string, unknown>).xp
    delete (rest as Record<string, unknown>).approval
    delete (rest as Record<string, unknown>).reviewNote
    delete (rest as Record<string, unknown>).needsRuleReview
    delete (rest as Record<string, unknown>).ruleReviewNote

    if (current.vitals?.locked) {
      if (rest.hp) {
        const nextCurrent = Math.max(0, Math.floor(rest.hp.current))
        rest.hp = { current: Math.min(nextCurrent, current.hp.max), max: current.hp.max }
      }
      if (rest.mana && current.mana) {
        const nextCurrent = Math.max(0, Math.floor(rest.mana.current))
        rest.mana = { current: Math.min(nextCurrent, current.mana.max), max: current.mana.max }
      } else if (rest.mana && !current.mana) {
        delete (rest as { mana?: unknown }).mana
      }
      if (rest.blood && current.blood) {
        const nextCurrent = Math.max(0, Math.floor(rest.blood.current))
        rest.blood = { current: Math.min(nextCurrent, current.blood.max), max: current.blood.max }
      } else if (rest.blood && !current.blood) {
        delete (rest as { blood?: unknown }).blood
      }
      if (rest.will && current.will) {
        const nextCurrent = Math.max(0, Math.floor(rest.will.current))
        rest.will = { current: Math.min(nextCurrent, current.will.max), max: current.will.max }
      } else if (rest.will && !current.will) {
        delete (rest as { will?: unknown }).will
      }
    }

    const nextInventory = rest.inventory
      ? mergeOwnedInventory(current.inventory ?? [], rest.inventory)
      : (current.inventory ?? [])

    const nextRevision = (current.sheetRevision ?? 0) + 1
    const updatedChar: ProfileCharacter = {
      ...current,
      ...rest,
      identity,
      inventory: nextInventory,
      createdSkills: guardApprovedSkills(current, rest.createdSkills),
      vitals: current.vitals,
      effects: effectsAfterUse(current, nextInventory),
      sheetRevision: nextRevision,
    }

    p.characters[idx] = updatedChar
    await commitProfiles([p])
    const prevRev = current.sheetRevision ?? 0
    const existingRevs = listCharacterRevisions(p.email, current.id)
    if (!existingRevs.some((r) => r.revision === prevRev)) {
      await persistRevisionRecord({
        id: randomUUID(),
        characterId: current.id,
        profileEmail: p.email,
        revision: prevRev,
        reason: 'pre_patch',
        actorEmail: p.email,
        createdAt: new Date().toISOString(),
        snapshot: clone(current),
      })
    }
    await persistRevisionRecord({
      id: randomUUID(),
      characterId: updatedChar.id,
      profileEmail: p.email,
      revision: nextRevision,
      reason: 'sheet_patch',
      actorEmail: p.email,
      createdAt: new Date().toISOString(),
      snapshot: clone(updatedChar),
    })
    return updatedChar
  })
}

export async function applyCharacterXp(
  email: string,
  characterId: string,
  amount: number,
  meta?: { actorEmail?: string; sessionId?: string; operationId?: string },
) {
  if (!Number.isFinite(amount)) return null
  return runProfileMutation(async () => {
    const p = getProfile(email)
    if (!p) return null
    const idx = p.characters.findIndex((c) => c.id === characterId)
    if (idx < 0) return null
    const ch = p.characters[idx]
    let level = ch.level
    const previousLevel = level
    const rules = readRules()
    const levelCap = Math.min(MAX_CHARACTER_LEVEL, rules.maxLevel)

    let current = Math.max(0, (ch.xp?.current ?? 0) + Math.floor(amount))
    let toNext = ch.xp?.toNext ?? xpRequiredToAdvance(level)

    while (level < levelCap && toNext > 0 && current >= toNext) {
      current -= toNext
      level += 1
      toNext = level >= levelCap ? 0 : xpRequiredToAdvance(level)
    }
    if (level >= levelCap) {
      // Preserva XP de fichas legadas que já ultrapassavam levelCap; zera excedente somente ao atingir o teto normalmente
      if (previousLevel < levelCap) current = 0
      toNext = 0
    }

    const levelsGained = Math.max(0, level - previousLevel)
    const bonus = levelsGained * VITALS_PER_LEVEL
    const hp = {
      current: ch.hp.current + bonus,
      max: ch.hp.max + bonus,
    }
    const mana = ch.mana
      ? {
        current: ch.mana.current + bonus,
        max: ch.mana.max + bonus,
      }
      : ch.mana

    const nextRevision = (ch.sheetRevision ?? 0) + 1
    const updatedChar: ProfileCharacter = {
      ...ch,
      level,
      xp: { current, toNext },
      hp,
      mana,
      sheetRevision: nextRevision,
    }
    p.characters[idx] = updatedChar
    syncDerivedMetrics(p)
    await commitProfiles([p])
    await persistRevisionRecord({
      id: randomUUID(),
      characterId: updatedChar.id,
      profileEmail: p.email,
      revision: nextRevision,
      reason: `xp:${amount}`,
      actorEmail: meta?.actorEmail?.trim() || p.email,
      createdAt: new Date().toISOString(),
      snapshot: clone(updatedChar),
    })
    await recordOperationStrict({
      email: p.email,
      actorEmail: meta?.actorEmail?.trim() || p.email,
      kind: 'xp',
      summary: `XP ${amount >= 0 ? '+' : ''}${amount}`,
      before: String(previousLevel),
      after: String(level),
      sessionId: meta?.sessionId,
      characterId: updatedChar.id,
      operationId: meta?.operationId,
    })
    return updatedChar
  })
}

export function listProfiles() {
  return [...profiles.values()]
}

export async function submitCharacter(email: string, characterId: string) {
  return runProfileMutation(async () => {
    const p = getProfile(email)
    const ch = p?.characters.find((item) => item.id === characterId)
    if (!p || !ch) return null
    ch.approval = 'submitted'
    ch.reviewNote = null
    ch.sheetRevision = (ch.sheetRevision ?? 0) + 1
    await commitProfiles([p])
    await recordOperationStrict({
      email: p.email,
      actorEmail: p.email,
      kind: 'approval',
      summary: `Ficha enviada: ${ch.name}`,
      characterId: ch.id,
    })
    return ch
  })
}

export async function reviewCharacter(
  email: string,
  characterId: string,
  status: 'approved' | 'changes',
  note: string,
  actorEmail: string,
) {
  return runProfileMutation(async () => {
    const p = getProfile(email)
    const ch = p?.characters.find((item) => item.id === characterId)
    if (!p || !ch) return null
    ch.approval = status
    ch.reviewNote = note.trim() || null
    ch.needsRuleReview = false
    ch.ruleReviewNote = null
    ch.sheetRevision = (ch.sheetRevision ?? 0) + 1
    await commitProfiles([p])
    await persistRevisionRecord({
      id: randomUUID(),
      characterId: ch.id,
      profileEmail: p.email,
      revision: ch.sheetRevision,
      reason: `review:${status}`,
      actorEmail,
      createdAt: new Date().toISOString(),
      snapshot: clone(ch),
    })
    await recordOperationStrict({
      email: p.email,
      actorEmail,
      kind: 'approval',
      summary: status === 'approved' ? `Ficha aprovada: ${ch.name}` : `Ajustes pedidos: ${ch.name}`,
      after: note.trim() || undefined,
      characterId: ch.id,
    })
    return ch
  })
}

export function listCharacterRevisions(email: string, characterId: string): CharacterRevisionRecord[] {
  const key = revKey(email, characterId)
  return [...(revisionsByChar.get(key) ?? [])].sort((a, b) => b.revision - a.revision)
}

export async function restoreCharacterRevision(params: {
  email: string
  characterId: string
  revisionId: string
  actorEmail: string
  dryRun?: boolean
  confirm?: string
}) {
  return runProfileMutation(async () => {
    const p = getProfile(params.email)
    if (!p) throw new NotFoundError('Perfil não encontrado.')
    const idx = p.characters.findIndex((c) => c.id === params.characterId)
    if (idx < 0) throw new NotFoundError('Personagem não encontrado.')

    const revs = listCharacterRevisions(p.email, params.characterId)
    const target = revs.find((r) => r.id === params.revisionId || String(r.revision) === params.revisionId)
    if (!target) throw new NotFoundError('Revisão da ficha não encontrada.')

    const current = p.characters[idx]
    const snap = clone(target.snapshot)
    if (snap.id !== current.id) {
      throw new ValidationError('Revisão incompatível com este personagem.')
    }

    // Preserva inventário atual adquirido por compra/leilão e vínculos legítimos se solicitado
    const currentOwnedIds = new Set((current.inventory ?? []).map((i) => i.id))
    const mergedInventory = [...(snap.inventory ?? [])]
    for (const item of current.inventory ?? []) {
      if (!mergedInventory.some((x) => x.id === item.id) && currentOwnedIds.has(item.id)) {
        mergedInventory.push(item)
      }
    }

    const preview = {
      dryRun: Boolean(params.dryRun),
      characterId: current.id,
      fromRevision: current.sheetRevision ?? 0,
      toRevision: target.revision,
      levelBefore: current.level,
      levelAfter: snap.level,
      inventoryCountBefore: (current.inventory ?? []).length,
      inventoryCountAfter: mergedInventory.length,
    }

    if (params.dryRun) {
      return { ...preview, restored: false as const }
    }
    if (params.confirm !== 'restaurar-revisao') {
      throw new ValidationError('Confirmação explícita obrigatória para restaurar revisão.')
    }

    const nextRevision = (current.sheetRevision ?? 0) + 1
    const restoredChar: ProfileCharacter = {
      ...snap,
      inventory: mergedInventory,
      sheetRevision: nextRevision,
    }
    p.characters[idx] = restoredChar
    syncDerivedMetrics(p)
    await commitProfiles([p])
    await persistRevisionRecord({
      id: randomUUID(),
      characterId: restoredChar.id,
      profileEmail: p.email,
      revision: nextRevision,
      reason: `restore_from:${target.revision}`,
      actorEmail: params.actorEmail,
      createdAt: new Date().toISOString(),
      snapshot: clone(restoredChar),
    })
    await recordOperationStrict({
      email: p.email,
      actorEmail: params.actorEmail,
      kind: 'restore',
      summary: `Revisão ${target.revision} restaurada em ${restoredChar.name}`,
      before: String(current.sheetRevision ?? 0),
      after: String(nextRevision),
      characterId: restoredChar.id,
    })
    return { ...preview, restored: true as const, character: restoredChar }
  })
}

export function findCharacterOwnerBySeat(characterId: string, emailHint?: string) {
  if (emailHint) {
    const p = getProfile(emailHint)
    const ch = p?.characters.find((c) => c.id === characterId)
    if (p && ch) return { email: p.email, character: ch }
  }
  for (const [email, p] of profiles.entries()) {
    const ch = p.characters.find((c) => c.id === characterId)
    if (ch) return { email, character: ch }
  }
  return null
}

export async function upsertCharacter(
  email: string,
  character: Omit<
    ProfileCharacter,
    'id' | 'xp' | 'identity' | 'inventory' | 'createdSkills' | 'carryCapacityKg' | 'vitals'
  > & {
    id?: string
    xp?: ProfileCharacter['xp']
    identity?: CharacterIdentity
    inventory?: CharacterInventoryItem[]
    createdSkills?: CreatedSkill[]
    carryCapacityKg?: number
    vitals?: CharacterVitalsMeta | null
  },
) {
  const p = await ensureProfile(email, pDisplayName(email), 'player')
  return runProfileMutation(async () => {
    const profile = getProfile(p.email)!
    const id = character.id ?? randomUUID()
    const idx = profile.characters.findIndex((c) => c.id === id)
    const rawLevel = Number.isFinite(character.level) ? Math.floor(character.level) : 1
    const level = Math.min(MAX_CHARACTER_LEVEL, Math.max(MIN_CHARACTER_LEVEL, rawLevel))
    const toNext = xpRequiredToAdvance(level)
    const prevRev = idx >= 0 ? (profile.characters[idx].sheetRevision ?? 0) : 0
    const nextRev = idx >= 0 ? prevRev + 1 : 0
    const row: ProfileCharacter = {
      id,
      name: character.name,
      species: character.species,
      clan: character.clan,
      level,
      isPrimary: character.isPrimary,
      showOnHome: character.showOnHome,
      portraitUrl: character.portraitUrl ?? null,
      hp: character.hp,
      blood: character.blood,
      mana: character.mana,
      will: character.will,
      xp: character.xp ?? { current: readRules().startingXp ?? STARTING_CHARACTER_XP, toNext },
      subclass: character.subclass ?? null,
      secondarySubclass: character.secondarySubclass ?? null,
      characterClass: character.characterClass ?? null,
      identity: character.identity ?? defaultIdentity(),
      inventory: character.inventory ?? [],
      createdSkills: character.createdSkills ?? [],
      carryCapacityKg: character.carryCapacityKg ?? 28,
      balanceStats: character.balanceStats ?? null,
      vitals: character.vitals ?? null,
      effects: character.effects,
      approval: character.approval,
      reviewNote: character.reviewNote,
      needsRuleReview: character.needsRuleReview,
      ruleReviewNote: character.ruleReviewNote,
      sheetRevision: nextRev,
    }
    if (character.isPrimary) {
      profile.characters = profile.characters.map((c) => ({ ...c, isPrimary: c.id === id }))
    }
    if (idx >= 0) profile.characters[idx] = row
    else profile.characters.push(row)
    syncDerivedMetrics(profile)
    await commitProfiles([profile])
    await persistRevisionRecord({
      id: randomUUID(),
      characterId: row.id,
      profileEmail: profile.email,
      revision: nextRev,
      reason: idx >= 0 ? 'upsert' : 'created',
      actorEmail: profile.email,
      createdAt: new Date().toISOString(),
      snapshot: clone(row),
    })
    return row
  })
}

function skillPower(skill: CreatedSkill) {
  return [skill.name, skill.die, skill.attribute, skill.attributeMod, skill.howItWorks, skill.manaCost ?? 0].join('|')
}

function guardApprovedSkills(current: ProfileCharacter, incoming: CreatedSkill[] | undefined) {
  const existing = current.createdSkills ?? []
  if (!incoming) return existing
  if (current.approval === 'approved') {
    const same =
      incoming.length === existing.length &&
      incoming.every((skill) => {
        const previous = existing.find((item) => item.id === skill.id)
        return previous && skillPower(previous) === skillPower(skill)
      })
    if (!same) {
      throw new ForbiddenError('Habilidade aprovada não pode ser trocada. Peça revisão ao mestre.')
    }
    return incoming
  }
  const cap = Math.max(existing.length, 8 + Math.max(1, current.level))
  return incoming.slice(0, cap)
}

function mergeOwnedInventory(
  current: CharacterInventoryItem[],
  incoming: CharacterInventoryItem[],
) {
  const byId = new Map(current.map((item) => [item.id, item]))
  return incoming.flatMap((item) => {
    const previous = byId.get(item.id)
    if (!previous) return []
    return [
      {
        ...previous,
        equipped: item.equipped ?? previous.equipped,
        slot: item.slot === undefined ? previous.slot : item.slot,
        status: item.status ?? previous.status,
        durability: previous.durability
          ? {
            current: Math.max(
              0,
              Math.min(previous.durability.max, item.durability?.current ?? previous.durability.current),
            ),
            max: previous.durability.max,
          }
          : undefined,
      },
    ]
  })
}

function pDisplayName(email: string) {
  return getProfile(email)?.displayName ?? email.split('@')[0] ?? 'Cainita'
}

export const BALANCE_AXES = [
  'combate',
  'social',
  'investigacao',
  'ocultismo',
  'estrategia',
  'exploracao',
  'sobrevivencia',
  'interpretacao',
] as const

export function getCharacterBalanceStats(email: string, characterId: string) {
  const ch = getCharacter(email, characterId)
  if (!ch) return { found: false as const }
  const computed = computeCharacterBalanceFromSheet(ch)
  if (!computed.hasData) {
    return { found: true as const, hasData: false as const, characterName: ch.name }
  }
  return {
    found: true as const,
    hasData: true as const,
    characterName: ch.name,
    axes: computed.axes,
    balancePercent: computed.balancePercent,
  }
}

function durationOf(item: CharacterInventoryItem) {
  const text = `${item.statsLabel ?? ''} ${item.description ?? ''}`
  const turns = /turnos?\s*[:=]?\s*(\d{1,3})/i.exec(text) ?? /(\d{1,3})\s*turnos?/i.exec(text)
  const minutes = /minutos?\s*[:=]?\s*(\d{1,4})/i.exec(text) ?? /(\d{1,4})\s*minutos?/i.exec(text)
  return {
    turns: turns ? Number(turns[1]) : null,
    minutes: minutes ? Number(minutes[1]) : null,
  }
}

function liveEffects(effects: ActiveEffect[] | undefined, now = Date.now()) {
  return (effects ?? []).filter((effect) => {
    if (effect.endsAt && Date.parse(effect.endsAt) <= now) return false
    if (effect.remainingTurns != null && effect.remainingTurns <= 0) return false
    return true
  })
}

function effectsAfterUse(current: ProfileCharacter, inventory: CharacterInventoryItem[]) {
  const kept = liveEffects(current.effects)
  const owned = new Set(inventory.map((item) => item.id))
  for (const item of current.inventory ?? []) {
    if (owned.has(item.id) || kept.some((effect) => effect.itemId === item.id)) continue
    const duration = durationOf(item)
    if (!duration.turns && !duration.minutes) continue
    kept.push({
      id: randomUUID(),
      itemId: item.id,
      name: item.name,
      startedAt: new Date().toISOString(),
      remainingTurns: duration.turns,
      endsAt: duration.minutes ? new Date(Date.now() + duration.minutes * 60_000).toISOString() : null,
    })
  }
  return kept
}

export async function refreshEffects(email: string) {
  return runProfileMutation(async () => {
    const profile = getProfile(email)
    if (!profile) return
    let changed = false
    for (const character of profile.characters) {
      const next = liveEffects(character.effects)
      if (next.length !== (character.effects ?? []).length) {
        character.effects = next
        changed = true
      }
    }
    if (changed) await commitProfiles([profile])
  })
}

export async function advanceTurnEffects(targets: Array<{ email: string; characterId: string }>) {
  return runProfileMutation(async () => {
    let changed = 0
    const dirtyProfiles: UserProfile[] = []
    for (const target of targets) {
      const profile = getProfile(target.email)
      const character = profile?.characters.find((item) => item.id === target.characterId)
      if (!profile || !character?.effects?.length) continue
      let charChanged = false
      character.effects = character.effects.flatMap((effect) => {
        if (effect.pausedAt) return [effect]
        if (effect.remainingTurns == null) return [effect]
        changed += 1
        charChanged = true
        const remainingTurns = effect.remainingTurns - 1
        return remainingTurns > 0 ? [{ ...effect, remainingTurns }] : []
      })
      if (charChanged && !dirtyProfiles.includes(profile)) dirtyProfiles.push(profile)
    }
    if (changed > 0) await commitProfiles(dirtyProfiles)
    return changed
  })
}

export async function pauseEffectsForSeats(
  seats: Array<{ email: string; characterId: string; leftAt?: string | null }>,
) {
  return runProfileMutation(async () => {
    const stamp = new Date().toISOString()
    let changed = 0
    const dirtyProfiles: UserProfile[] = []
    for (const seat of seats) {
      if (seat.leftAt) continue
      const profile = getProfile(seat.email)
      const character = profile?.characters.find((item) => item.id === seat.characterId)
      if (!profile || !character?.effects?.length) continue
      for (const effect of character.effects) {
        if (!effect.pausedAt) {
          effect.pausedAt = stamp
          changed += 1
          if (!dirtyProfiles.includes(profile)) dirtyProfiles.push(profile)
        }
      }
    }
    if (changed > 0) await commitProfiles(dirtyProfiles)
    return changed
  })
}

export function charactersOutsideRules(
  maxLevel: number,
  subclassLevel: number,
  secondarySubclassLevel = SECOND_SUBCLASS_CHOICE_LEVEL,
) {
  const rows: Array<{ email: string; characterId: string; name: string; reason: string }> = []
  for (const profile of profiles.values()) {
    for (const character of profile.characters) {
      if (character.level > maxLevel) {
        rows.push({
          email: profile.email,
          characterId: character.id,
          name: character.name,
          reason: `Nível ${character.level} passa do máximo ${maxLevel}.`,
        })
      }
      if (character.subclass && character.level < subclassLevel) {
        rows.push({
          email: profile.email,
          characterId: character.id,
          name: character.name,
          reason: `Subclasse escolhida antes do nível ${subclassLevel}.`,
        })
      }
      if (character.secondarySubclass && character.level < secondarySubclassLevel) {
        rows.push({
          email: profile.email,
          characterId: character.id,
          name: character.name,
          reason: `Subclasse adicional escolhida antes do nível ${secondarySubclassLevel}.`,
        })
      }
    }
  }
  return rows
}

export async function noteRuleChange(email: string, characterId: string, note: string) {
  return runProfileMutation(async () => {
    const profile = getProfile(email)
    const character = profile?.characters.find((item) => item.id === characterId)
    if (!profile || !character) return
    character.reviewNote = note
    character.needsRuleReview = true
    character.ruleReviewNote = note
    if (character.approval === 'approved') character.approval = 'changes'
    await commitProfiles([profile])
  })
}

function normalizeRestoredProfile(profile: UserProfile): UserProfile {
  const publicId = resolveNumericPublicId(profile.email, profile.publicId)
  const legacyEmailHandle = handleFromEmail(profile.email)
  const handle =
    !profile.handle || profile.handle === legacyEmailHandle
      ? defaultHandleFor(profile.displayName || 'cainita', publicId)
      : profile.handle
  return {
    ...profile,
    publicId,
    handle,
    role: profile.role || 'player',
    memberSince: profile.memberSince || new Date().toISOString(),
    avatarUrl: profile.avatarUrl ?? null,
    bannerUrl: profile.bannerUrl ?? null,
    badges: Array.isArray(profile.badges) ? profile.badges : [],
    preferences: { ...defaultPreferences(), ...profile.preferences },
    accountMetrics: profile.accountMetrics ?? { characters: null, sessions: null, chronicles: null, totalXp: null },
    lineageStats: profile.lineageStats ?? {
      charactersCreated: null,
      sessionsParticipated: null,
      hoursPlayed: null,
      chronicleWins: null,
      xpAccumulated: null,
      favoriteClass: null,
    },
    characters: (profile.characters ?? []).map(migrateLegacyCharacter),
  }
}

export async function restoreSingleProfile(profile: UserProfile) {
  if (!profile?.email) return
  return runProfileMutation(async () => {
    const normalized = normalizeRestoredProfile(clone(profile))
    const key = findProfileKey(normalized.email) ?? normalized.email
    profiles.set(key, normalized)
    await commitProfiles([normalized])
  })
}

export async function replaceProfiles(rows: UserProfile[]) {
  return runProfileMutation(async () => {
    profiles.clear()
    for (const profile of rows) {
      if (profile?.email) {
        profiles.set(profile.email, normalizeRestoredProfile(profile))
      }
    }
    await commitProfiles([...profiles.values()])
  })
}

function labelForAxis(key: string) {
  const map: Record<string, string> = {
    combate: 'Combate',
    social: 'Social',
    investigacao: 'Investigação',
    ocultismo: 'Ocultismo',
    estrategia: 'Estratégia',
    exploracao: 'Exploração',
    sobrevivencia: 'Sobrevivência',
    interpretacao: 'Interpretação',
  }
  return map[key] ?? key
}

export { labelForAxis }
