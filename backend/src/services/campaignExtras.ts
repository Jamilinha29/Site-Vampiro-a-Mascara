import { randomUUID } from 'crypto'
import { documentWeight, loadDocument, rememberDocument } from './campaignDocuments.js'
import {
  listEntities,
  listHandouts,
  listScheduledSessions,
  openSeats,
  replaceSessionBundle,
  seatedSessionIds,
} from './chronicleStore.js'
import { listWalletSnapshot, replaceWalletMap } from './courtStore.js'
import {
  charactersOutsideRules,
  listProfiles,
  noteRuleChange,
  replaceProfiles,
  type UserProfile,
} from './profileStore.js'
import { readRules, writeRules, type CampaignRules } from './rulesState.js'
import type { ScheduledSession, SessionHandout } from './chronicleStore.js'

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

type BackupFile = {
  profiles?: UserProfile[]
  sessions?: ScheduledSession[]
  handouts?: SessionHandout[]
  wallets?: ReturnType<typeof listWalletSnapshot>
}

const board: BoardCard[] = []
const secrets: TableSecret[] = []
const filters = new Map<string, SavedFilter>()

function rememberBoard() {
  rememberDocument('campaign-board', board)
}
function rememberSecrets() {
  rememberDocument('mesa-secrets', secrets)
}
function rememberFilters() {
  rememberDocument('player-filters', Object.fromEntries(filters))
}

export async function hydrateCampaignExtras() {
  const [boardDoc, secretDoc, filterDoc, rulesDoc] = await Promise.all([
    loadDocument<BoardCard[]>('campaign-board'),
    loadDocument<TableSecret[]>('mesa-secrets'),
    loadDocument<Record<string, SavedFilter>>('player-filters'),
    loadDocument<CampaignRules>('campaign-rules'),
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
      startingXp: rulesDoc.body.startingXp ?? 0,
      shopBudgetCopper: rulesDoc.body.shopBudgetCopper ?? 0,
    })
  }
}

export function listBoard() {
  return [...board]
}

export function addBoardCard(card: Omit<BoardCard, 'id'>) {
  const row = { ...card, id: randomUUID() }
  board.unshift(row)
  rememberBoard()
  return row
}

export function removeBoardCard(id: string) {
  const index = board.findIndex((card) => card.id === id)
  if (index < 0) return false
  board.splice(index, 1)
  rememberBoard()
  return true
}

export function proposeRules(
  next: Pick<CampaignRules, 'maxLevel' | 'subclassLevel' | 'startingXp' | 'shopBudgetCopper'>,
  decision: 'keep-existing' | 'mark-review',
) {
  const affected = charactersOutsideRules(next.maxLevel, next.subclassLevel)
  const saved: CampaignRules = {
    version: readRules().version + 1,
    maxLevel: next.maxLevel,
    subclassLevel: next.subclassLevel,
    startingXp: Math.max(0, Math.floor(next.startingXp ?? readRules().startingXp ?? 0)),
    shopBudgetCopper: Math.max(0, Math.floor(next.shopBudgetCopper ?? readRules().shopBudgetCopper ?? 0)),
    updatedAt: new Date().toISOString(),
  }
  writeRules(saved)
  rememberDocument('campaign-rules', saved)
  if (decision === 'mark-review') {
    for (const row of affected) {
      noteRuleChange(row.email, row.characterId, `A regra mudou para a versão ${saved.version}. ${row.reason}`)
    }
  }
  return { rules: saved, decision, affected }
}

export function listSecrets(sessionId?: string) {
  return secrets.filter((row) => !sessionId || row.sessionId === sessionId)
}

export function addSecret(input: Omit<TableSecret, 'id' | 'createdAt'>) {
  const row: TableSecret = { ...input, id: randomUUID(), createdAt: new Date().toISOString() }
  secrets.unshift(row)
  rememberSecrets()
  return row
}

export function removeSecret(id: string) {
  const index = secrets.findIndex((row) => row.id === id)
  if (index < 0) return false
  secrets.splice(index, 1)
  rememberSecrets()
  return true
}

export function forgetSecretsForSession(sessionId: string) {
  const next = secrets.filter((row) => row.sessionId !== sessionId)
  if (next.length === secrets.length) return
  secrets.splice(0, secrets.length, ...next)
  rememberSecrets()
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

export function writeSavedFilters(email: string, patch: SavedFilter) {
  const key = email.trim().toLowerCase()
  const next = { ...filters.get(key), ...patch }
  filters.set(key, next)
  rememberFilters()
  return next
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
  for (const handout of listHandouts(true)) {
    for (const monster of handout.monstersSlain ?? []) note(monster.statsText)
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
    note: 'URLs públicas e data URLs contam como referência. Arquivos no Storage exigem credencial no painel.',
  }
}

export function drillBackup(file: BackupFile) {
  const profiles = file.profiles ?? []
  const characters = profiles.reduce((sum, profile) => sum + (profile.characters?.length ?? 0), 0)
  const items = profiles.reduce(
    (sum, profile) => sum + profile.characters.reduce((inner, character) => inner + (character.inventory?.length ?? 0), 0),
    0,
  )
  const wallets = Object.values(file.wallets ?? {})
  const images = profiles.reduce((sum, profile) => {
    const portraits = profile.characters.filter((character) => character.portraitUrl).length
    return sum + portraits + (profile.avatarUrl ? 1 : 0) + (profile.bannerUrl ? 1 : 0)
  }, 0)
  return {
    wrote: false,
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
    storageManifest: collectStorageManifest(),
    storageNote: 'A cópia guarda o endereço da imagem. O arquivo em si continua no Storage.',
  }
}

export function restoreBackup(file: BackupFile) {
  const report = drillBackup(file)
  if (file.profiles) replaceProfiles(file.profiles)
  if (file.sessions) replaceSessionBundle(file.sessions, file.handouts)
  if (file.wallets) replaceWalletMap(file.wallets)
  return { ...report, wrote: true, current: campaignSnapshot() }
}

export function campaignSnapshot() {
  const profiles = listProfiles()
  return {
    exportedAt: new Date().toISOString(),
    rules: readRules(),
    board: listBoard(),
    profiles,
    sessions: listScheduledSessions(),
    handouts: listHandouts(true),
    wallets: listWalletSnapshot(),
    storageManifest: collectStorageManifest(),
    openSeats: listScheduledSessions()
      .filter((session) => session.status === 'open')
      .map((session) => ({ id: session.id, title: session.title, seats: openSeats(session.id).length })),
  }
}
