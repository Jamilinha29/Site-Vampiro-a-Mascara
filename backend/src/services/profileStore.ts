import { randomUUID } from 'crypto'
import { documentWeight, loadDocument, rememberDocument } from './campaignDocuments.js'
import { recordOperation } from './operationLog.js'
import { computeCharacterBalanceFromSheet } from './characterBalance.js'
import { readRules } from './rulesState.js'
import { scheduleProfileSqlMirror } from './profileSqlMirror.js'

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
  /** Cargas restantes (consumíveis). */
  charges?: number
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
  approval?: 'draft' | 'submitted' | 'changes' | 'approved'
  reviewNote?: string | null
  /** Classe escolhida na criação. Filtra as subclasses importadas. */
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

function snapshotProfiles() {
  rememberDocument('profiles', [...profiles.values()])
  scheduleProfileSqlMirror()
}

export async function hydrateProfiles() {
  const doc = await loadDocument<UserProfile[]>('profiles')
  if (!doc || documentWeight(doc.body) === 0) return
  profiles.clear()
  for (const profile of doc.body) {
    if (profile?.email) profiles.set(profile.email, profile)
  }
  scheduleProfileSqlMirror()
}

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

export function ensureProfile(
  email: string,
  displayName: string,
  role: UserProfile['role'] = 'player',
  options?: { authoritative?: boolean },
) {
  if (profiles.has(email)) {
    const p = profiles.get(email)!
    const previousName = p.displayName
    const previousRole = p.role
    p.preferences = { ...defaultPreferences(), ...p.preferences }
    p.displayName = displayName
    if (role === 'narrator' || role === 'admin' || options?.authoritative) {
      p.role = role
      if (role === 'narrator' || role === 'admin') {
        if (!p.badges.includes('Mestre da Mesa')) p.badges.push('Mestre da Mesa')
      }
    } else if (p.role !== 'narrator' && p.role !== 'admin') {
      p.role = role
    }
    if (previousName !== p.displayName || previousRole !== p.role) snapshotProfiles()
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
  snapshotProfiles()
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
  snapshotProfiles()
  return p
}

export function updateProfilePreferences(
  email: string,
  patch: Partial<UserProfile['preferences']>,
) {
  const p = profiles.get(email)
  if (!p) return null
  p.preferences = { ...p.preferences, ...patch }
  snapshotProfiles()
  return p
}

export function updateProfileDisplayName(email: string, displayName: string) {
  const p = profiles.get(email)
  if (!p) return null
  p.displayName = displayName.trim()
  snapshotProfiles()
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

  const nextInventory = rest.inventory ? mergeOwnedInventory(current.inventory ?? [], rest.inventory) : (current.inventory ?? [])
  p.characters[idx] = {
    ...current,
    ...rest,
    identity,
    inventory: nextInventory,
    createdSkills: guardApprovedSkills(current, rest.createdSkills),
    vitals: current.vitals,
    effects: effectsAfterUse(current, nextInventory),
    sheetRevision: (current.sheetRevision ?? 0) + 1,
  }
  snapshotProfiles()
  return p.characters[idx]
}

export function applyCharacterXp(
  email: string,
  characterId: string,
  amount: number,
  meta?: { actorEmail?: string; sessionId?: string },
) {
  const p = profiles.get(email)
  if (!p) return null
  const idx = p.characters.findIndex((c) => c.id === characterId)
  if (idx < 0) return null
  const ch = p.characters[idx]
  let level = ch.level
  const previousLevel = level
  let current = (ch.xp?.current ?? 0) + Math.floor(amount)
  let toNext = ch.xp?.toNext ?? xpRequiredToAdvance(level)

  const levelCap = Math.min(MAX_CHARACTER_LEVEL, readRules().maxLevel)
  while (level < levelCap && toNext > 0 && current >= toNext) {
    current -= toNext
    level += 1
    toNext = level >= levelCap ? 0 : xpRequiredToAdvance(level)
  }
  if (level >= levelCap) {
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
  snapshotProfiles()
  recordOperation({
    email,
    actorEmail: meta?.actorEmail?.trim() || email,
    kind: 'xp',
    summary: `XP ${amount >= 0 ? '+' : ''}${amount}`,
    before: String(previousLevel),
    after: String(level),
    sessionId: meta?.sessionId,
  })
  return p.characters[idx]
}

export function listProfiles() {
  return [...profiles.values()]
}

export function submitCharacter(email: string, characterId: string) {
  const p = profiles.get(email)
  const ch = p?.characters.find((item) => item.id === characterId)
  if (!p || !ch) return null
  ch.approval = 'submitted'
  ch.reviewNote = null
  snapshotProfiles()
  recordOperation({ email, actorEmail: email, kind: 'approval', summary: `Ficha enviada: ${ch.name}` })
  return ch
}

export function reviewCharacter(
  email: string,
  characterId: string,
  status: 'approved' | 'changes',
  note: string,
  actorEmail: string,
) {
  const p = profiles.get(email)
  const ch = p?.characters.find((item) => item.id === characterId)
  if (!p || !ch) return null
  ch.approval = status
  ch.reviewNote = note.trim() || null
  snapshotProfiles()
  recordOperation({
    email,
    actorEmail,
    kind: 'approval',
    summary: status === 'approved' ? `Ficha aprovada: ${ch.name}` : `Ajustes pedidos: ${ch.name}`,
    after: note.trim() || undefined,
  })
  return ch
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
    xp: character.xp ?? { current: readRules().startingXp ?? STARTING_CHARACTER_XP, toNext },
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
  snapshotProfiles()
  return row
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
      throw new Error('Habilidade aprovada não pode ser trocada. Peça revisão ao mestre.')
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
        durability: item.durability ?? previous.durability,
      },
    ]
  })
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

export function refreshEffects(email: string) {
  const profile = profiles.get(email)
  if (!profile) return
  let changed = false
  for (const character of profile.characters) {
    const next = liveEffects(character.effects)
    if (next.length !== (character.effects ?? []).length) {
      character.effects = next
      changed = true
    }
  }
  if (changed) snapshotProfiles()
}

export function advanceTurnEffects(targets: Array<{ email: string; characterId: string }>) {
  let changed = 0
  for (const target of targets) {
    const character = profiles.get(target.email)?.characters.find((item) => item.id === target.characterId)
    if (!character?.effects?.length) continue
    character.effects = character.effects.flatMap((effect) => {
      if (effect.pausedAt) return [effect]
      if (effect.remainingTurns == null) return [effect]
      changed += 1
      const remainingTurns = effect.remainingTurns - 1
      return remainingTurns > 0 ? [{ ...effect, remainingTurns }] : []
    })
  }
  if (changed > 0) snapshotProfiles()
  return changed
}

export function pauseEffectsForSeats(
  seats: Array<{ email: string; characterId: string; leftAt?: string | null }>,
) {
  const stamp = new Date().toISOString()
  let changed = 0
  for (const seat of seats) {
    if (seat.leftAt) continue
    const profile = profiles.get(seat.email)
    const character = profile?.characters.find((item) => item.id === seat.characterId)
    if (!character?.effects?.length) continue
    for (const effect of character.effects) {
      if (!effect.pausedAt) {
        effect.pausedAt = stamp
        changed += 1
      }
    }
  }
  if (changed > 0) snapshotProfiles()
  return changed
}

export function charactersOutsideRules(maxLevel: number, subclassLevel: number) {
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
    }
  }
  return rows
}

export function noteRuleChange(email: string, characterId: string, note: string) {
  const character = profiles.get(email)?.characters.find((item) => item.id === characterId)
  if (!character) return
  character.reviewNote = note
  if (character.approval === 'approved') character.approval = 'changes'
  snapshotProfiles()
}

export function replaceProfiles(rows: UserProfile[]) {
  profiles.clear()
  for (const profile of rows) {
    if (profile?.email) profiles.set(profile.email, profile)
  }
  snapshotProfiles()
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
