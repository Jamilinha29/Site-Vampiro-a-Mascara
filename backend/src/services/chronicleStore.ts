import { randomUUID } from 'crypto'
import { dbDeleteEntity, dbLoadEntities, dbLoadGrimoireSpells, dbUpsertEntity } from './entityDb.js'
import { readJsonFile, writeJsonFile } from './localJson.js'

export type EntityKind = 'npc' | 'monster' | 'equipment' | 'consumable' | 'archive' | 'download'

export type ArchiveCategory = 'chronicles' | 'relics' | 'rituals'
export type ShopCategory = 'gear' | 'consumables' | 'services'
export type DownloadCategory = 'rules' | 'sheets' | 'handouts'
export type BestiaryTier = 'known' | 'classified' | 'rumors'
export type MissionPriority = 'baixa' | 'media' | 'alta'

export type AttributeMod = { attr: string; value: number }

export type ChronicleEntity = {
  id: string
  kind: EntityKind
  name: string
  description: string
  visibility: 'draft' | 'published'
  archiveCategory?: ArchiveCategory
  shopCategory?: ShopCategory
  downloadCategory?: DownloadCategory
  bestiaryTier?: BestiaryTier
  classification?: 'grimoire' | 'amulet' | 'relic' | 'monster'
  creatureType?: string
  threatLevel?: 'inofensivo' | 'comum' | 'perigoso' | 'letal' | 'cataclismico'
  rarity?: 'comum' | 'incomum' | 'raro' | 'ancestral' | 'proibido'
  weightKg?: number
  imageUrl?: string
  hpMax?: number
  manaMax?: number
  attributeMods?: AttributeMod[]
  relicAmuletType?: string
  magicType?: string
  cooldownText?: string
  equipmentType?: string
  serviceType?: string
  consumableKind?: 'daily' | 'food'
  stockTotal?: number
  statsText?: string
  priceGold?: number
  priceSilver?: number
  priceCopper?: number
  fileName?: string
  fileUrl?: string
  /** Ficha tática (bestiário) */
  creatureSize?: string
  creatureSpeed?: string
  creatureSenses?: string
  defenseNote?: string
  primaryAttackName?: string
  primaryAttackDesc?: string
  secondaryAttackName?: string
  secondaryAttackDesc?: string
  sceneTrigger?: string
  narratorNotes?: string
  creatureStats?: { for: number; des: number; vig: number; int: number; sab: number; car: number }
  passiveTraits?: string[]
  createdAt: string
  updatedAt: string
}

export type HandoutReward = {
  type: 'equipment' | 'consumable' | 'currency' | 'xp'
  label: string
  entityId?: string
  gold?: number
  silver?: number
  xp?: number
}

export type SessionHandout = {
  id: string
  title: string
  status: 'pending_close' | 'closed'
  narrativeSummary: string
  scheduledSessionId?: string
  chronicleName?: string
  npcIds: string[]
  monstersSlain: Array<{ entityId: string; name: string; statsText?: string }>
  participants: Array<{
    displayName: string
    characterName: string
    rewards: HandoutReward[]
  }>
  missions: Array<{ title: string; priority: MissionPriority }>
  sceneThreats: SceneThreat[]
  sceneNpcs: SceneNpc[]
  chronicleAmbience: ChronicleAmbience
  restMode: boolean
  publishedToPlayers: boolean
  createdAt: string
  closedAt?: string
}

export type SceneThreat = {
  id: string
  entityId: string
  name: string
  hpCurrent: number
  hpMax: number
  manaCurrent: number
  manaMax: number
}

export type SceneNpc = {
  id: string
  entityId: string
  name: string
  description: string
}

export type ChronicleAmbience = {
  environment: string
  climate: string
  moon: string
  atmosphere: string
}

export const DEFAULT_CHRONICLE_AMBIENCE: ChronicleAmbience = {
  environment: 'Interior urbano',
  climate: 'Névoa espessa',
  moon: 'Lua minguante',
  atmosphere: 'Máscara rígida',
}

export type SessionPresence = {
  email: string
  displayName: string
  confirmedAt: string
}

export type SessionSeat = {
  email: string
  displayName: string
  characterId: string
  characterName: string
  joinedAt: string
  leftAt?: string
}

export type SessionTableMeta = {
  rpgTitle: string
  campaignName: string
  sessionLabel: string
  arcTitle: string
  missionTitle: string
  playerGroup: string
  targetDuration: string
  recommendedLevels: string
  sessionOrdinal?: number
}

export type ScheduledSession = {
  id: string
  title: string
  scheduledAt: string
  chronicleName?: string
  narratorEmail?: string
  tableMeta?: SessionTableMeta
  accessCode: string
  status: 'scheduled' | 'open' | 'closed'
  startedAt?: string
  endedAt?: string
  lastOpenedAt?: string
  activeDurationMs: number
  presence: SessionPresence[]
  seats: SessionSeat[]
  createdAt: string
}

const entities = new Map<string, ChronicleEntity>()

export function replaceAllEntities(rows: ChronicleEntity[]) {
  entities.clear()
  for (const row of rows) {
    entities.set(row.id, row)
  }
}

const ENTITY_FILE = 'chronicle-entities.json'

function writeEntityFile() {
  writeJsonFile(ENTITY_FILE, [...entities.values()])
}

function sameEntityText(left: string, right: string) {
  return left.trim().toLowerCase() === right.trim().toLowerCase()
}

/** Junta o que veio do banco sem apagar nem duplicar o que já está na memória. */
export async function refreshEntitiesFromDatabase() {
  const loaded = await dbLoadEntities()
  const spells = await dbLoadGrimoireSpells()
  const rows = [...(loaded ?? []), ...spells]
  if (!rows.length) return
  let added = 0
  for (const row of rows) {
    if (!row.name) continue
    const same = [...entities.values()].find(
      (item) => item.kind === row.kind && sameEntityText(item.name, row.name),
    )
    if (!same) {
      entities.set(row.id, row)
      added += 1
      continue
    }
    if (!sameEntityText(same.description, row.description) && row.description && !same.description) {
      entities.set(same.id, { ...same, description: row.description, updatedAt: row.updatedAt })
    }
  }
  if (added) writeEntityFile()
}

export async function hydrateEntitiesFromDatabase() {
  const rows = await dbLoadEntities()
  if (rows && rows.length > 0) {
    await refreshEntitiesFromDatabase()
    console.log(`[persistência] ${entities.size} entidade(s) após juntar o Supabase`)
    return
  }
  const local = readJsonFile<ChronicleEntity[]>(ENTITY_FILE)
  if (local?.length) {
    replaceAllEntities(local)
    console.log(`[persistência] ${local.length} entidade(s) da cópia local`)
    return
  }
  if (rows && rows.length === 0) {
    console.log('[persistência] Supabase conectado — tabela vazia, usando cadastros novos na API')
  }
}

function persistEntity(row: ChronicleEntity) {
  void dbUpsertEntity(row)
  writeEntityFile()
}
const handouts = new Map<string, SessionHandout>()
const scheduledSessions = new Map<string, ScheduledSession>()

function now() {
  return new Date().toISOString()
}

export function listEntities(filter?: { kind?: EntityKind; visibility?: ChronicleEntity['visibility'] }) {
  return [...entities.values()]
    .filter((e) => (filter?.kind ? e.kind === filter.kind : true))
    .filter((e) => (filter?.visibility ? e.visibility === filter.visibility : true))
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
}

export function getEntity(id: string) {
  return entities.get(id) ?? null
}

export function createEntity(
  input: Omit<ChronicleEntity, 'id' | 'createdAt' | 'updatedAt'> & {
    visibility?: ChronicleEntity['visibility']
    id?: string
  },
) {
  const { id: givenId, ...rest } = input
  const id = givenId ?? randomUUID()
  const row: ChronicleEntity = {
    ...rest,
    id,
    visibility: input.visibility ?? 'draft',
    createdAt: now(),
    updatedAt: now(),
  }
  entities.set(id, row)
  persistEntity(row)
  return row
}

export function updateEntity(id: string, patch: Partial<Omit<ChronicleEntity, 'id' | 'createdAt'>>) {
  const row = entities.get(id)
  if (!row) return null
  const next = { ...row, ...patch, updatedAt: now() }
  entities.set(id, next)
  persistEntity(next)
  return next
}

export function deleteEntity(id: string) {
  const ok = entities.delete(id)
  if (ok) {
    void dbDeleteEntity(id)
    writeEntityFile()
  }
  return ok
}

export function listPublishedForArchive(category: ArchiveCategory) {
  return listEntities().filter(
    (e) =>
      e.kind === 'archive' ||
      e.kind === 'equipment' ||
      e.kind === 'consumable' ||
      e.kind === 'monster',
  ).filter((e) => {
    if (e.kind === 'archive') return e.archiveCategory === category
    if (e.archiveCategory === category) return true
    return false
  })
}

export function listPublishedForShop(category: ShopCategory) {
  return listEntities().filter(
    (e) => (e.kind === 'equipment' || e.kind === 'consumable') && e.shopCategory === category,
  )
}

export function listPublishedForBestiary(tier: BestiaryTier) {
  return listEntities().filter(
    (e) => e.kind === 'monster' && (e.bestiaryTier ?? 'known') === tier,
  )
}

export function listPublishedDownloads(category: DownloadCategory) {
  const files = listEntities({ visibility: 'published' }).filter(
    (e) => e.kind === 'download' && e.downloadCategory === category,
  )
  if (category === 'handouts') {
    const sessionDocs = [...handouts.values()].filter((h) => h.publishedToPlayers && h.status === 'closed')
    return { files, handouts: sessionDocs }
  }
  return { files, handouts: [] as SessionHandout[] }
}

export function listHandouts(admin = false) {
  const rows = [...handouts.values()].sort((a, b) => b.createdAt.localeCompare(a.createdAt))
  if (admin) return rows
  return rows.filter((h) => h.publishedToPlayers)
}

export function getHandout(id: string) {
  return handouts.get(id) ?? null
}

export function createHandout(
  input: Omit<
    SessionHandout,
    'id' | 'status' | 'publishedToPlayers' | 'createdAt' | 'closedAt' | 'sceneThreats' | 'sceneNpcs' | 'chronicleAmbience' | 'restMode'
  > &
    Partial<Pick<SessionHandout, 'sceneThreats' | 'sceneNpcs' | 'chronicleAmbience' | 'restMode'>>,
) {
  const id = randomUUID()
  const row: SessionHandout = {
    sceneThreats: [],
    sceneNpcs: [],
    chronicleAmbience: { ...DEFAULT_CHRONICLE_AMBIENCE },
    restMode: false,
    ...input,
    id,
    status: 'pending_close',
    publishedToPlayers: false,
    createdAt: now(),
  }
  handouts.set(id, row)
  return row
}

export function getScheduledSession(id: string) {
  const row = scheduledSessions.get(id)
  return row ? ensureSessionDefaults(row) : null
}

function findHandoutByScheduledSession(sessionId: string) {
  return [...handouts.values()].find((h) => h.scheduledSessionId === sessionId) ?? null
}

function findLatestHandoutForChronicle(chronicleName: string, excludeHandoutId?: string) {
  const key = chronicleName.trim().toLowerCase()
  if (!key) return null
  return (
    [...handouts.values()]
      .filter((h) => h.id !== excludeHandoutId && (h.chronicleName?.trim().toLowerCase() ?? '') === key)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0] ?? null
  )
}

/** Continuidade: missões e participantes seguem da última mesa da mesma crônica. */
function continuityPayload(chronicleName: string, excludeHandoutId?: string) {
  const prev = findLatestHandoutForChronicle(chronicleName, excludeHandoutId)
  if (!prev) {
    return {
      participants: [] as SessionHandout['participants'],
      missions: [] as SessionHandout['missions'],
      monstersSlain: [] as SessionHandout['monstersSlain'],
    }
  }
  return {
    participants: prev.participants.map((p) => ({
      ...p,
      rewards: p.rewards.map((r) => ({ ...r })),
    })),
    missions: prev.missions.map((m) => ({ ...m })),
    monstersSlain: prev.monstersSlain.map((m) => ({ ...m })),
  }
}

/** Mescla novos eventos (ex.: bestiário) mantendo o que já estava registrado na mesa. */
export function syncHandoutSessionEvents(handoutId: string) {
  const row = handouts.get(handoutId)
  if (!row || !row.chronicleName) return row
  const base = continuityPayload(row.chronicleName, row.id)
  const mergeMonsters = [...row.monstersSlain]
  for (const m of base.monstersSlain) {
    if (!mergeMonsters.some((x) => x.entityId === m.entityId && x.name === m.name)) {
      mergeMonsters.push(m)
    }
  }
  const mergeMissions = [...row.missions]
  for (const m of base.missions) {
    if (!mergeMissions.some((x) => x.title === m.title)) mergeMissions.push(m)
  }
  return updateHandout(handoutId, {
    participants: row.participants.length ? row.participants : base.participants,
    missions: mergeMissions,
    monstersSlain: mergeMonsters,
  })
}

export function ensureHandoutForScheduledSession(sessionId: string) {
  const session = getScheduledSession(sessionId)
  if (!session) return null
  const existing = findHandoutByScheduledSession(sessionId)
  if (existing) {
    syncHandoutSessionEvents(existing.id)
    const row = handouts.get(existing.id)!
    if (!row.sceneThreats) updateHandout(row.id, { sceneThreats: [] })
    if (!row.sceneNpcs) updateHandout(row.id, { sceneNpcs: [] })
    if (!row.chronicleAmbience) updateHandout(row.id, { chronicleAmbience: { ...DEFAULT_CHRONICLE_AMBIENCE } })
    if (row.restMode == null) updateHandout(row.id, { restMode: false })
    return handouts.get(existing.id)!
  }
  const chronicleName = session.chronicleName?.trim() || session.title
  const seeded = continuityPayload(chronicleName)
  return createHandout({
    title: chronicleName,
    narrativeSummary: '',
    scheduledSessionId: sessionId,
    chronicleName,
    npcIds: [],
    monstersSlain: seeded.monstersSlain,
    participants: seeded.participants,
    missions: seeded.missions,
    sceneThreats: [],
    sceneNpcs: [],
    chronicleAmbience: { ...DEFAULT_CHRONICLE_AMBIENCE },
    restMode: false,
  })
}

export function patchMesaHandoutNarrative(sessionId: string, narrativeSummary: string) {
  const row = findHandoutByScheduledSession(sessionId)
  if (!row) return null
  return updateHandout(row.id, { narrativeSummary })
}

export function updateHandout(id: string, patch: Partial<SessionHandout>) {
  const row = handouts.get(id)
  if (!row) return null
  const next = { ...row, ...patch, ...(patch.status === 'closed' && !row.closedAt ? { closedAt: now() } : {}) }
  handouts.set(id, next)
  return next
}

function glossaryMirrorForNpcOrMonster(row: ChronicleEntity) {
  if (row.kind !== 'npc' && row.kind !== 'monster') return
  const archiveCategory: ArchiveCategory =
    row.archiveCategory ?? (row.kind === 'monster' ? 'relics' : 'chronicles')
  const classification = row.kind === 'monster' ? ('monster' as const) : undefined
  const twin = [...entities.values()].find(
    (e) => e.kind === 'archive' && e.name === row.name && e.archiveCategory === archiveCategory,
  )
  const patch = {
    description: row.description,
    statsText: row.statsText,
    imageUrl: row.imageUrl,
    creatureType: row.creatureType,
    threatLevel: row.threatLevel,
    hpMax: row.hpMax,
    manaMax: row.manaMax,
    classification,
    rarity: row.rarity,
    bestiaryTier: row.bestiaryTier,
    creatureSize: row.creatureSize,
    creatureSpeed: row.creatureSpeed,
    creatureSenses: row.creatureSenses,
    defenseNote: row.defenseNote,
    primaryAttackName: row.primaryAttackName,
    primaryAttackDesc: row.primaryAttackDesc,
    secondaryAttackName: row.secondaryAttackName,
    secondaryAttackDesc: row.secondaryAttackDesc,
    sceneTrigger: row.sceneTrigger,
    narratorNotes: row.narratorNotes,
    creatureStats: row.creatureStats,
    passiveTraits: row.passiveTraits,
    attributeMods: row.attributeMods,
    visibility: 'published' as const,
  }
  if (twin) {
    updateEntity(twin.id, patch)
    return
  }
  createEntity({
    kind: 'archive',
    name: row.name,
    archiveCategory,
    ...patch,
  })
}

/** Publica entidade; NPC/monstro ganham espelho `archive` no glossário do jogador. */
export function publishEntity(id: string) {
  const row = updateEntity(id, { visibility: 'published' })
  if (!row) return null
  if (row.kind === 'npc' || row.kind === 'monster') {
    glossaryMirrorForNpcOrMonster(row)
  }
  return row
}

function ensureSessionDefaults(row: ScheduledSession): ScheduledSession {
  const next: ScheduledSession = {
    ...row,
    accessCode: row.accessCode || generateAccessCode(),
    status: row.status ?? 'scheduled',
    activeDurationMs: row.activeDurationMs ?? 0,
    presence: row.presence ?? [],
    seats: row.seats ?? [],
  }
  if (!row.accessCode || !row.status || !row.presence || !row.seats) {
    scheduledSessions.set(row.id, next)
  }
  return next
}

export function listScheduledSessions() {
  return [...scheduledSessions.values()]
    .map(ensureSessionDefaults)
    .sort((a, b) => a.scheduledAt.localeCompare(b.scheduledAt))
}

export function findScheduledSessionByAccessCode(code: string) {
  const key = code.trim().toUpperCase()
  if (!key) return null
  return listScheduledSessions().find((s) => s.accessCode.toUpperCase() === key) ?? null
}

function generateAccessCode() {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  let code = ''
  for (let i = 0; i < 6; i += 1) code += alphabet[Math.floor(Math.random() * alphabet.length)]
  return code
}

function normalizeTableMeta(
  meta: SessionTableMeta | undefined,
  chronicleName?: string,
  title?: string,
): SessionTableMeta | undefined {
  if (!meta) return undefined
  const hasAny = Object.values(meta).some((v) => typeof v === 'string' && v.trim())
  if (!hasAny) return undefined
  const campaign = meta.campaignName?.trim() || meta.rpgTitle?.trim() || chronicleName?.trim() || ''
  const arc = meta.arcTitle?.trim() || meta.missionTitle?.trim() || ''
  return {
    rpgTitle: campaign,
    campaignName: campaign,
    sessionLabel: meta.sessionLabel?.trim() || title?.trim() || '',
    arcTitle: arc,
    missionTitle: arc,
    playerGroup: meta.playerGroup?.trim() ?? '',
    targetDuration: '',
    recommendedLevels: '',
    sessionOrdinal: meta.sessionOrdinal,
  }
}

export function createScheduledSession(input: {
  title: string
  scheduledAt: string
  chronicleName?: string
  narratorEmail?: string
  tableMeta?: SessionTableMeta
}) {
  const id = randomUUID()
  const chronicleName = input.chronicleName?.trim()
  const tableMeta = normalizeTableMeta(input.tableMeta, chronicleName, input.title)
  const displayTitle = tableMeta?.sessionLabel || input.title
  const row: ScheduledSession = {
    id,
    title: displayTitle,
    scheduledAt: input.scheduledAt,
    chronicleName: chronicleName || tableMeta?.campaignName,
    narratorEmail: input.narratorEmail,
    tableMeta,
    accessCode: generateAccessCode(),
    status: 'scheduled',
    activeDurationMs: 0,
    presence: [],
    seats: [],
    createdAt: now(),
  }
  scheduledSessions.set(id, row)
  ensureHandoutForScheduledSession(id)
  return row
}

export function updateScheduledSession(
  id: string,
  patch: Partial<Omit<ScheduledSession, 'id' | 'createdAt' | 'accessCode'>>,
) {
  const row = scheduledSessions.get(id)
  if (!row) return null
  let tableMeta = patch.tableMeta !== undefined ? patch.tableMeta : row.tableMeta
  if (tableMeta) {
    tableMeta = normalizeTableMeta(tableMeta, patch.chronicleName ?? row.chronicleName, patch.title ?? row.title) ?? tableMeta
  }
  const next = { ...row, ...patch, tableMeta }
  scheduledSessions.set(id, next)
  return next
}

export function deleteScheduledSession(sessionId: string, narratorEmail: string) {
  const session = getScheduledSession(sessionId)
  if (!session) return { ok: false as const, reason: 'not_found' as const }
  if (session.narratorEmail && session.narratorEmail !== narratorEmail) {
    return { ok: false as const, reason: 'forbidden' as const }
  }
  if (session.status === 'open') return { ok: false as const, reason: 'open' as const }
  const handout = findHandoutByScheduledSession(sessionId)
  if (handout) handouts.delete(handout.id)
  scheduledSessions.delete(sessionId)
  return { ok: true as const }
}

export function openScheduledSession(sessionId: string, narratorEmail: string) {
  const access = canManageMesa(sessionId, narratorEmail)
  if (!access.ok) return access
  const row = getScheduledSession(sessionId)
  if (!row) return { ok: false as const, reason: 'not_found' as const }
  if (row.status === 'open') return { ok: true as const, session: row }
  const stamp = now()
  const next = updateScheduledSession(sessionId, {
    status: 'open',
    startedAt: row.startedAt ?? stamp,
    lastOpenedAt: stamp,
    endedAt: undefined,
  })
  return { ok: true as const, session: next! }
}

export function closeScheduledSession(sessionId: string, narratorEmail: string) {
  const access = canManageMesa(sessionId, narratorEmail)
  if (!access.ok) return access
  const row = getScheduledSession(sessionId)
  if (!row) return { ok: false as const, reason: 'not_found' as const }
  const endedAt = now()
  let activeDurationMs = row.activeDurationMs ?? 0
  if (row.status === 'open') {
    const anchor = row.lastOpenedAt ?? row.startedAt
    if (anchor) activeDurationMs += Math.max(0, Date.now() - new Date(anchor).getTime())
  }
  const next = updateScheduledSession(sessionId, {
    status: 'closed',
    endedAt,
    activeDurationMs,
  })
  const handout = findHandoutByScheduledSession(sessionId)
  if (handout && handout.status !== 'closed') {
    updateHandout(handout.id, { status: 'closed', closedAt: endedAt })
  }
  return { ok: true as const, session: next! }
}

export function confirmSessionPresence(
  sessionId: string,
  user: { email: string; displayName: string },
) {
  const row = getScheduledSession(sessionId)
  if (!row) return null
  const presence = [...(row.presence ?? [])]
  const idx = presence.findIndex((p) => p.email === user.email)
  const entry = { email: user.email, displayName: user.displayName, confirmedAt: now() }
  if (idx >= 0) presence[idx] = entry
  else presence.push(entry)
  return updateScheduledSession(sessionId, { presence })
}

export function joinSessionWithCode(
  sessionId: string,
  accessCode: string,
  user: { email: string; displayName: string },
  character: { id: string; name: string },
) {
  const row = getScheduledSession(sessionId)
  if (!row) return { ok: false as const, reason: 'not_found' as const }
  if (row.accessCode.toUpperCase() !== accessCode.trim().toUpperCase()) {
    return { ok: false as const, reason: 'bad_code' as const }
  }
  if (row.status !== 'open') {
    return { ok: false as const, reason: 'not_open' as const }
  }
  const seats = [...(row.seats ?? [])].filter((s) => !(s.email === user.email && !s.leftAt))
  seats.push({
    email: user.email,
    displayName: user.displayName,
    characterId: character.id,
    characterName: character.name,
    joinedAt: now(),
  })
  const next = updateScheduledSession(sessionId, { seats })
  return { ok: true as const, session: next! }
}

export function leaveSessionSeat(sessionId: string, email: string) {
  const row = getScheduledSession(sessionId)
  if (!row) return null
  const seats = (row.seats ?? []).map((s) =>
    s.email === email && !s.leftAt ? { ...s, leftAt: now() } : s,
  )
  return updateScheduledSession(sessionId, { seats })
}

export function replaceSessionCharacter(
  sessionId: string,
  email: string,
  character: { id: string; name: string },
) {
  const row = getScheduledSession(sessionId)
  if (!row) return null
  const seats = (row.seats ?? []).map((s) =>
    s.email === email && !s.leftAt
      ? { ...s, characterId: character.id, characterName: character.name }
      : s,
  )
  return updateScheduledSession(sessionId, { seats })
}

function parseVitalsFromStats(statsText?: string) {
  let hpMax = 100
  let manaMax = 30
  if (statsText) {
    const hp = statsText.match(/(?:hp|vida)\s*[:=]\s*(\d+)/i)
    const mana = statsText.match(/(?:mana|sangue)\s*[:=]\s*(\d+)/i)
    if (hp) hpMax = Math.max(1, Number(hp[1]))
    if (mana) manaMax = Math.max(0, Number(mana[1]))
  }
  return { hpMax, manaMax }
}

function canManageMesa(sessionId: string, email: string) {
  const session = getScheduledSession(sessionId)
  if (!session) return { ok: false as const, reason: 'not_found' as const }
  if (session.narratorEmail && session.narratorEmail !== email) {
    return { ok: false as const, reason: 'forbidden' as const }
  }
  return { ok: true as const }
}

export function listSceneThreatsForSession(sessionId: string) {
  const handout = findHandoutByScheduledSession(sessionId)
  if (!handout) return null
  return handout.sceneThreats ?? []
}

export function addSceneThreat(sessionId: string, entityId: string, narratorEmail: string) {
  const access = canManageMesa(sessionId, narratorEmail)
  if (!access.ok) return access
  const handout = findHandoutByScheduledSession(sessionId)
  if (!handout) return { ok: false as const, reason: 'not_found' as const }
  const entity = getEntity(entityId)
  if (!entity || entity.kind !== 'monster') return { ok: false as const, reason: 'bad_entity' as const }
  const { hpMax, manaMax } = parseVitalsFromStats(entity.statsText)
  const threat: SceneThreat = {
    id: randomUUID(),
    entityId,
    name: entity.name,
    hpCurrent: hpMax,
    hpMax,
    manaCurrent: manaMax,
    manaMax,
  }
  const sceneThreats = [...(handout.sceneThreats ?? []), threat]
  const updated = updateHandout(handout.id, { sceneThreats })
  return { ok: true as const, handout: updated! }
}

export function applySceneThreatDelta(
  sessionId: string,
  threatId: string,
  narratorEmail: string,
  delta: { hpDelta?: number; manaDelta?: number },
) {
  const access = canManageMesa(sessionId, narratorEmail)
  if (!access.ok) return access
  const handout = findHandoutByScheduledSession(sessionId)
  if (!handout) return { ok: false as const, reason: 'not_found' as const }
  const threats = handout.sceneThreats ?? []
  const idx = threats.findIndex((t) => t.id === threatId)
  if (idx < 0) return { ok: false as const, reason: 'not_found' as const }
  const t = threats[idx]
  const next: SceneThreat = { ...t }
  if (delta.hpDelta != null) {
    next.hpCurrent = Math.max(0, Math.min(t.hpMax, t.hpCurrent + delta.hpDelta))
  }
  if (delta.manaDelta != null) {
    next.manaCurrent = Math.max(0, Math.min(t.manaMax, t.manaCurrent + delta.manaDelta))
  }
  const sceneThreats = [...threats]
  sceneThreats[idx] = next
  const updated = updateHandout(handout.id, { sceneThreats })
  return { ok: true as const, handout: updated! }
}

export function removeSceneThreat(sessionId: string, threatId: string, narratorEmail: string) {
  const access = canManageMesa(sessionId, narratorEmail)
  if (!access.ok) return access
  const handout = findHandoutByScheduledSession(sessionId)
  if (!handout) return { ok: false as const, reason: 'not_found' as const }
  const sceneThreats = (handout.sceneThreats ?? []).filter((t) => t.id !== threatId)
  const updated = updateHandout(handout.id, { sceneThreats })
  return { ok: true as const, handout: updated! }
}

export function addSceneNpc(sessionId: string, entityId: string, narratorEmail: string) {
  const access = canManageMesa(sessionId, narratorEmail)
  if (!access.ok) return access
  const handout = findHandoutByScheduledSession(sessionId)
  if (!handout) return { ok: false as const, reason: 'not_found' as const }
  const entity = getEntity(entityId)
  if (!entity || entity.kind !== 'npc') return { ok: false as const, reason: 'bad_entity' as const }
  const npc: SceneNpc = {
    id: randomUUID(),
    entityId,
    name: entity.name,
    description: entity.description,
  }
  const sceneNpcs = [...(handout.sceneNpcs ?? []), npc]
  const updated = updateHandout(handout.id, { sceneNpcs })
  return { ok: true as const, handout: updated! }
}

export function removeSceneNpc(sessionId: string, npcId: string, narratorEmail: string) {
  const access = canManageMesa(sessionId, narratorEmail)
  if (!access.ok) return access
  const handout = findHandoutByScheduledSession(sessionId)
  if (!handout) return { ok: false as const, reason: 'not_found' as const }
  const sceneNpcs = (handout.sceneNpcs ?? []).filter((n) => n.id !== npcId)
  const updated = updateHandout(handout.id, { sceneNpcs })
  return { ok: true as const, handout: updated! }
}

export function patchMesaAmbience(sessionId: string, patch: Partial<ChronicleAmbience>, narratorEmail: string) {
  const access = canManageMesa(sessionId, narratorEmail)
  if (!access.ok) return access
  const handout = findHandoutByScheduledSession(sessionId)
  if (!handout) return { ok: false as const, reason: 'not_found' as const }
  const chronicleAmbience = { ...(handout.chronicleAmbience ?? DEFAULT_CHRONICLE_AMBIENCE), ...patch }
  const updated = updateHandout(handout.id, { chronicleAmbience })
  return { ok: true as const, handout: updated! }
}

export function setMesaRestMode(sessionId: string, restMode: boolean, narratorEmail: string) {
  const access = canManageMesa(sessionId, narratorEmail)
  if (!access.ok) return access
  const handout = findHandoutByScheduledSession(sessionId)
  if (!handout) return { ok: false as const, reason: 'not_found' as const }
  const updated = updateHandout(handout.id, { restMode })
  return { ok: true as const, handout: updated! }
}

export type SessionLiveBrief = {
  narrativeSummary: string
  restMode: boolean
  chronicleAmbience: ChronicleAmbience
  sceneNpcs: Array<{ id: string; name: string; description: string }>
}

export function getSessionLiveBrief(sessionId: string): SessionLiveBrief | null {
  const handout = findHandoutByScheduledSession(sessionId)
  if (!handout) return null
  return {
    narrativeSummary: handout.narrativeSummary,
    restMode: handout.restMode ?? false,
    chronicleAmbience: handout.chronicleAmbience ?? DEFAULT_CHRONICLE_AMBIENCE,
    sceneNpcs: (handout.sceneNpcs ?? []).map((n) => ({
      id: n.id,
      name: n.name,
      description: n.description,
    })),
  }
}

export function getSessionBagForPlayer(sessionId: string, displayName: string) {
  const handout = findHandoutByScheduledSession(sessionId)
  if (!handout) return null
  const key = displayName.trim().toLowerCase()
  const participant = handout.participants.find((p) => p.displayName.trim().toLowerCase() === key)
  return { rewards: participant?.rewards ?? [] }
}

/** Últimas 8 semanas: sessões agendadas + handouts encerrados por semana (dados reais). */
export function sessionActivityLineSeries() {
  const weeks: { label: string; count: number }[] = []
  const nowDate = new Date()
  for (let i = 7; i >= 0; i--) {
    const start = new Date(nowDate)
    start.setDate(start.getDate() - i * 7)
    start.setHours(0, 0, 0, 0)
    const end = new Date(start)
    end.setDate(end.getDate() + 7)
    const label = start.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })
    const scheduled = listScheduledSessions().filter((s) => {
      const d = new Date(s.scheduledAt)
      return d >= start && d < end
    }).length
    const closed = listHandouts(true).filter((h) => {
      const d = new Date(h.closedAt ?? h.createdAt)
      return h.status === 'closed' && d >= start && d < end
    }).length
    weeks.push({ label, count: scheduled + closed })
  }
  return weeks
}

function handoutActiveHours(h: SessionHandout, until = Date.now()) {
  const start = new Date(h.createdAt).getTime()
  const end = h.closedAt ? new Date(h.closedAt).getTime() : until
  if (end <= start) return 0
  return Math.round(((end - start) / 3_600_000) * 10) / 10
}

function inRange(iso: string, start: Date, end: Date) {
  const t = new Date(iso).getTime()
  return t >= start.getTime() && t < end.getTime()
}

export function adminMesaActivityStats() {
  const now = new Date()
  const dayStart = new Date(now)
  dayStart.setHours(0, 0, 0, 0)
  const dayEnd = new Date(dayStart)
  dayEnd.setDate(dayEnd.getDate() + 1)

  const weekStart = new Date(dayStart)
  weekStart.setDate(weekStart.getDate() - ((weekStart.getDay() + 6) % 7))
  const weekEnd = new Date(weekStart)
  weekEnd.setDate(weekEnd.getDate() + 7)

  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)
  const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 1)

  const handouts = listHandouts(true)
  const scheduled = listScheduledSessions()

  function bucket(start: Date, end: Date) {
    const touched = handouts.filter((h) => {
      const anchor = h.closedAt ?? h.createdAt
      return inRange(anchor, start, end) || (h.status === 'pending_close' && inRange(h.createdAt, start, end))
    })
    const hours = touched.reduce((sum, h) => sum + handoutActiveHours(h), 0)
    const sessionsMarked = scheduled.filter((s) => inRange(s.scheduledAt, start, end)).length
    const actsClosed = handouts.filter(
      (h) => h.status === 'closed' && h.closedAt && inRange(h.closedAt, start, end),
    ).length
    return {
      hoursActive: Math.round(hours * 10) / 10,
      sessionsMarked,
      actsClosed,
    }
  }

  return {
    openMesas: handouts.filter((h) => h.status === 'pending_close').length,
    day: bucket(dayStart, dayEnd),
    week: bucket(weekStart, weekEnd),
    month: bucket(monthStart, monthEnd),
  }
}

export type PlayerSessionActSummary = {
  sessionId: string
  chronicleName: string
  narrativeSummary: string
  closedAt?: string
  published: boolean
}

export type PlayerSessionActCanon = PlayerSessionActSummary & {
  missions: SessionHandout['missions']
  monstersSlain: SessionHandout['monstersSlain']
  participants: Array<{ displayName: string; characterName: string }>
}

function playerVisibleHandout(sessionId: string) {
  const handout = findHandoutByScheduledSession(sessionId)
  if (!handout || handout.status !== 'closed' || !handout.publishedToPlayers) return null
  return handout
}

export function getPlayerSessionActSummary(sessionId: string): PlayerSessionActSummary | null {
  const handout = playerVisibleHandout(sessionId)
  if (!handout) return null
  return {
    sessionId,
    chronicleName: handout.chronicleName ?? handout.title,
    narrativeSummary: handout.narrativeSummary,
    closedAt: handout.closedAt,
    published: true,
  }
}

export function getPlayerSessionActCanon(sessionId: string): PlayerSessionActCanon | null {
  const handout = playerVisibleHandout(sessionId)
  if (!handout) return null
  return {
    sessionId,
    chronicleName: handout.chronicleName ?? handout.title,
    narrativeSummary: handout.narrativeSummary,
    closedAt: handout.closedAt,
    published: true,
    missions: handout.missions,
    monstersSlain: handout.monstersSlain,
    participants: handout.participants.map((p) => ({
      displayName: p.displayName,
      characterName: p.characterName,
    })),
  }
}

export function listPublishedSessionsForPlayers() {
  return listScheduledSessions()
}
