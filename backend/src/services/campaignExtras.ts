import { createHash, randomUUID } from 'node:crypto'
import { z } from 'zod'
import {
  checkRemoteDocumentRevision,
  commitDocument,
  documentWeight,
  getLoadedDocumentRevision,
  loadDocument,
  runExclusive,
} from './campaignDocuments.js'
import {
  listEntities,
  listHandouts,
  listScheduledSessions,
  openSeats,
  replaceSessionBundle,
  seatedSessionIds,
  type ScheduledSession,
  type SessionHandout,
} from './chronicleStore.js'
import { listWalletSnapshot, replaceWalletMap } from './courtStore.js'
import {
  charactersOutsideRules,
  listProfiles,
  noteRuleChange,
  replaceProfiles,
  type UserProfile,
} from './profileStore.js'
import {
  MAX_CHARACTER_LEVEL,
  SECOND_SUBCLASS_CHOICE_LEVEL,
} from './progressionRules.js'
import { readRules, writeRules, type CampaignRules } from './rulesState.js'
import { recordOperationStrict } from './operationLog.js'
import { ValidationError } from './errors.js'
import { getSupabaseAdmin } from './supabaseClient.js'

export type BoardCard = {
  id: string
  kind: 'mystery' | 'mission' | 'place' | 'pending' | 'npc'
  title: string
  status: 'confirmed' | 'proposed' | 'pending'
  detail: string
  owner: string
  priority: 'baixa' | 'media' | 'alta'
}

export type TableSecret = {
  id: string
  sessionId: string
  entityId: string
  audienceEmail: string | null
  text: string
  createdAt: string
}

type SavedFilter = {
  shopCategory?: 'gear' | 'consumables' | 'services'
  shopQuery?: string
  archiveQuery?: string
  archiveRarity?: string
}

export type BackupMetadataEntry = {
  id: string
  createdAt: string
  scope: string
  schemaVersion: string
  status: 'verified' | 'completed_unverified' | 'pending_external_destination' | 'failed'
  recordCounts: Record<string, number>
  checksumSha256: string
  externalRef: string | null
  verifiedAt: string | null
  operatorEmail: string
  notes: string | null
}

type BackupFile = {
  schemaVersion?: string
  exportedAt?: string
  profiles?: UserProfile[]
  sessions?: ScheduledSession[]
  handouts?: SessionHandout[]
  wallets?: ReturnType<typeof listWalletSnapshot>
}

const SCHEMA_VERSION = '2026-11-24'
const board: BoardCard[] = []
const secrets: TableSecret[] = []
const filters = new Map<string, SavedFilter>()
const backupMetadata: BackupMetadataEntry[] = []

function clone<T>(v: T): T {
  return JSON.parse(JSON.stringify(v)) as T
}

export async function hydrateCampaignExtras() {
  const [boardDoc, secretDoc, filterDoc, rulesDoc, backupMetaDoc] = await Promise.all([
    loadDocument<BoardCard[]>('campaign-board'),
    loadDocument<TableSecret[]>('mesa-secrets'),
    loadDocument<Record<string, SavedFilter>>('player-filters'),
    loadDocument<CampaignRules>('campaign-rules'),
    loadDocument<BackupMetadataEntry[]>('backup-metadata'),
  ])
  if (boardDoc && documentWeight(boardDoc.body) > 0) {
    board.splice(0, board.length, ...boardDoc.body)
  }
  if (secretDoc && documentWeight(secretDoc.body) > 0) {
    secrets.splice(0, secrets.length, ...secretDoc.body)
  }
  filters.clear()
  if (filterDoc && filterDoc.body) {
    for (const [email, value] of Object.entries(filterDoc.body)) filters.set(email, value)
  }
  if (rulesDoc?.body?.maxLevel) {
    writeRules({
      ...readRules(),
      ...rulesDoc.body,
      maxLevel: Math.min(MAX_CHARACTER_LEVEL, rulesDoc.body.maxLevel),
      subclassLevel: Math.min(MAX_CHARACTER_LEVEL, rulesDoc.body.subclassLevel),
      secondarySubclassLevel: Math.min(
        MAX_CHARACTER_LEVEL,
        rulesDoc.body.secondarySubclassLevel ?? SECOND_SUBCLASS_CHOICE_LEVEL,
      ),
      startingXp: rulesDoc.body.startingXp ?? 0,
      shopBudgetCopper: rulesDoc.body.shopBudgetCopper ?? 0,
    })
  }
  if (backupMetaDoc && documentWeight(backupMetaDoc.body) > 0) {
    backupMetadata.splice(0, backupMetadata.length, ...backupMetaDoc.body.slice(-100))
  }
}

export function resetCampaignExtrasForTests() {
  board.length = 0
  secrets.length = 0
  filters.clear()
  backupMetadata.length = 0
}

export function listBoard() {
  return [...board]
}

export async function syncBoardIfStale() {
  const remoteRev = await checkRemoteDocumentRevision('campaign-board')
  if (remoteRev > getLoadedDocumentRevision('campaign-board')) {
    const doc = await loadDocument<BoardCard[]>('campaign-board')
    if (doc && Array.isArray(doc.body)) board.splice(0, board.length, ...doc.body)
  }
}

export async function syncSecretsIfStale() {
  const remoteRev = await checkRemoteDocumentRevision('mesa-secrets')
  if (remoteRev > getLoadedDocumentRevision('mesa-secrets')) {
    const doc = await loadDocument<TableSecret[]>('mesa-secrets')
    if (doc && Array.isArray(doc.body)) secrets.splice(0, secrets.length, ...doc.body)
  }
}

export async function syncRulesIfStale() {
  const remoteRev = await checkRemoteDocumentRevision('campaign-rules')
  if (remoteRev > getLoadedDocumentRevision('campaign-rules')) {
    const doc = await loadDocument<CampaignRules>('campaign-rules')
    if (doc?.body?.maxLevel) {
      writeRules({
        ...readRules(),
        ...doc.body,
        maxLevel: Math.min(MAX_CHARACTER_LEVEL, doc.body.maxLevel),
        subclassLevel: Math.min(MAX_CHARACTER_LEVEL, doc.body.subclassLevel),
        secondarySubclassLevel: Math.min(
          MAX_CHARACTER_LEVEL,
          doc.body.secondarySubclassLevel ?? SECOND_SUBCLASS_CHOICE_LEVEL,
        ),
        startingXp: doc.body.startingXp ?? 0,
        shopBudgetCopper: doc.body.shopBudgetCopper ?? 0,
      })
    }
  }
}

export async function syncFiltersIfStale() {
  const remoteRev = await checkRemoteDocumentRevision('player-filters')
  if (remoteRev > getLoadedDocumentRevision('player-filters')) {
    const doc = await loadDocument<Record<string, SavedFilter>>('player-filters')
    if (doc && doc.body) {
      filters.clear()
      for (const [email, value] of Object.entries(doc.body)) filters.set(email, value)
    }
  }
}

async function syncBackupMetaIfStale() {
  const remoteRev = await checkRemoteDocumentRevision('backup-metadata')
  if (remoteRev > getLoadedDocumentRevision('backup-metadata')) {
    const doc = await loadDocument<BackupMetadataEntry[]>('backup-metadata')
    if (doc && Array.isArray(doc.body)) {
      backupMetadata.splice(0, backupMetadata.length, ...doc.body.slice(-100))
    }
  }
}

export async function addBoardCard(card: Omit<BoardCard, 'id'>) {
  return runExclusive('store:board', async () => {
    await syncBoardIfStale()
    const row = { ...card, id: randomUUID() }
    const backup = [...board]
    board.unshift(row)
    try {
      await commitDocument('campaign-board', board)
      return row
    } catch (err) {
      board.splice(0, board.length, ...backup)
      throw err
    }
  })
}

export async function removeBoardCard(id: string) {
  return runExclusive('store:board', async () => {
    await syncBoardIfStale()
    const index = board.findIndex((card) => card.id === id)
    if (index < 0) return false
    const backup = [...board]
    board.splice(index, 1)
    try {
      await commitDocument('campaign-board', board)
      return true
    } catch (err) {
      board.splice(0, board.length, ...backup)
      throw err
    }
  })
}

export async function proposeRules(
  next: Pick<CampaignRules, 'maxLevel' | 'subclassLevel' | 'startingXp' | 'shopBudgetCopper'> & {
    secondarySubclassLevel?: number
  },
  decision: 'keep-existing' | 'mark-review',
) {
  return runExclusive('store:rules', async () => {
    await syncRulesIfStale()
    const maxLevel = Math.min(MAX_CHARACTER_LEVEL, Math.max(1, next.maxLevel))
    const subclassLevel = Math.min(maxLevel, Math.max(1, next.subclassLevel))
    const secondarySubclassLevel = Math.min(
      maxLevel,
      Math.max(subclassLevel, next.secondarySubclassLevel ?? SECOND_SUBCLASS_CHOICE_LEVEL),
    )
    const affected = charactersOutsideRules(maxLevel, subclassLevel, secondarySubclassLevel)
    const prevRules = readRules()
    const saved: CampaignRules = {
      version: prevRules.version + 1,
      maxLevel,
      subclassLevel,
      secondarySubclassLevel,
      startingXp: Math.max(0, Math.floor(next.startingXp ?? prevRules.startingXp ?? 0)),
      shopBudgetCopper: Math.max(0, Math.floor(next.shopBudgetCopper ?? prevRules.shopBudgetCopper ?? 0)),
      updatedAt: new Date().toISOString(),
    }
    writeRules(saved)
    try {
      await commitDocument('campaign-rules', saved)
    } catch (err) {
      writeRules(prevRules)
      throw err
    }
    if (decision === 'mark-review') {
      const grouped = new Map<string, { email: string; characterId: string; reasons: string[] }>()
      for (const row of affected) {
        const key = `${row.email.toLowerCase()}::${row.characterId}`
        const cur = grouped.get(key) ?? { email: row.email, characterId: row.characterId, reasons: [] }
        cur.reasons.push(row.reason)
        grouped.set(key, cur)
      }
      for (const row of grouped.values()) {
        await noteRuleChange(
          row.email,
          row.characterId,
          `A regra mudou para a versão ${saved.version}. ${row.reasons.join(' ')}`,
        )
      }
    }
    return { rules: saved, decision, affected }
  })
}

export function listSecrets(sessionId?: string) {
  return secrets.filter((row) => !sessionId || row.sessionId === sessionId)
}

export async function addSecret(input: Omit<TableSecret, 'id' | 'createdAt'>) {
  return runExclusive('store:secrets', async () => {
    await syncSecretsIfStale()
    const row: TableSecret = { ...input, id: randomUUID(), createdAt: new Date().toISOString() }
    const backup = [...secrets]
    secrets.unshift(row)
    try {
      await commitDocument('mesa-secrets', secrets)
      return row
    } catch (err) {
      secrets.splice(0, secrets.length, ...backup)
      throw err
    }
  })
}

export async function removeSecret(id: string) {
  return runExclusive('store:secrets', async () => {
    await syncSecretsIfStale()
    const index = secrets.findIndex((row) => row.id === id)
    if (index < 0) return false
    const backup = [...secrets]
    secrets.splice(index, 1)
    try {
      await commitDocument('mesa-secrets', secrets)
      return true
    } catch (err) {
      secrets.splice(0, secrets.length, ...backup)
      throw err
    }
  })
}

export async function forgetSecretsForSession(sessionId: string) {
  return runExclusive('store:secrets', async () => {
    await syncSecretsIfStale()
    const next = secrets.filter((row) => row.sessionId !== sessionId)
    if (next.length === secrets.length) return
    const backup = [...secrets]
    secrets.splice(0, secrets.length, ...next)
    try {
      await commitDocument('mesa-secrets', secrets)
    } catch (err) {
      secrets.splice(0, secrets.length, ...backup)
      throw err
    }
  })
}

export function withTableSecrets<T extends { id: string }>(rows: T[], email?: string) {
  return rows.map((row) => {
    const { narratorNotes: _notes, sceneTrigger: _trigger, ...rest } = row as T & {
      narratorNotes?: string
      sceneTrigger?: string
    }
    const revealed = email ? secretsFor(row.id, email) : []
    return { ...rest, revealed }
  })
}

function secretsFor(entityId: string, email: string) {
  const sessions = new Set(seatedSessionIds(email))
  const key = email.trim().toLowerCase()
  return secrets
    .filter(
      (row) =>
        row.entityId === entityId &&
        sessions.has(row.sessionId) &&
        (!row.audienceEmail || row.audienceEmail.trim().toLowerCase() === key),
    )
    .map((row) => row.text)
}

export function readSavedFilters(email: string) {
  return filters.get(email.trim().toLowerCase()) ?? {}
}

export async function writeSavedFilters(email: string, patch: SavedFilter) {
  return runExclusive('store:filters', async () => {
    await syncFiltersIfStale()
    const key = email.trim().toLowerCase()
    const prev = filters.get(key)
    const next = { ...prev, ...patch }
    filters.set(key, next)
    try {
      await commitDocument('player-filters', Object.fromEntries(filters))
      return next
    } catch (err) {
      if (prev) filters.set(key, prev)
      else filters.delete(key)
      throw err
    }
  })
}

export function collectStorageManifest() {
  const urls = new Set<string>()
  const note = (value?: string | null) => {
    const trimmed = value?.trim()
    if (trimmed) urls.add(trimmed)
  }
  for (const profile of listProfiles()) {
    note(profile.avatarUrl)
    note(profile.bannerUrl)
    for (const character of profile.characters) note(character.portraitUrl)
  }
  for (const entity of listEntities()) {
    note(entity.imageUrl)
    note(entity.fileUrl)
  }
  return [...urls]
}

export function validateStorageManifest(paths: string[]) {
  const missing: string[] = []
  const ok: string[] = []
  for (const path of paths) {
    const trimmed = path.trim()
    if (!trimmed) continue
    if (trimmed.startsWith('data:') || trimmed.startsWith('http')) {
      ok.push(trimmed)
      continue
    }
    missing.push(trimmed)
  }
  return {
    total: paths.length,
    reachable: ok.length,
    needsManualCheck: missing.length,
    missing,
    note: 'URLs públicas e data URLs contam como referência. Arquivos privados no Storage exigem cópia externa separada.',
  }
}

const backupProfileSchema = z.object({
  email: z.string().email(),
  displayName: z.string().min(1),
  characters: z.array(
    z.object({
      id: z.string().min(1),
      name: z.string().min(1),
      species: z.string().min(1),
      level: z.number().int().min(0).max(20),
      hp: z.object({ current: z.number(), max: z.number() }),
    }).passthrough(),
  ),
}).passthrough()

const backupSessionSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  scheduledAt: z.string().min(1),
  status: z.enum(['scheduled', 'open', 'closed']).optional(),
}).passthrough()

const backupWalletSchema = z.object({
  gold: z.number().int().min(0),
  silver: z.number().int().min(0),
  copper: z.number().int().min(0),
})

const backupPayloadSchema = z
  .object({
    schemaVersion: z.string().optional(),
    exportedAt: z.string().optional(),
    profiles: z.array(backupProfileSchema).optional(),
    sessions: z.array(backupSessionSchema).optional(),
    handouts: z.array(z.object({ id: z.string().min(1) }).passthrough()).optional(),
    wallets: z.record(z.string(), backupWalletSchema).optional(),
  })
  .refine(
    (obj) =>
      Boolean(
        obj.profiles !== undefined ||
        obj.sessions !== undefined ||
        obj.handouts !== undefined ||
        obj.wallets !== undefined,
      ),
    { message: 'Arquivo de backup vazio ou sem seções reconhecidas.' },
  )

export function validateBackupPayload(raw: unknown): BackupFile {
  const parsed = backupPayloadSchema.safeParse(raw)
  if (!parsed.success) {
    throw new ValidationError(
      parsed.error.issues[0]?.message ?? 'Estrutura de backup inválida.',
      parsed.error.issues.map((i) => ({ field: i.path.join('.'), message: i.message })),
    )
  }
  const file = parsed.data as BackupFile
  const seenEmails = new Set<string>()
  const seenChars = new Set<string>()
  for (const p of file.profiles ?? []) {
    const email = p.email.trim().toLowerCase()
    if (seenEmails.has(email)) throw new ValidationError(`E-mail duplicado no backup: ${email}`)
    seenEmails.add(email)
    for (const c of p.characters ?? []) {
      if (seenChars.has(c.id)) throw new ValidationError(`ID de personagem duplicado no backup: ${c.id}`)
      seenChars.add(c.id)
    }
  }
  const seenSessions = new Set<string>()
  for (const s of file.sessions ?? []) {
    if (seenSessions.has(s.id)) throw new ValidationError(`ID de sessão duplicado no backup: ${s.id}`)
    seenSessions.add(s.id)
  }
  return file
}

export function drillBackup(raw: unknown) {
  const file = validateBackupPayload(raw)
  const profiles = file.profiles ?? []
  const characters = profiles.reduce((sum, profile) => sum + (profile.characters?.length ?? 0), 0)
  const items = profiles.reduce(
    (sum, profile) =>
      sum + profile.characters.reduce((inner, character) => inner + (character.inventory?.length ?? 0), 0),
    0,
  )
  const wallets = Object.values(file.wallets ?? {})
  const images = profiles.reduce((sum, profile) => {
    const portraits = profile.characters.filter((character) => character.portraitUrl).length
    return sum + portraits + (profile.avatarUrl ? 1 : 0) + (profile.bannerUrl ? 1 : 0)
  }, 0)
  const manifestUrls = new Set<string>()
  for (const profile of profiles) {
    if (profile.avatarUrl?.trim()) manifestUrls.add(profile.avatarUrl.trim())
    if (profile.bannerUrl?.trim()) manifestUrls.add(profile.bannerUrl.trim())
    for (const character of profile.characters ?? []) {
      if (character.portraitUrl?.trim()) manifestUrls.add(character.portraitUrl.trim())
    }
  }
  return {
    wrote: false,
    schemaVersion: file.schemaVersion ?? 'legacy',
    profiles: profiles.length,
    characters,
    inventoryItems: items,
    sessions: file.sessions?.length ?? 0,
    handouts: file.handouts?.length ?? 0,
    wallets: wallets.length,
    gold: wallets.reduce((sum, wallet) => sum + (wallet.gold ?? 0), 0),
    silver: wallets.reduce((sum, wallet) => sum + (wallet.silver ?? 0), 0),
    copper: wallets.reduce((sum, wallet) => sum + (wallet.copper ?? 0), 0),
    imageReferences: images,
    storageManifest: [...manifestUrls],
    storageNote: 'A cópia guarda referências. Os arquivos binários do Storage devem ter cópia externa separada.',
  }
}

export async function recordBackupMetadata(input: Omit<BackupMetadataEntry, 'id' | 'createdAt'>) {
  return runExclusive('store:backup-meta', async () => {
    await syncBackupMetaIfStale()
    const row: BackupMetadataEntry = {
      ...input,
      id: randomUUID(),
      createdAt: new Date().toISOString(),
    }
    const sb = getSupabaseAdmin()
    if (sb && (process.env.NODE_ENV !== 'test' || process.env.BELADONA_TEST_USE_ENV === 'true')) {
      const { error } = await sb.from('MetadadosBackup').insert({
        id: row.id,
        created_at: row.createdAt,
        scope: row.scope,
        schema_version: row.schemaVersion,
        status: row.status,
        record_counts: row.recordCounts,
        checksum_sha256: row.checksumSha256,
        external_ref: row.externalRef,
        verified_at: row.verifiedAt,
        operator_email: row.operatorEmail,
        notes: row.notes,
      })
      if (error && !/MetadadosBackup|schema cache|does not exist/i.test(error.message)) {
        console.warn('[backup] Falha ao gravar MetadadosBackup:', error.message)
      }
    }
    const prev = [...backupMetadata]
    backupMetadata.push(row)
    if (backupMetadata.length > 100) backupMetadata.splice(0, backupMetadata.length - 100)
    try {
      await commitDocument('backup-metadata', backupMetadata)
      return row
    } catch (err) {
      backupMetadata.splice(0, backupMetadata.length, ...prev)
      throw err
    }
  })
}

export function listBackupMetadata() {
  return [...backupMetadata].reverse()
}

/** Restaura backup com validação prévia, confirmação e rollback atômico (T19). */
export async function restoreBackup(raw: unknown, operatorEmail = 'system') {
  return runExclusive('store:restore', async () => {
    const file = validateBackupPayload(raw)
    const report = drillBackup(file)
    const prevProfiles = clone(listProfiles())
    const prevSessions = clone(listScheduledSessions())
    const prevHandouts = clone(listHandouts(true))
    const prevWallets = clone(listWalletSnapshot())

    try {
      if (file.profiles) await replaceProfiles(file.profiles)
      if (file.sessions !== undefined || file.handouts !== undefined) {
        await replaceSessionBundle(file.sessions, file.handouts)
      }
      if (file.wallets) await replaceWalletMap(file.wallets)

      const checksum = createHash('sha256').update(JSON.stringify(file)).digest('hex')
      await recordBackupMetadata({
        scope: 'logical_restore',
        schemaVersion: file.schemaVersion ?? SCHEMA_VERSION,
        status: 'verified',
        recordCounts: {
          profiles: report.profiles,
          characters: report.characters,
          sessions: report.sessions,
          wallets: report.wallets,
        },
        checksumSha256: checksum,
        externalRef: null,
        verifiedAt: new Date().toISOString(),
        operatorEmail,
        notes: 'Restauração lógica validada.',
      })
      await recordOperationStrict({
        email: operatorEmail,
        actorEmail: operatorEmail,
        kind: 'restore',
        summary: `Backup restaurado (${report.characters} fichas, ${report.sessions} mesas)`,
      })
      return { ...report, wrote: true, current: campaignSnapshot() }
    } catch (err) {
      await replaceProfiles(prevProfiles).catch(() => undefined)
      await replaceSessionBundle(prevSessions, prevHandouts).catch(() => undefined)
      await replaceWalletMap(prevWallets).catch(() => undefined)
      throw err
    }
  })
}

export function campaignSnapshot(user?: { email: string; role: string }) {
  const allProfiles = listProfiles()
  const allSessions = listScheduledSessions()
  const allHandouts = listHandouts(true)
  const scopedSessions =
    user && user.role !== 'admin'
      ? allSessions.filter((s) => s.narratorEmail && s.narratorEmail.toLowerCase() === user.email.toLowerCase())
      : allSessions
  const scopedSessionIds = new Set(scopedSessions.map((s) => s.id))
  const scopedHandouts =
    user && user.role !== 'admin'
      ? allHandouts.filter((h) => h.scheduledSessionId && scopedSessionIds.has(h.scheduledSessionId))
      : allHandouts

  return {
    schemaVersion: SCHEMA_VERSION,
    exportedAt: new Date().toISOString(),
    rules: readRules(),
    board: listBoard(),
    profiles: user && user.role !== 'admin' ? [] : allProfiles,
    sessions: scopedSessions,
    handouts: scopedHandouts,
    wallets: user && user.role !== 'admin' ? {} : listWalletSnapshot(),
    storageManifest: collectStorageManifest(),
    backupHistory: listBackupMetadata().slice(0, 10),
    openSeats: scopedSessions
      .filter((session) => session.status === 'open')
      .map((session) => ({ id: session.id, title: session.title, seats: openSeats(session.id).length })),
  }
}
