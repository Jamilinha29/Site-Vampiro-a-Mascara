import { randomInt, randomUUID } from 'node:crypto'
import { dbDeleteEntity, dbLoadEntities, dbLoadGrimoireSpells, dbUpsertEntity } from './entityDb.js'
import {
  checkRemoteDocumentRevision,
  commitDocument,
  documentWeight,
  getLoadedDocumentRevision,
  loadDocument,
  runExclusive,
} from './campaignDocuments.js'
import { getProfile, pauseEffectsForSeats } from './profileStore.js'
import { readJsonFile, writeJsonFile } from './localJson.js'
import { ForbiddenError, NotFoundError } from './errors.js'
import { getSupabaseAdmin } from './supabaseClient.js'

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
  clan?: string
  bestiaryTier?: BestiaryTier
  classification?: 'grimoire' | 'amulet' | 'relic' | 'monster'
  creatureType?: string
  threatLevel?: 'inofensivo' | 'comum' | 'perigoso' | 'letal' | 'cataclismico'
  rarity?: 'comum' | 'incomum' | 'raro' | 'ancestral' | 'proibido'
  weightKg?: number
  imageUrl?: string
  hpMax?: number
  manaMax?: number
  defense?: number
  abilities?: string[]
  lifeStatus?: 'alive' | 'dead'
  location?: string
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
  chronicleScope?: string | null
  narratorScope?: string | null
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
  narratorWhisper?: string
  scheduledSessionId?: string
  chronicleName?: string
  narratorEmail?: string
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
  round?: number
  activeTurnIndex?: number
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
  allowCoNarrator?: boolean
  coNarratorEmails?: string[]
  tableMeta?: SessionTableMeta
  accessCode: string
  accessCodeRotatedAt?: string
  listing?: 'public' | 'private'
  status: 'scheduled' | 'open' | 'closed'
  startedAt?: string
  endedAt?: string
  lastOpenedAt?: string
  activeDurationMs: number
  presence: SessionPresence[]
  seats: SessionSeat[]
  createdAt: string
}

export type SessionActionEntry = {
  id: string
  sessionId: string
  actorEmail: string
  characterId?: string
  characterName: string
  kind: 'declaration' | 'skill' | 'damage' | 'potion' | 'turn_end' | 'round_end' | 'system'
  summary: string
  detail: string
  createdAt: string
}

/** Projeção pública segura: sem accessCode e sem e-mails internos (C01). */
export type PublicSessionDTO = {
  id: string
  title: string
  scheduledAt: string
  chronicleName?: string
  tableMeta?: SessionTableMeta
  listing: 'public' | 'private'
  status: 'scheduled' | 'open' | 'closed'
  startedAt?: string
  endedAt?: string
  activeDurationMs: number
  narratorName: string
  seatedCount: number
  presenceCount: number
  createdAt: string
}

/** Projeção para jogador participante: sem accessCode nem e-mails de terceiros (C01). */
export type ParticipantSessionDTO = PublicSessionDTO & {
  mySeat: { characterId: string; characterName: string; joinedAt: string } | null
  hasConfirmedPresence: boolean
  scheduledTimeReached: boolean
  canEnterLive: boolean
  seats: Array<{
    displayName: string
    characterId: string
    characterName: string
    joinedAt: string
    isMe: boolean
  }>
  presence: Array<{
    displayName: string
    confirmedAt: string
    isMe: boolean
  }>
}

/** Projeção completa para o narrador responsável pela mesa ou admin (C01). */
export type NarratorSessionDTO = ScheduledSession

const SESSIONS_DOC = 'sessions'
const ACTIONS_DOC = 'session-actions'
const ENTITY_FILE = 'chronicle-entities.json'
const ENTITIES_REFRESH_TTL_MS = 60_000
const SCHEMA_RETRY_COOLDOWN_MS = 10 * 60_000

const entities = new Map<string, ChronicleEntity>()
const handouts = new Map<string, SessionHandout>()
const scheduledSessions = new Map<string, ScheduledSession>()
const sessionActions: SessionActionEntry[] = []
let lastEntitiesRefreshAt = 0
let entitiesRefreshInFlight: Promise<void> | null = null
let acoesTableUnavailableUntil = 0

function clone<T>(v: T): T {
  return JSON.parse(JSON.stringify(v)) as T
}

function now() {
  return new Date().toISOString()
}

function sameEmail(a?: string, b?: string) {
  return (a ?? '').trim().toLowerCase() === (b ?? '').trim().toLowerCase()
}

function sameEntityText(left: string, right: string) {
  return left.trim().toLowerCase() === right.trim().toLowerCase()
}

function writeEntityFile() {
  writeJsonFile(ENTITY_FILE, [...entities.values()])
}

export function replaceAllEntities(rows: ChronicleEntity[]) {
  entities.clear()
  for (const row of rows) {
    entities.set(row.id, row)
  }
}

export function resetSessionsForTests() {
  handouts.clear()
  scheduledSessions.clear()
  sessionActions.length = 0
}

export function resetEntitiesForTests() {
  entities.clear()
  lastEntitiesRefreshAt = 0
  entitiesRefreshInFlight = null
}

export function toPublicSessionDTO(row: ScheduledSession): PublicSessionDTO {
  const s = ensureSessionDefaults(row)
  const narrator = s.narratorEmail ? getProfile(s.narratorEmail) : null
  const activeSeats = (s.seats ?? []).filter((seat) => !seat.leftAt)
  return {
    id: s.id,
    title: s.title,
    scheduledAt: s.scheduledAt,
    chronicleName: s.chronicleName,
    tableMeta: s.tableMeta,
    listing: s.listing ?? 'private',
    status: s.status,
    startedAt: s.startedAt,
    endedAt: s.endedAt,
    activeDurationMs: s.activeDurationMs ?? 0,
    narratorName: narrator?.displayName ?? 'Narrador',
    seatedCount: activeSeats.length,
    presenceCount: (s.presence ?? []).length,
    createdAt: s.createdAt,
  }
}

export type PlayerLiveAccessResult =
  | { allowed: true }
  | { allowed: false; reason: 'closed' | 'not_open' | 'presence_required' | 'before_schedule' }

export function isScheduledTimeReached(
  session: Pick<ScheduledSession, 'scheduledAt'>,
  nowMs = Date.now(),
): boolean {
  const raw = session.scheduledAt?.trim()
  if (!raw) return true
  const ts = Date.parse(raw)
  if (Number.isNaN(ts)) return true
  return nowMs >= ts
}

export function hasConfirmedSessionPresence(
  session: Pick<ScheduledSession, 'presence'>,
  email?: string,
): boolean {
  if (!email) return false
  return (session.presence ?? []).some((p) => sameEmail(p.email, email))
}

export function evaluatePlayerLiveAccess(
  session: ScheduledSession,
  email?: string,
  nowMs = Date.now(),
): PlayerLiveAccessResult {
  if (session.status === 'closed') return { allowed: false, reason: 'closed' }
  if (!hasConfirmedSessionPresence(session, email)) return { allowed: false, reason: 'presence_required' }
  if (!isScheduledTimeReached(session, nowMs)) return { allowed: false, reason: 'before_schedule' }
  if (session.status !== 'open') return { allowed: false, reason: 'not_open' }
  return { allowed: true }
}

export function toParticipantSessionDTO(row: ScheduledSession, viewerEmail?: string): ParticipantSessionDTO {
  const s = ensureSessionDefaults(row)
  const base = toPublicSessionDTO(s)
  const viewer = viewerEmail?.trim().toLowerCase() ?? ''
  const activeSeats = (s.seats ?? []).filter((seat) => !seat.leftAt)
  const myActiveSeat = viewer ? activeSeats.find((seat) => sameEmail(seat.email, viewer)) ?? null : null
  const hasConfirmedPresence = hasConfirmedSessionPresence(s, viewer)
  const scheduledTimeReached = isScheduledTimeReached(s)
  const canEnterLive = evaluatePlayerLiveAccess(s, viewer).allowed
  return {
    ...base,
    mySeat: myActiveSeat
      ? {
          characterId: myActiveSeat.characterId,
          characterName: myActiveSeat.characterName,
          joinedAt: myActiveSeat.joinedAt,
        }
      : null,
    hasConfirmedPresence,
    scheduledTimeReached,
    canEnterLive,
    seats: activeSeats.map((seat) => ({
      displayName: seat.displayName,
      characterId: seat.characterId,
      characterName: seat.characterName,
      joinedAt: seat.joinedAt,
      isMe: Boolean(viewer && sameEmail(seat.email, viewer)),
    })),
    presence: (s.presence ?? []).map((p) => ({
      displayName: p.displayName,
      confirmedAt: p.confirmedAt,
      isMe: Boolean(viewer && sameEmail(p.email, viewer)),
    })),
  }
}

export function toNarratorSessionDTO(row: ScheduledSession): NarratorSessionDTO {
  return clone(ensureSessionDefaults(row))
}

function mergeLoadedEntities(loaded: ChronicleEntity[], spells: ChronicleEntity[]) {
  const rows = [...loaded, ...spells]
  lastEntitiesRefreshAt = Date.now()
  if (!rows.length) return
  let changed = false
  for (const row of rows) {
    if (!row.name || !row.id) continue
    const byId = entities.get(row.id)
    if (byId) {
      if (row.updatedAt >= byId.updatedAt) {
        entities.set(byId.id, { ...byId, ...row, id: byId.id })
        changed = true
      }
      continue
    }
    const same = [...entities.values()].find(
      (item) => item.kind === row.kind && sameEntityText(item.name, row.name),
    )
    if (!same) {
      entities.set(row.id, row)
      changed = true
      continue
    }
    if (row.updatedAt >= same.updatedAt) {
      entities.set(same.id, {
        ...same,
        description: row.description || same.description,
        visibility: row.visibility,
        updatedAt: row.updatedAt,
      })
      changed = true
    }
  }
  if (changed) writeEntityFile()
}

/** Junta o que o banco confirmou. Consulta falha ou tabela vazia não apaga o que já está na memória. */
export async function refreshEntitiesFromDatabase(force = false) {
  if (!force && Date.now() - lastEntitiesRefreshAt < ENTITIES_REFRESH_TTL_MS) return
  if (entitiesRefreshInFlight) return entitiesRefreshInFlight
  entitiesRefreshInFlight = (async () => {
    const loaded = await dbLoadEntities()
    if (loaded === null) return
    const spells = await dbLoadGrimoireSpells()
    mergeLoadedEntities(loaded, spells)
  })().finally(() => {
    entitiesRefreshInFlight = null
  })
  return entitiesRefreshInFlight
}

export async function hydrateEntitiesFromDatabase() {
  const rows = await dbLoadEntities()
  if (rows && rows.length > 0) {
    const spells = await dbLoadGrimoireSpells()
    mergeLoadedEntities(rows, spells)
    console.log(`[persistência] ${entities.size} entidade(s) após juntar o Supabase`)
    return
  }
  lastEntitiesRefreshAt = Date.now()
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

async function commitEntity(row: ChronicleEntity) {
  await dbUpsertEntity(row)
  entities.set(row.id, row)
  lastEntitiesRefreshAt = Date.now()
  writeEntityFile()
}

async function commitSessions(): Promise<void> {
  await commitDocument(SESSIONS_DOC, {
    sessions: [...scheduledSessions.values()],
    handouts: [...handouts.values()],
  })
}

async function runSessionMutation<T>(fn: () => Promise<T> | T): Promise<T> {
  return runExclusive('store:sessions', async () => {
    await syncSessionsIfStale()
    const prevSessions = clone([...scheduledSessions.entries()])
    const prevHandouts = clone([...handouts.entries()])
    try {
      return await fn()
    } catch (err) {
      scheduledSessions.clear()
      for (const [k, v] of prevSessions) scheduledSessions.set(k, v)
      handouts.clear()
      for (const [k, v] of prevHandouts) handouts.set(k, v)
      throw err
    }
  })
}

export async function syncSessionsIfStale() {
  const remoteRev = await checkRemoteDocumentRevision(SESSIONS_DOC)
  if (remoteRev > getLoadedDocumentRevision(SESSIONS_DOC)) {
    await hydrateSessions()
  }
}

export async function hydrateSessions() {
  const [doc, actionsDoc] = await Promise.all([
    loadDocument<{ sessions: ScheduledSession[]; handouts: SessionHandout[] }>(SESSIONS_DOC),
    loadDocument<SessionActionEntry[]>(ACTIONS_DOC),
  ])
  if (doc && documentWeight(doc.body) > 0) {
    if (doc.body.sessions?.length || doc.body.handouts?.length) {
      scheduledSessions.clear()
      handouts.clear()
      for (const session of doc.body.sessions ?? []) scheduledSessions.set(session.id, session)
      for (const handout of doc.body.handouts ?? []) handouts.set(handout.id, handout)
    }
  }
  if (actionsDoc && documentWeight(actionsDoc.body) > 0) {
    sessionActions.splice(0, sessionActions.length, ...actionsDoc.body.slice(-600))
  }
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

export async function createEntity(
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
  await commitEntity(row)
  return row
}

export async function updateEntity(id: string, patch: Partial<Omit<ChronicleEntity, 'id' | 'createdAt'>>) {
  const row = entities.get(id)
  if (!row) return null
  const next = { ...row, ...patch, updatedAt: now() }
  await commitEntity(next)
  if ((next.kind === 'npc' || next.kind === 'monster') && next.visibility === 'published') {
    await glossaryMirrorForNpcOrMonster(next)
  }
  return next
}

export async function deleteEntity(id: string) {
  if (!entities.has(id)) return false
  await dbDeleteEntity(id)
  entities.delete(id)
  lastEntitiesRefreshAt = Date.now()
  writeEntityFile()
  return true
}

export type CatalogScopeContext = {
  chronicleName?: string
  narratorEmail?: string
}

function forPlayers(rows: ChronicleEntity[]) {
  return rows
    .filter((e) => e.visibility === 'published')
    .map(({ narratorNotes: _notes, sceneTrigger: _trigger, ...rest }) => rest)
}

export function entityMatchesCatalogScope(entity: ChronicleEntity, contexts: CatalogScopeContext[]) {
  const chronicle = entity.chronicleScope?.trim()
  const narrator = entity.narratorScope?.trim().toLowerCase()
  if (!chronicle && !narrator) return true
  if (!contexts.length) return false
  return contexts.some((ctx) => {
    const chronicleOk = !chronicle || (ctx.chronicleName?.trim() && chronicle === ctx.chronicleName.trim())
    const narratorOk =
      !narrator || (ctx.narratorEmail?.trim() && narrator === ctx.narratorEmail.trim().toLowerCase())
    return Boolean(chronicleOk && narratorOk)
  })
}

export function resolveCatalogScopeForViewer(
  email?: string,
  sessionId?: string,
  role?: string,
): CatalogScopeContext[] {
  if (sessionId) {
    const session = getScheduledSession(sessionId)
    if (!session) return []
    if (email) {
      const access = sessionAccess(sessionId, { email, role })
      if (!access.ok) return []
    }
    return [
      {
        chronicleName: session.chronicleName?.trim() || session.title,
        narratorEmail: session.narratorEmail,
      },
    ]
  }
  if (!email) return []
  const key = email.trim().toLowerCase()
  return [...scheduledSessions.values()]
    .filter((session) => session.seats?.some((seat) => !seat.leftAt && seat.email.trim().toLowerCase() === key))
    .map((session) => ({
      chronicleName: session.chronicleName?.trim() || session.title,
      narratorEmail: session.narratorEmail,
    }))
}

function toPlayerHandoutDTO(handout: SessionHandout): SessionHandout {
  const { narratorWhisper: _whisper, narratorEmail: _narrator, ...rest } = handout
  return rest
}

function scopedPublished(rows: ChronicleEntity[], contexts: CatalogScopeContext[]) {
  return forPlayers(rows.filter((entity) => entityMatchesCatalogScope(entity, contexts)))
}

export function listPublishedForArchive(category: ArchiveCategory, email?: string, sessionId?: string, role?: string) {
  const contexts = resolveCatalogScopeForViewer(email, sessionId, role)
  return scopedPublished(
    listEntities()
      .filter(
        (e) =>
          e.kind === 'archive' ||
          e.kind === 'equipment' ||
          e.kind === 'consumable' ||
          e.kind === 'monster',
      )
      .filter((e) => {
        if (e.kind === 'archive') return e.archiveCategory === category
        if (e.archiveCategory === category) return true
        return false
      }),
    contexts,
  )
}

export function listPublishedForShop(category: ShopCategory, email?: string, sessionId?: string, role?: string) {
  const contexts = resolveCatalogScopeForViewer(email, sessionId, role)
  return scopedPublished(
    listEntities().filter(
      (e) => (e.kind === 'equipment' || e.kind === 'consumable') && e.shopCategory === category,
    ),
    contexts,
  )
}

export function listPublishedForBestiary(tier: BestiaryTier, email?: string, sessionId?: string, role?: string) {
  const contexts = resolveCatalogScopeForViewer(email, sessionId, role)
  return scopedPublished(
    listEntities().filter((e) => e.kind === 'monster' && (e.bestiaryTier ?? 'known') === tier),
    contexts,
  )
}

export function listPublishedDownloads(category: DownloadCategory, email?: string, sessionId?: string, role?: string) {
  const contexts = resolveCatalogScopeForViewer(email, sessionId, role)
  const published = listEntities({ visibility: 'published' }).filter(
    (e) => e.kind === 'download' && e.downloadCategory === category,
  )
  const files =
    category === 'sheets' && !sessionId
      ? forPlayers(published.filter((entity) => !entity.chronicleScope?.trim() || entityMatchesCatalogScope(entity, contexts)))
      : scopedPublished(published, contexts)
  if (category === 'handouts') {
    const sessionDocs = [...handouts.values()]
      .filter((h) => h.publishedToPlayers && h.status === 'closed')
      .map(toPlayerHandoutDTO)
    return { files, handouts: sessionDocs }
  }
  return { files, handouts: [] as SessionHandout[] }
}

export function listHandouts(admin = false) {
  const rows = [...handouts.values()].sort((a, b) => b.createdAt.localeCompare(a.createdAt))
  if (admin) return rows
  return rows.filter((h) => h.publishedToPlayers).map(toPlayerHandoutDTO)
}

export function getHandout(id: string) {
  return handouts.get(id) ?? null
}

export async function createHandout(
  input: Omit<
    SessionHandout,
    'id' | 'status' | 'publishedToPlayers' | 'createdAt' | 'closedAt' | 'sceneThreats' | 'sceneNpcs' | 'chronicleAmbience' | 'restMode'
  > &
    Partial<Pick<SessionHandout, 'sceneThreats' | 'sceneNpcs' | 'chronicleAmbience' | 'restMode' | 'narratorEmail'>>,
) {
  return runSessionMutation(async () => {
    const id = randomUUID()
    const row: SessionHandout = {
      sceneThreats: [],
      sceneNpcs: [],
      chronicleAmbience: { ...DEFAULT_CHRONICLE_AMBIENCE },
      restMode: false,
      round: 1,
      activeTurnIndex: 0,
      ...input,
      id,
      status: 'pending_close',
      publishedToPlayers: false,
      createdAt: now(),
    }
    handouts.set(id, row)
    await commitSessions()
    return row
  })
}

export function getScheduledSession(id: string) {
  const row = scheduledSessions.get(id)
  return row ? ensureSessionDefaults(row) : null
}

function findHandoutByScheduledSession(sessionId: string) {
  return [...handouts.values()].find((h) => h.scheduledSessionId === sessionId) ?? null
}

export async function ensureHandoutForScheduledSession(sessionId: string) {
  return runSessionMutation(async () => {
    const rawSession = scheduledSessions.get(sessionId)
    if (!rawSession) return null
    const session = ensureSessionDefaults(rawSession)
    const existing = findHandoutByScheduledSession(sessionId)
    if (existing) {
      const row = handouts.get(existing.id)!
      const patch: Partial<SessionHandout> = {}
      if (!row.sceneThreats) patch.sceneThreats = []
      if (!row.sceneNpcs) patch.sceneNpcs = []
      if (!row.chronicleAmbience) patch.chronicleAmbience = { ...DEFAULT_CHRONICLE_AMBIENCE }
      if (row.restMode == null) patch.restMode = false
      if (!row.narratorEmail && session.narratorEmail) patch.narratorEmail = session.narratorEmail
      if (Object.keys(patch).length > 0) {
        const next = { ...row, ...patch }
        handouts.set(row.id, next)
        await commitSessions()
        return next
      }
      return row
    }
    const chronicleName = session.chronicleName?.trim() || session.title
    const id = randomUUID()
    const created: SessionHandout = {
      id,
      title: chronicleName,
      narrativeSummary: '',
      scheduledSessionId: sessionId,
      chronicleName,
      narratorEmail: session.narratorEmail,
      npcIds: [],
      monstersSlain: [],
      participants: [],
      missions: [],
      sceneThreats: [],
      sceneNpcs: [],
      chronicleAmbience: { ...DEFAULT_CHRONICLE_AMBIENCE },
      restMode: false,
      status: 'pending_close',
      publishedToPlayers: false,
      createdAt: now(),
    }
    handouts.set(id, created)
    await commitSessions()
    return created
  })
}

export async function patchMesaHandoutNarrative(sessionId: string, narrativeSummary: string) {
  const row = findHandoutByScheduledSession(sessionId)
  if (!row) return null
  return updateHandout(row.id, { narrativeSummary })
}

export async function patchMesaHandoutWhisper(sessionId: string, narratorWhisper: string) {
  const row = findHandoutByScheduledSession(sessionId)
  if (!row) return null
  return updateHandout(row.id, { narratorWhisper })
}

export async function updateHandout(id: string, patch: Partial<SessionHandout>) {
  return runSessionMutation(async () => {
    const row = handouts.get(id)
    if (!row) return null
    const next = {
      ...row,
      ...patch,
      ...(patch.status === 'closed' && !row.closedAt ? { closedAt: now() } : {}),
    }
    handouts.set(id, next)
    await commitSessions()
    return next
  })
}

async function glossaryMirrorForNpcOrMonster(row: ChronicleEntity) {
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
    defense: row.defense,
    abilities: row.abilities,
    lifeStatus: row.lifeStatus,
    location: row.location,
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
    creatureStats: row.creatureStats,
    passiveTraits: row.passiveTraits,
    attributeMods: row.attributeMods,
    chronicleScope: row.chronicleScope,
    narratorScope: row.narratorScope,
    visibility: 'published' as const,
  }
  if (twin) {
    await updateEntity(twin.id, patch)
    return
  }
  await createEntity({
    kind: 'archive',
    name: row.name,
    archiveCategory,
    ...patch,
  })
}

export async function publishEntity(id: string) {
  return updateEntity(id, { visibility: 'published' })
}

function ensureSessionDefaults(row: ScheduledSession): ScheduledSession {
  const next: ScheduledSession = {
    ...row,
    accessCode: row.accessCode || generateAccessCode(),
    listing: row.listing ?? 'private',
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

export function seatedSessionIds(email: string) {
  const key = email.trim().toLowerCase()
  return [...scheduledSessions.values()]
    .filter((session) => session.seats.some((seat) => !seat.leftAt && seat.email.trim().toLowerCase() === key))
    .map((session) => session.id)
}

export function openSeats(sessionId: string) {
  return (scheduledSessions.get(sessionId)?.seats ?? []).filter((seat) => !seat.leftAt)
}

export function sharesAnyManagedSession(narratorEmail: string, playerEmail: string): boolean {
  const nKey = narratorEmail.trim().toLowerCase()
  const pKey = playerEmail.trim().toLowerCase()
  return [...scheduledSessions.values()].some((s) => {
    const manages =
      (s.narratorEmail && sameEmail(s.narratorEmail, nKey)) ||
      (s.allowCoNarrator && (s.coNarratorEmails ?? []).some((e) => sameEmail(e, nKey)))
    if (!manages) return false
    const inSeats = (s.seats ?? []).some((seat) => sameEmail(seat.email, pKey))
    const inPresence = (s.presence ?? []).some((p) => sameEmail(p.email, pKey))
    return inSeats || inPresence
  })
}

export async function replaceSessionBundle(sessions?: ScheduledSession[], nextHandouts?: SessionHandout[]) {
  return runSessionMutation(async () => {
    if (sessions !== undefined) {
      scheduledSessions.clear()
      for (const session of sessions) {
        if (session?.id) scheduledSessions.set(session.id, session)
      }
    }
    if (nextHandouts !== undefined) {
      handouts.clear()
      for (const handout of nextHandouts) {
        if (handout?.id) handouts.set(handout.id, handout)
      }
    }
    await commitSessions()
  })
}

export function listScheduledSessions() {
  return [...scheduledSessions.values()]
    .map(ensureSessionDefaults)
    .sort((a, b) => a.scheduledAt.localeCompare(b.scheduledAt))
}

export function listScheduledSessionsForManager(user: { email: string; role: string }) {
  const rows = listScheduledSessions()
  if (user.role === 'admin') return rows
  return rows.filter(
    (s) =>
      (s.narratorEmail && sameEmail(s.narratorEmail, user.email)) ||
      (s.allowCoNarrator && (s.coNarratorEmails ?? []).some((e) => sameEmail(e, user.email))),
  )
}

export type LiveMesaSummaryDTO = {
  id: string
  title: string
  chronicleName?: string
  scheduledAt: string
  listing: 'public' | 'private'
  status: 'scheduled' | 'open' | 'closed'
  narratorName: string
  isOwner: boolean
  isCoNarrator: boolean
  allowCoNarrator: boolean
  isSeated: boolean
  hasConfirmedPresence: boolean
  scheduledTimeReached: boolean
  canEnterLive: boolean
  seatedCount: number
  presenceCount: number
}

export function listLiveMesasForNarrator(user: { email: string; role: string }): LiveMesaSummaryDTO[] {
  const viewer = user.email.trim().toLowerCase()
  return listScheduledSessions()
    .filter((s) => s.status === 'open')
    .map((s) => {
      const narrator = s.narratorEmail ? getProfile(s.narratorEmail) : null
      const activeSeats = (s.seats ?? []).filter((seat) => !seat.leftAt)
      const isOwner = user.role === 'admin' || Boolean(s.narratorEmail && sameEmail(s.narratorEmail, viewer))
      const isCoNarrator = Boolean(
        s.allowCoNarrator && (s.coNarratorEmails ?? []).some((e) => sameEmail(e, viewer)),
      )
      const isSeated = activeSeats.some((seat) => sameEmail(seat.email, viewer))
      const hasConfirmedPresence = hasConfirmedSessionPresence(s, viewer)
      const scheduledTimeReached = isScheduledTimeReached(s)
      const canEnterLive = evaluatePlayerLiveAccess(s, viewer).allowed
      return {
        id: s.id,
        title: s.title,
        chronicleName: s.chronicleName,
        scheduledAt: s.scheduledAt,
        listing: s.listing ?? 'private',
        status: s.status,
        narratorName: narrator?.displayName ?? 'Narrador',
        isOwner,
        isCoNarrator,
        allowCoNarrator: Boolean(s.allowCoNarrator),
        isSeated,
        hasConfirmedPresence,
        scheduledTimeReached,
        canEnterLive,
        seatedCount: activeSeats.length,
        presenceCount: (s.presence ?? []).length,
      }
    })
}

export async function joinSessionAsCoNarrator(
  sessionId: string,
  user: { email: string; role: string },
  accessCode?: string,
) {
  const row = getScheduledSession(sessionId)
  if (!row) return { ok: false as const, reason: 'not_found' as const }
  if (row.status === 'closed') return { ok: false as const, reason: 'closed' as const }
  if (canManageSessionObj(row, user)) {
    return { ok: true as const, session: row }
  }
  if (!row.allowCoNarrator) {
    return { ok: false as const, reason: 'co_narrator_disabled' as const }
  }
  const listing = row.listing ?? 'private'
  if (listing !== 'public' && row.accessCode.toUpperCase() !== (accessCode ?? '').trim().toUpperCase()) {
    return { ok: false as const, reason: 'bad_code' as const }
  }
  const email = user.email.trim().toLowerCase()
  const existing = row.coNarratorEmails ?? []
  const coNarratorEmails = existing.some((e) => sameEmail(e, email)) ? existing : [...existing, email]
  const next = await updateScheduledSession(sessionId, { coNarratorEmails })
  return { ok: true as const, session: next! }
}

export function findScheduledSessionByAccessCode(code: string) {
  const key = code.trim().toUpperCase()
  if (!key) return null
  return listScheduledSessions().find((s) => s.status !== 'closed' && s.accessCode.toUpperCase() === key) ?? null
}

/** Gera código único criptograficamente seguro (C11). */
export function generateAccessCode(): string {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  const activeCodes = new Set(
    [...scheduledSessions.values()]
      .filter((s) => s.status !== 'closed' && s.accessCode)
      .map((s) => s.accessCode.toUpperCase()),
  )
  for (let attempt = 0; attempt < 30; attempt += 1) {
    let code = ''
    for (let i = 0; i < 6; i += 1) {
      code += alphabet[randomInt(0, alphabet.length)]
    }
    if (!activeCodes.has(code)) return code
  }
  return randomUUID().replace(/-/g, '').slice(0, 8).toUpperCase()
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
    targetDuration: meta.targetDuration?.trim() ?? '',
    recommendedLevels: meta.recommendedLevels?.trim() ?? '',
    sessionOrdinal: meta.sessionOrdinal,
  }
}

export async function createScheduledSession(input: {
  title: string
  scheduledAt: string
  chronicleName?: string
  narratorEmail?: string
  tableMeta?: SessionTableMeta
  listing?: 'public' | 'private'
  allowCoNarrator?: boolean
}) {
  const created = await runSessionMutation(async () => {
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
      allowCoNarrator: Boolean(input.allowCoNarrator),
      coNarratorEmails: [],
      tableMeta,
      accessCode: generateAccessCode(),
      accessCodeRotatedAt: now(),
      listing: input.listing === 'public' ? 'public' : 'private',
      status: 'scheduled',
      activeDurationMs: 0,
      presence: [],
      seats: [],
      createdAt: now(),
    }
    scheduledSessions.set(id, row)
    await commitSessions()
    return row
  })
  await ensureHandoutForScheduledSession(created.id)
  return created
}

export async function updateScheduledSession(
  id: string,
  patch: Partial<Omit<ScheduledSession, 'id' | 'createdAt' | 'accessCode'>> & { accessCode?: string },
) {
  return runSessionMutation(async () => {
    const row = scheduledSessions.get(id)
    if (!row) return null
    let tableMeta = patch.tableMeta !== undefined ? patch.tableMeta : row.tableMeta
    if (tableMeta) {
      tableMeta = normalizeTableMeta(tableMeta, patch.chronicleName ?? row.chronicleName, patch.title ?? row.title) ?? tableMeta
    }
    const next = { ...row, ...patch, tableMeta }
    scheduledSessions.set(id, next)
    await commitSessions()
    return next
  })
}

export async function rotateSessionAccessCode(sessionId: string, user: { email: string; role: string }) {
  const session = requireSessionManager(sessionId, user)
  return updateScheduledSession(session.id, {
    accessCode: generateAccessCode(),
    accessCodeRotatedAt: now(),
  })
}

export async function deleteScheduledSession(sessionId: string, user: { email: string; role: string }) {
  const session = getScheduledSession(sessionId)
  if (!session) return { ok: false as const, reason: 'not_found' as const }
  if (!canManageSessionObj(session, user)) {
    return { ok: false as const, reason: 'forbidden' as const }
  }
  if (session.status === 'open') return { ok: false as const, reason: 'open' as const }
  return runSessionMutation(async () => {
    for (const handout of handouts.values()) {
      if (handout.scheduledSessionId === sessionId) handouts.delete(handout.id)
    }
    scheduledSessions.delete(sessionId)
    await commitSessions()
    return { ok: true as const }
  })
}

export async function openScheduledSession(sessionId: string, user: { email: string; role: string }) {
  const access = canManageMesa(sessionId, user)
  if (!access.ok) return access
  const row = getScheduledSession(sessionId)
  if (!row) return { ok: false as const, reason: 'not_found' as const }
  if (row.status === 'closed') return { ok: false as const, reason: 'closed' as const }
  if (row.status === 'open') return { ok: true as const, session: row }
  const stamp = now()
  const next = await updateScheduledSession(sessionId, {
    status: 'open',
    startedAt: row.startedAt ?? stamp,
    lastOpenedAt: stamp,
    endedAt: undefined,
  })
  return { ok: true as const, session: next! }
}

export async function rescheduleSameTable(sessionId: string, user: { email: string; role: string }) {
  const access = canManageMesa(sessionId, user)
  if (!access.ok) return access
  const row = getScheduledSession(sessionId)
  if (!row) return { ok: false as const, reason: 'not_found' as const }
  if (row.status !== 'closed') return { ok: false as const, reason: 'not_closed' as const }
  const start = new Date()
  start.setHours(20, 0, 0, 0)
  if (start.getTime() <= Date.now()) start.setDate(start.getDate() + 1)
  const created = await createScheduledSession({
    title: row.tableMeta?.sessionLabel || row.title,
    scheduledAt: start.toISOString(),
    chronicleName: row.chronicleName,
    narratorEmail: row.narratorEmail ?? user.email,
    tableMeta: row.tableMeta,
    listing: row.listing,
  })
  const previous = findHandoutByScheduledSession(sessionId)
  const fresh = findHandoutByScheduledSession(created.id)
  if (previous && fresh) {
    await updateHandout(fresh.id, {
      participants: previous.participants.map((participant) => ({
        ...participant,
        rewards: participant.rewards.map((reward) => ({ ...reward })),
      })),
      missions: previous.missions.map((mission) => ({ ...mission })),
      monstersSlain: previous.monstersSlain.map((monster) => ({ ...monster })),
      narrativeSummary: '',
    })
  }
  return { ok: true as const, session: created }
}

export async function closeScheduledSession(sessionId: string, user: { email: string; role: string }) {
  const access = canManageMesa(sessionId, user)
  if (!access.ok) return access
  const row = getScheduledSession(sessionId)
  if (!row) return { ok: false as const, reason: 'not_found' as const }
  const endedAt = now()
  let activeDurationMs = row.activeDurationMs ?? 0
  if (row.status === 'open') {
    const anchor = row.lastOpenedAt ?? row.startedAt
    if (anchor) activeDurationMs += Math.max(0, Date.now() - new Date(anchor).getTime())
  }
  const next = await updateScheduledSession(sessionId, {
    status: 'closed',
    endedAt,
    activeDurationMs,
  })
  const handout = findHandoutByScheduledSession(sessionId)
  if (handout && handout.status !== 'closed') {
    await updateHandout(handout.id, { status: 'closed', closedAt: endedAt })
    for (const slain of handout.monstersSlain ?? []) {
      const target = getEntity(slain.entityId)
      if (target && (target.kind === 'monster' || target.kind === 'npc') && target.lifeStatus !== 'dead') {
        await updateEntity(target.id, { lifeStatus: 'dead' })
      }
    }
  }
  await pauseEffectsForSeats((row.seats ?? []).filter((seat) => !seat.leftAt))
  return { ok: true as const, session: next! }
}

export async function confirmSessionPresence(
  sessionId: string,
  user: { email: string; displayName: string; role?: string },
  accessCode?: string,
) {
  return runSessionMutation(async () => {
    const raw = scheduledSessions.get(sessionId)
    if (!raw) return { ok: false as const, reason: 'not_found' as const }
    const row = ensureSessionDefaults(raw)
    if (row.status === 'closed') return { ok: false as const, reason: 'closed' as const }

    const listing = row.listing ?? 'private'
    const isParticipant =
      (row.seats ?? []).some((s) => !s.leftAt && sameEmail(s.email, user.email)) ||
      (row.presence ?? []).some((p) => sameEmail(p.email, user.email)) ||
      (user.role ? canManageSessionObj(row, { email: user.email, role: user.role }) : false)

    if (listing === 'private' && !isParticipant) {
      const provided = accessCode?.trim().toUpperCase() ?? ''
      if (!provided || provided !== row.accessCode.toUpperCase()) {
        return { ok: false as const, reason: 'forbidden' as const }
      }
    }

    const presence = [...(row.presence ?? [])]
    const idx = presence.findIndex((p) => sameEmail(p.email, user.email))
    const entry = { email: user.email, displayName: user.displayName, confirmedAt: now() }
    if (idx >= 0) presence[idx] = entry
    else presence.push(entry)
    const updated = { ...row, presence }
    scheduledSessions.set(sessionId, updated)
    await commitSessions()
    return { ok: true as const, session: updated, confirmedAt: entry.confirmedAt }
  })
}

export async function joinSessionWithCode(
  sessionId: string,
  accessCode: string,
  user: { email: string; displayName: string },
  character: { id: string; name: string },
) {
  return runSessionMutation(async () => {
    const raw = scheduledSessions.get(sessionId)
    if (!raw) return { ok: false as const, reason: 'not_found' as const }
    const row = ensureSessionDefaults(raw)
    if (row.status === 'closed') {
      return { ok: false as const, reason: 'not_open' as const }
    }
    const listing = row.listing ?? 'private'
    if (listing !== 'public' && row.accessCode.toUpperCase() !== accessCode.trim().toUpperCase()) {
      return { ok: false as const, reason: 'bad_code' as const }
    }
    if (!hasConfirmedSessionPresence(row, user.email)) {
      return { ok: false as const, reason: 'presence_required' as const }
    }
    if (!isScheduledTimeReached(row)) {
      return { ok: false as const, reason: 'before_schedule' as const, scheduledAt: row.scheduledAt }
    }
    if (row.status !== 'open') {
      return { ok: false as const, reason: 'not_open' as const }
    }
    const seats = [...(row.seats ?? [])].filter((s) => !(sameEmail(s.email, user.email) && !s.leftAt))
    seats.push({
      email: user.email,
      displayName: user.displayName,
      characterId: character.id,
      characterName: character.name,
      joinedAt: now(),
    })
    const next = { ...row, seats }
    scheduledSessions.set(sessionId, next)
    await commitSessions()
    return { ok: true as const, session: next }
  })
}

export async function leaveSessionSeat(sessionId: string, user: { email: string; role: string }) {
  return runSessionMutation(async () => {
    const raw = scheduledSessions.get(sessionId)
    if (!raw) return { ok: false as const, reason: 'not_found' as const }
    const row = ensureSessionDefaults(raw)
    const isSeated = (row.seats ?? []).some((s) => sameEmail(s.email, user.email) && !s.leftAt)
    if (!isSeated && !canManageSessionObj(row, user)) {
      return { ok: false as const, reason: 'forbidden' as const }
    }
    const seats = (row.seats ?? []).map((s) =>
      sameEmail(s.email, user.email) && !s.leftAt ? { ...s, leftAt: now() } : s,
    )
    const updated = { ...row, seats }
    scheduledSessions.set(sessionId, updated)
    await commitSessions()
    return { ok: true as const, session: updated }
  })
}

export async function replaceSessionCharacter(
  sessionId: string,
  email: string,
  character: { id: string; name: string },
) {
  return runSessionMutation(async () => {
    const raw = scheduledSessions.get(sessionId)
    if (!raw) return null
    const row = ensureSessionDefaults(raw)
    if (row.status === 'closed') return null
    const seats = (row.seats ?? []).map((s) =>
      sameEmail(s.email, email) && !s.leftAt
        ? { ...s, characterId: character.id, characterName: character.name }
        : s,
    )
    const updated = { ...row, seats }
    scheduledSessions.set(sessionId, updated)
    await commitSessions()
    return updated
  })
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

function canManageSessionObj(session: ScheduledSession, user: { email: string; role: string }) {
  if (user.role === 'admin') return true
  if (user.role !== 'narrator') return false
  if (session.narratorEmail && sameEmail(session.narratorEmail, user.email)) return true
  if (session.allowCoNarrator && (session.coNarratorEmails ?? []).some((e) => sameEmail(e, user.email))) {
    return true
  }
  return false
}

export function isSessionManager(sessionId: string, user: { email: string; role?: string }) {
  const session = getScheduledSession(sessionId)
  if (!session) return false
  const role = user.role ?? getProfile(user.email)?.role ?? 'player'
  return canManageSessionObj(session, { email: user.email, role })
}

export function sessionAccess(sessionId: string, user: { email: string; role?: string }) {
  const session = getScheduledSession(sessionId)
  if (!session) return { ok: false as const, reason: 'not_found' as const }
  const role = user.role ?? getProfile(user.email)?.role ?? 'player'
  if (role === 'admin') return { ok: true as const, session }
  const seated = (session.seats ?? []).some((seat) => !seat.leftAt && sameEmail(seat.email, user.email))
  if (role === 'narrator') {
    if (canManageSessionObj(session, { email: user.email, role }) || seated) {
      return { ok: true as const, session }
    }
    return { ok: false as const, reason: 'forbidden' as const }
  }
  if (!seated) return { ok: false as const, reason: 'forbidden' as const }
  return { ok: true as const, session }
}

export function sessionLiveAccess(sessionId: string, user: { email: string; role?: string }) {
  const access = sessionAccess(sessionId, user)
  if (!access.ok) return access
  const session = access.session
  const role = user.role ?? getProfile(user.email)?.role ?? 'player'
  if (role === 'admin' || canManageSessionObj(session, { email: user.email, role })) {
    return { ok: true as const, session }
  }
  if (!hasConfirmedSessionPresence(session, user.email)) {
    return { ok: false as const, reason: 'presence_required' as const }
  }
  if (!isScheduledTimeReached(session)) {
    return { ok: false as const, reason: 'before_schedule' as const, scheduledAt: session.scheduledAt }
  }
  if (session.status !== 'open') {
    return { ok: false as const, reason: 'not_open' as const }
  }
  return { ok: true as const, session }
}

export function requireSessionParticipant(sessionId: string, user: { email: string; role: string }): ScheduledSession {
  const access = sessionAccess(sessionId, user)
  if (!access.ok) {
    if (access.reason === 'not_found') throw new NotFoundError('Mesa não encontrada.')
    throw new ForbiddenError('Você não está nesta mesa.')
  }
  return access.session
}

export function requireSessionManager(sessionId: string, user: { email: string; role: string }): ScheduledSession {
  const session = getScheduledSession(sessionId)
  if (!session) throw new NotFoundError('Mesa não encontrada.')
  if (!canManageSessionObj(session, user)) {
    throw new ForbiddenError('Somente o narrador responsável por esta mesa pode executar esta ação.')
  }
  return session
}

function canManageMesa(sessionId: string, user: { email: string; role: string } | string) {
  const resolved =
    typeof user === 'string'
      ? { email: user, role: getProfile(user)?.role === 'admin' ? 'admin' : 'narrator' }
      : user
  const session = getScheduledSession(sessionId)
  if (!session) return { ok: false as const, reason: 'not_found' as const }
  if (!canManageSessionObj(session, resolved)) return { ok: false as const, reason: 'forbidden' as const }
  return { ok: true as const, session }
}

export function listSceneThreatsForSession(sessionId: string) {
  const handout = findHandoutByScheduledSession(sessionId)
  if (!handout) return null
  return handout.sceneThreats ?? []
}

export async function addSceneThreat(
  sessionId: string,
  entityId: string,
  user: { email: string; role: string },
) {
  return runSessionMutation(async () => {
    const access = canManageMesa(sessionId, user)
    if (!access.ok) return access
    const handout = findHandoutByScheduledSession(sessionId)
    if (!handout) return { ok: false as const, reason: 'not_found' as const }
    const entity = getEntity(entityId)
    if (!entity || entity.kind !== 'monster') return { ok: false as const, reason: 'bad_entity' as const }
    const parsed = parseVitalsFromStats(entity.statsText)
    const hpMax = typeof entity.hpMax === 'number' && entity.hpMax > 0 ? Math.round(entity.hpMax) : parsed.hpMax
    const manaMax = typeof entity.manaMax === 'number' && entity.manaMax >= 0 ? Math.round(entity.manaMax) : parsed.manaMax
    const threat: SceneThreat = {
      id: randomUUID(),
      entityId,
      name: entity.name,
      hpCurrent: hpMax,
      hpMax,
      manaCurrent: manaMax,
      manaMax,
    }
    const updated: SessionHandout = { ...handout, sceneThreats: [...(handout.sceneThreats ?? []), threat] }
    handouts.set(handout.id, updated)
    await commitSessions()
    return { ok: true as const, handout: updated }
  })
}

export async function applySceneThreatDelta(
  sessionId: string,
  threatId: string,
  user: { email: string; role: string },
  delta: { hpDelta?: number; manaDelta?: number },
) {
  return runSessionMutation(async () => {
    const access = canManageMesa(sessionId, user)
    if (!access.ok) return access
    const handout = findHandoutByScheduledSession(sessionId)
    if (!handout) return { ok: false as const, reason: 'not_found' as const }
    const threats = handout.sceneThreats ?? []
    const idx = threats.findIndex((t) => t.id === threatId)
    if (idx < 0) return { ok: false as const, reason: 'not_found' as const }
    const t = threats[idx]
    const next: SceneThreat = { ...t }
    if (delta.hpDelta != null && Number.isFinite(delta.hpDelta)) {
      next.hpCurrent = Math.max(0, Math.min(t.hpMax, t.hpCurrent + delta.hpDelta))
    }
    if (delta.manaDelta != null && Number.isFinite(delta.manaDelta)) {
      next.manaCurrent = Math.max(0, Math.min(t.manaMax, t.manaCurrent + delta.manaDelta))
    }
    const sceneThreats = [...threats]
    sceneThreats[idx] = next
    const updated: SessionHandout = { ...handout, sceneThreats }
    handouts.set(handout.id, updated)
    await commitSessions()
    if (next.hpCurrent === 0) {
      const entity = getEntity(next.entityId)
      if (entity && entity.lifeStatus !== 'dead') {
        await updateEntity(entity.id, { lifeStatus: 'dead' })
      }
    }
    return { ok: true as const, handout: updated }
  })
}

export async function removeSceneThreat(
  sessionId: string,
  threatId: string,
  user: { email: string; role: string },
) {
  return runSessionMutation(async () => {
    const access = canManageMesa(sessionId, user)
    if (!access.ok) return access
    const handout = findHandoutByScheduledSession(sessionId)
    if (!handout) return { ok: false as const, reason: 'not_found' as const }
    const updated: SessionHandout = {
      ...handout,
      sceneThreats: (handout.sceneThreats ?? []).filter((t) => t.id !== threatId),
    }
    handouts.set(handout.id, updated)
    await commitSessions()
    return { ok: true as const, handout: updated }
  })
}

export async function addSceneNpc(
  sessionId: string,
  entityId: string,
  user: { email: string; role: string },
) {
  return runSessionMutation(async () => {
    const access = canManageMesa(sessionId, user)
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
    const updated: SessionHandout = { ...handout, sceneNpcs: [...(handout.sceneNpcs ?? []), npc] }
    handouts.set(handout.id, updated)
    await commitSessions()
    return { ok: true as const, handout: updated }
  })
}

export async function removeSceneNpc(
  sessionId: string,
  npcId: string,
  user: { email: string; role: string },
) {
  return runSessionMutation(async () => {
    const access = canManageMesa(sessionId, user)
    if (!access.ok) return access
    const handout = findHandoutByScheduledSession(sessionId)
    if (!handout) return { ok: false as const, reason: 'not_found' as const }
    const updated: SessionHandout = {
      ...handout,
      sceneNpcs: (handout.sceneNpcs ?? []).filter((n) => n.id !== npcId),
    }
    handouts.set(handout.id, updated)
    await commitSessions()
    return { ok: true as const, handout: updated }
  })
}

export async function patchMesaAmbience(
  sessionId: string,
  patch: Partial<ChronicleAmbience>,
  user: { email: string; role: string },
) {
  return runSessionMutation(async () => {
    const access = canManageMesa(sessionId, user)
    if (!access.ok) return access
    const handout = findHandoutByScheduledSession(sessionId)
    if (!handout) return { ok: false as const, reason: 'not_found' as const }
    const chronicleAmbience = { ...(handout.chronicleAmbience ?? DEFAULT_CHRONICLE_AMBIENCE), ...patch }
    const updated: SessionHandout = { ...handout, chronicleAmbience }
    handouts.set(handout.id, updated)
    await commitSessions()
    return { ok: true as const, handout: updated }
  })
}

export async function setMesaRestMode(
  sessionId: string,
  restMode: boolean,
  user: { email: string; role: string },
) {
  return runSessionMutation(async () => {
    const access = canManageMesa(sessionId, user)
    if (!access.ok) return access
    const handout = findHandoutByScheduledSession(sessionId)
    if (!handout) return { ok: false as const, reason: 'not_found' as const }
    const updated: SessionHandout = { ...handout, restMode }
    handouts.set(handout.id, updated)
    await commitSessions()
    return { ok: true as const, handout: updated }
  })
}

export type SessionLiveBrief = {
  narrativeSummary: string
  restMode: boolean
  round: number
  activeTurnIndex: number
  chronicleAmbience: ChronicleAmbience
  sceneNpcs: Array<{ id: string; name: string; description: string }>
}

export function getSessionLiveBrief(sessionId: string): SessionLiveBrief | null {
  const handout = findHandoutByScheduledSession(sessionId)
  if (!handout) return null
  return {
    narrativeSummary: handout.narrativeSummary,
    restMode: handout.restMode ?? false,
    round: handout.round ?? 1,
    activeTurnIndex: handout.activeTurnIndex ?? 0,
    chronicleAmbience: handout.chronicleAmbience ?? DEFAULT_CHRONICLE_AMBIENCE,
    sceneNpcs: (handout.sceneNpcs ?? []).map((n) => ({
      id: n.id,
      name: n.name,
      description: n.description,
    })),
  }
}

export function getSessionBagForPlayer(sessionId: string, email: string) {
  const session = getScheduledSession(sessionId)
  const handout = findHandoutByScheduledSession(sessionId)
  if (!session || !handout) return null
  const seat = (session.seats ?? []).find((item) => !item.leftAt && sameEmail(item.email, email))
  if (!seat) return { rewards: [] }
  const participant =
    handout.participants.find(
      (item) =>
        item.displayName.trim().toLowerCase() === seat.displayName.trim().toLowerCase() &&
        item.characterName.trim().toLowerCase() === seat.characterName.trim().toLowerCase(),
    ) ??
    handout.participants.find(
      (item) => item.characterName.trim().toLowerCase() === seat.characterName.trim().toLowerCase(),
    )
  return { rewards: participant?.rewards ?? [] }
}

export async function recordSessionAction(input: {
  sessionId: string
  actorEmail: string
  characterId?: string
  characterName: string
  kind: SessionActionEntry['kind']
  summary: string
  detail?: string
}) {
  return runExclusive('store:session-actions', async () => {
    const remoteRev = await checkRemoteDocumentRevision(ACTIONS_DOC)
    if (remoteRev > getLoadedDocumentRevision(ACTIONS_DOC)) {
      const doc = await loadDocument<SessionActionEntry[]>(ACTIONS_DOC)
      if (doc && Array.isArray(doc.body)) {
        sessionActions.splice(0, sessionActions.length, ...doc.body.slice(-600))
      }
    }
    const entry: SessionActionEntry = {
      id: randomUUID(),
      sessionId: input.sessionId,
      actorEmail: input.actorEmail.trim().toLowerCase(),
      characterId: input.characterId,
      characterName: input.characterName.trim() || 'Aventureiro',
      kind: input.kind,
      summary: input.summary.trim(),
      detail: (input.detail ?? '').trim(),
      createdAt: now(),
    }
    const sb = getSupabaseAdmin()
    if (
      sb &&
      Date.now() >= acoesTableUnavailableUntil &&
      (process.env.NODE_ENV !== 'test' || process.env.BELADONA_TEST_USE_ENV === 'true')
    ) {
      const { error } = await sb.from('AcoesSessao').insert({
        id: entry.id,
        session_id: entry.sessionId,
        actor_email: entry.actorEmail,
        character_id: entry.characterId ?? null,
        character_name: entry.characterName,
        kind: entry.kind,
        summary: entry.summary,
        detail: entry.detail,
        created_at: entry.createdAt,
      })
      if (error) {
        if (error.code === 'PGRST205' || /AcoesSessao|schema cache|does not exist/i.test(error.message)) {
          acoesTableUnavailableUntil = Date.now() + SCHEMA_RETRY_COOLDOWN_MS
        } else {
          console.warn('[acoes] Falha ao gravar AcoesSessao:', error.message)
        }
      }
    }
    const backup = [...sessionActions]
    sessionActions.push(entry)
    if (sessionActions.length > 600) sessionActions.splice(0, sessionActions.length - 600)
    try {
      await commitDocument(ACTIONS_DOC, sessionActions.slice(-600))
      return entry
    } catch (err) {
      sessionActions.splice(0, sessionActions.length, ...backup)
      throw err
    }
  })
}

export function listSessionActions(sessionId: string, limit = 60) {
  const safeLimit = Math.min(200, Math.max(1, limit))
  return sessionActions
    .filter((row) => row.sessionId === sessionId)
    .slice(-safeLimit)
    .reverse()
    .map(({ actorEmail: _actor, ...rest }) => rest)
}

/** Últimas 8 semanas: sessões agendadas + handouts encerrados por semana. */
export function sessionActivityLineSeries(user?: { email: string; role: string }) {
  const weeks: { label: string; count: number }[] = []
  const nowDate = new Date()
  const visibleSessions = user ? listScheduledSessionsForManager(user) : listScheduledSessions()
  const visibleIds = new Set(visibleSessions.map((s) => s.id))
  const visibleHandouts = listHandouts(true).filter(
    (h) => !user || user.role === 'admin' || (h.scheduledSessionId && visibleIds.has(h.scheduledSessionId)),
  )

  for (let i = 7; i >= 0; i--) {
    const start = new Date(nowDate)
    start.setDate(start.getDate() - i * 7)
    start.setHours(0, 0, 0, 0)
    const end = new Date(start)
    end.setDate(end.getDate() + 7)
    const label = start.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })
    const scheduled = visibleSessions.filter((s) => {
      const d = new Date(s.scheduledAt)
      return d >= start && d < end
    }).length
    const closed = visibleHandouts.filter((h) => {
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

export function adminMesaActivityStats(user?: { email: string; role: string }) {
  const nowDate = new Date()
  const dayStart = new Date(nowDate)
  dayStart.setHours(0, 0, 0, 0)
  const dayEnd = new Date(dayStart)
  dayEnd.setDate(dayEnd.getDate() + 1)

  const weekStart = new Date(dayStart)
  weekStart.setDate(weekStart.getDate() - ((weekStart.getDay() + 6) % 7))
  const weekEnd = new Date(weekStart)
  weekEnd.setDate(weekEnd.getDate() + 7)

  const monthStart = new Date(nowDate.getFullYear(), nowDate.getMonth(), 1)
  const monthEnd = new Date(nowDate.getFullYear(), nowDate.getMonth() + 1, 1)

  const scheduled = user ? listScheduledSessionsForManager(user) : listScheduledSessions()
  const visibleIds = new Set(scheduled.map((s) => s.id))
  const allHandouts = listHandouts(true).filter(
    (h) => !user || user.role === 'admin' || (h.scheduledSessionId && visibleIds.has(h.scheduledSessionId)),
  )

  function bucket(start: Date, end: Date) {
    const touched = allHandouts.filter((h) => {
      const anchor = h.closedAt ?? h.createdAt
      return inRange(anchor, start, end) || (h.status === 'pending_close' && inRange(h.createdAt, start, end))
    })
    const hours = touched.reduce((sum, h) => sum + handoutActiveHours(h), 0)
    const sessionsMarked = scheduled.filter((s) => inRange(s.scheduledAt, start, end)).length
    const actsClosed = allHandouts.filter(
      (h) => h.status === 'closed' && h.closedAt && inRange(h.closedAt, start, end),
    ).length
    return {
      hoursActive: Math.round(hours * 10) / 10,
      sessionsMarked,
      actsClosed,
    }
  }

  return {
    openMesas: allHandouts.filter((h) => h.status === 'pending_close').length,
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

export function listPublishedSessionsForPlayers(
  viewerEmail?: string,
  options?: { includeClosed?: boolean },
): ParticipantSessionDTO[] {
  const viewer = viewerEmail?.trim().toLowerCase() ?? ''
  const includeClosed = options?.includeClosed ?? false
  return listScheduledSessions()
    .filter((s) => includeClosed || s.status !== 'closed')
    .filter((s) => {
      const listing = s.listing ?? 'private'
      if (listing === 'public') return true
      if (!viewer) return false
      if (s.narratorEmail?.toLowerCase() === viewer) return true
      if (s.allowCoNarrator && (s.coNarratorEmails ?? []).some((e) => e.toLowerCase() === viewer)) return true
      if (
        (s.seats ?? []).some(
          (seat) => seat.email.toLowerCase() === viewer && (s.status === 'closed' || !seat.leftAt),
        )
      ) {
        return true
      }
      if ((s.presence ?? []).some((p) => p.email.toLowerCase() === viewer)) return true
      return false
    })
    .map((s) => toParticipantSessionDTO(s, viewerEmail))
}
