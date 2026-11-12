import { randomUUID } from 'crypto'
import { computeCharacterBalanceFromSheet } from './characterBalance.js'

export const MAX_CHARACTER_LEVEL = 20
export const SUBCLASS_CHOICE_LEVEL = 7
/** XP atual ao criar (barra começa em 0 / toNext). */
export const STARTING_CHARACTER_XP = 0
export const VITALS_PER_LEVEL = 5

/** XP para sair do nível L (1→2 = 50, 2→3 = 150, …). */
export function xpRequiredToAdvance(level: number): number {
  if (level < 1 || level >= MAX_CHARACTER_LEVEL) return 0
  return (50 * level * (level + 1)) / 2
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
}

export type CharacterIdentity = {
  faith?: string | null
  house?: string | null
  nature?: string | null
  demeanor?: string | null
  concept?: string | null
  residence?: string | null
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
  /** Destaque na tela Início (máx. 3 quando há mais de 10 personagens). */
  showOnHome?: boolean
  portraitUrl?: string | null
  hp: { current: number; max: number }
  blood?: { current: number; max: number }
  mana?: { current: number; max: number }
  will?: { current: number; max: number }
  xp: { current: number; toNext: number }
  subclass?: string | null
  /** Classe escolhida na criação. Filtra as subclasses importadas. */
  characterClass?: string | null
  identity: CharacterIdentity
  inventory: CharacterInventoryItem[]
  createdSkills: CreatedSkill[]
  carryCapacityKg: number
  balanceStats?: Record<string, number> | null
  vitals?: CharacterVitalsMeta | null
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

const profiles = new Map<string, UserProfile>()

function handleFromEmail(email: string) {
  return `@${email.split('@')[0]?.replace(/\W/g, '_') ?? 'cainita'}`
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

export function ensureProfile(email: string, displayName: string, role: UserProfile['role'] = 'player') {
  if (profiles.has(email)) {
    const p = profiles.get(email)!
    p.preferences = { ...defaultPreferences(), ...p.preferences }
    p.displayName = displayName
    if (role === 'narrator' || role === 'admin') {
      p.role = role
    } else if (p.role !== 'narrator' && p.role !== 'admin') {
      p.role = role
    }
    return p
  }
  const profile: UserProfile = {
    userId: email,
    email,
    displayName,
    handle: handleFromEmail(email),
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
  return profile
}

function syncDerivedMetrics(profile: UserProfile) {
  const count = profile.characters.length
  profile.accountMetrics.characters = count > 0 ? count : null
  profile.lineageStats.charactersCreated = count > 0 ? count : null
  if (count === 0) {
    profile.accountMetrics.totalXp = null
    profile.lineageStats.xpAccumulated = null
    profile.lineageStats.favoriteClass = null
  }
}

export function getProfile(email: string) {
  return profiles.get(email) ?? null
}

/** Fatias para gráfico admin: personagens criados por conta de jogador (role player). */
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

/** Contas inscritas como jogador (role player). */
export function listRegisteredPlayers() {
  return [...profiles.values()]
    .filter((p) => p.role === 'player')
    .map((p) => ({
      email: p.email,
      displayName: p.displayName,
      handle: p.handle,
      memberSince: p.memberSince,
      characters: p.characters.length,
    }))
    .sort((a, b) => a.displayName.localeCompare(b.displayName))
}

export function updateProfileMedia(
  email: string,
  patch: { avatarUrl?: string | null; bannerUrl?: string | null },
) {
  const p = profiles.get(email)
  if (!p) return null
  if (patch.avatarUrl !== undefined) p.avatarUrl = patch.avatarUrl
  if (patch.bannerUrl !== undefined) p.bannerUrl = patch.bannerUrl
  return p
}

export function updateProfilePreferences(
  email: string,
  patch: Partial<UserProfile['preferences']>,
) {
  const p = profiles.get(email)
  if (!p) return null
  p.preferences = { ...p.preferences, ...patch }
  return p
}

export function updateProfileDisplayName(email: string, displayName: string) {
  const p = profiles.get(email)
  if (!p) return null
  p.displayName = displayName.trim()
  return p
}

export function listCharacters(email: string) {
  return profiles.get(email)?.characters ?? []
}

export function getCharacter(email: string, characterId: string) {
  return listCharacters(email).find((c) => c.id === characterId) ?? null
}

export function patchCharacter(
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
    identityPatch?: Partial<Pick<CharacterIdentity, 'house' | 'nature' | 'demeanor' | 'concept' | 'residence'>>
  },
) {
  const p = profiles.get(email)
  if (!p) return null
  const idx = p.characters.findIndex((c) => c.id === characterId)
  if (idx < 0) return null
  const current = p.characters[idx]
  const identity = { ...defaultIdentity(), ...current.identity }
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
  }

  if (patch.isPrimary === true) {
    p.characters = p.characters.map((c) => ({ ...c, isPrimary: c.id === characterId }))
  }

  if (patch.showOnHome === true && p.characters.length > 10) {
    const already = p.characters.filter((c) => c.showOnHome && c.id !== characterId).length
    if (already >= 3) return null
  }

  const { faith: _f, identityPatch: _i, ...rest } = patch

  // Após criação: max de HP/Mana não muda aqui (sobe só por nível); current pode mudar (dano, mana, poções).
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
  }

  p.characters[idx] = {
    ...current,
    ...rest,
    identity,
    inventory: rest.inventory ?? current.inventory ?? [],
    createdSkills: rest.createdSkills ?? current.createdSkills ?? [],
    vitals: current.vitals,
  }
  return p.characters[idx]
}

export function applyCharacterXp(email: string, characterId: string, amount: number) {
  const p = profiles.get(email)
  if (!p) return null
  const idx = p.characters.findIndex((c) => c.id === characterId)
  if (idx < 0) return null
  const ch = p.characters[idx]
  let level = ch.level
  const previousLevel = level
  let current = (ch.xp?.current ?? 0) + Math.floor(amount)
  let toNext = ch.xp?.toNext ?? xpRequiredToAdvance(level)

  while (level < MAX_CHARACTER_LEVEL && toNext > 0 && current >= toNext) {
    current -= toNext
    level += 1
    toNext = level >= MAX_CHARACTER_LEVEL ? 0 : xpRequiredToAdvance(level)
  }
  if (level >= MAX_CHARACTER_LEVEL) {
    current = 0
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

  p.characters[idx] = {
    ...ch,
    level,
    xp: { current, toNext },
    hp,
    mana,
  }
  syncDerivedMetrics(p)
  return p.characters[idx]
}

/** Localiza personagem em qualquer perfil (ADM concede XP na mesa). */
export function findCharacterOwnerBySeat(characterId: string, emailHint?: string) {
  if (emailHint) {
    const p = profiles.get(emailHint)
    const ch = p?.characters.find((c) => c.id === characterId)
    if (p && ch) return { email: emailHint, character: ch }
  }
  for (const [email, p] of profiles.entries()) {
    const ch = p.characters.find((c) => c.id === characterId)
    if (ch) return { email, character: ch }
  }
  return null
}

export function upsertCharacter(
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
  const p = ensureProfile(email, pDisplayName(email), 'player')
  const id = character.id ?? randomUUID()
  const idx = p.characters.findIndex((c) => c.id === id)
  const level = Math.min(MAX_CHARACTER_LEVEL, Math.max(1, character.level || 1))
  const toNext = xpRequiredToAdvance(level)
  const row: ProfileCharacter = {
    id,
    name: character.name,
    species: character.species,
    clan: character.clan,
    level,
    isPrimary: character.isPrimary,
    portraitUrl: character.portraitUrl ?? null,
    hp: character.hp,
    blood: character.blood,
    mana: character.mana,
    will: character.will,
    xp: character.xp ?? { current: STARTING_CHARACTER_XP, toNext },
    subclass: character.subclass ?? null,
    characterClass: character.characterClass ?? null,
    identity: character.identity ?? defaultIdentity(),
    inventory: character.inventory ?? [],
    createdSkills: character.createdSkills ?? [],
    carryCapacityKg: character.carryCapacityKg ?? 28,
    balanceStats: character.balanceStats ?? null,
    vitals: character.vitals ?? null,
  }
  if (idx >= 0) p.characters[idx] = row
  else p.characters.push(row)
  syncDerivedMetrics(p)
  return row
}

function pDisplayName(email: string) {
  return profiles.get(email)?.displayName ?? email.split('@')[0] ?? 'Cainita'
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
