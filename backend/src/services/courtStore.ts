import { randomUUID } from 'node:crypto'
import { getEntity, getScheduledSession, type ChronicleEntity } from './chronicleStore.js'
import {
  checkRemoteDocumentRevision,
  commitDocument,
  documentWeight,
  getLoadedDocumentRevision,
  loadDocument,
  runExclusive,
} from './campaignDocuments.js'
import { recordOperationStrict } from './operationLog.js'
import { readJsonFile, writeJsonFile } from './localJson.js'
import { grantEntityToCharacter } from './itemGrant.js'
import {
  findProfileByPublicId,
  getProfile,
  listRegisteredPlayers,
  listSearchableAccounts,
  publicPlayerId,
} from './profileStore.js'
import { MAX_CHARACTER_LEVEL } from './progressionRules.js'

export type Coin = 'gold' | 'silver' | 'copper'

export const COIN_LABEL: Record<Coin, string> = {
  gold: 'ouro',
  silver: 'prata',
  copper: 'bronze',
}

const COIN_VALUE: Record<Coin, number> = { gold: 100, silver: 10, copper: 1 }
const RARITY_LEVEL: Record<string, number> = {
  comum: 1,
  incomum: 3,
  raro: 5,
  ancestral: 8,
  proibido: 10,
}

export type Achievement = {
  id: string
  title: string
  description: string
  howToEarn: string
  createdAt: string
}

export type AchievementUnlock = {
  achievementId: string
  email: string
  unlockedAt: string
  grantedBy: string
}

export type FriendLink = {
  id: string
  a: string
  b: string
  status: 'pending' | 'accepted'
  requestedBy: string
  createdAt: string
}

export type LedgerRow = {
  id: string
  email: string
  kind: 'credit' | 'debit'
  label: string
  amount: string
  at: string
}

export type AuctionBid = {
  id: string
  bidderEmail: string | null
  displayName: string
  amount: number
  coin: Coin
  npc: boolean
  withdrawn: boolean
  refunded: boolean
  at: string
}

export type Auction = {
  id: string
  sessionId: string
  entityId: string
  itemName: string
  requiredLevel: number
  endsAt: string
  status: 'open' | 'awarded' | 'cancelled'
  createdBy: string
  bids: AuctionBid[]
  winnerEmail: string | null
  winnerLabel: string | null
  granted: boolean
}

type CourtFile = {
  achievements: Achievement[]
  unlocks: AchievementUnlock[]
  friends: FriendLink[]
  wallets: Record<string, { gold: number; silver: number; copper: number }>
  ledger: LedgerRow[]
  auctions: Auction[]
  itemLevels: Record<string, number>
}

const DOC_ID = 'court'
const FILE = 'court.json'

function emptyFile(): CourtFile {
  return {
    achievements: [],
    unlocks: [],
    friends: [],
    wallets: {},
    ledger: [],
    auctions: [],
    itemLevels: {},
  }
}

let state: CourtFile = readJsonFile<CourtFile>(FILE) ?? emptyFile()

function clone<T>(v: T): T {
  return JSON.parse(JSON.stringify(v)) as T
}

async function saveCourt(): Promise<void> {
  await commitDocument(DOC_ID, state)
  if (process.env.NODE_ENV !== 'test') {
    writeJsonFile(FILE, state)
  }
}

export async function syncCourtIfStale() {
  const remoteRev = await checkRemoteDocumentRevision(DOC_ID)
  if (remoteRev > getLoadedDocumentRevision(DOC_ID)) {
    await hydrateCourt()
  }
}

export async function hydrateCourt() {
  const doc = await loadDocument<CourtFile>(DOC_ID)
  if (!doc || documentWeight(doc.body) === 0) return
  state = { ...emptyFile(), ...doc.body }
}

export function resetCourtForTests() {
  state = emptyFile()
}

export function snapshotCourtState(): CourtFile {
  return clone(state)
}

export function restoreCourtSnapshot(snapshot: CourtFile) {
  state = clone(snapshot)
}

async function runCourtMutation<T>(fn: () => Promise<T> | T): Promise<T> {
  return runExclusive('store:court', async () => {
    await syncCourtIfStale()
    const backup = snapshotCourtState()
    try {
      return await fn()
    } catch (err) {
      restoreCourtSnapshot(backup)
      throw err
    }
  })
}

function emailKey(email: string) {
  return email.trim().toLowerCase()
}

function pairKey(a: string, b: string) {
  return [emailKey(a), emailKey(b)].sort().join('|')
}

function findLink(a: string, b: string) {
  const key = pairKey(a, b)
  return state.friends.find((f) => pairKey(f.a, f.b) === key) ?? null
}

export function shopLevelOf(entity: Pick<ChronicleEntity, 'id' | 'rarity'> & { requiredLevel?: number }) {
  const stored = state.itemLevels[entity.id]
  if (stored && stored > 0) return Math.min(MAX_CHARACTER_LEVEL, stored)
  if (entity.requiredLevel && entity.requiredLevel > 0) {
    return Math.min(MAX_CHARACTER_LEVEL, entity.requiredLevel)
  }
  return RARITY_LEVEL[entity.rarity ?? ''] ?? 1
}

export async function setShopLevel(entityId: string, level: number) {
  return runCourtMutation(async () => {
    state.itemLevels[entityId] = Math.min(MAX_CHARACTER_LEVEL, Math.max(0, Math.round(level)))
    await saveCourt()
    return state.itemLevels[entityId]
  })
}

export function listShopLevels() {
  return { ...state.itemLevels }
}

export function entityPriceParts(entity: Pick<ChronicleEntity, 'priceGold' | 'priceSilver' | 'priceCopper'>) {
  const parts: { coin: Coin; amount: number }[] = []
  if ((entity.priceGold ?? 0) > 0) parts.push({ coin: 'gold' as const, amount: entity.priceGold ?? 0 })
  if ((entity.priceSilver ?? 0) > 0) parts.push({ coin: 'silver' as const, amount: entity.priceSilver ?? 0 })
  if ((entity.priceCopper ?? 0) > 0) parts.push({ coin: 'copper' as const, amount: entity.priceCopper ?? 0 })
  return parts
}

export function entityPrice(entity: Pick<ChronicleEntity, 'priceGold' | 'priceSilver' | 'priceCopper'>): {
  coin: Coin
  amount: number
} {
  return entityPriceParts(entity)[0] ?? { coin: 'silver' as const, amount: 0 }
}

export function hasWallet(email: string): boolean {
  return Boolean(state.wallets[emailKey(email)])
}

function ensureWalletForCredit(email: string) {
  const key = emailKey(email)
  if (!state.wallets[key]) state.wallets[key] = { gold: 0, silver: 0, copper: 0 }
  return state.wallets[key]
}

export function listWalletSnapshot() {
  return clone(state.wallets)
}

export async function replaceWalletMap(wallets: CourtFile['wallets']) {
  return runCourtMutation(async () => {
    state = { ...state, wallets: clone(wallets ?? {}) }
    await saveCourt()
  })
}

export function getCourtWallet(email: string) {
  const w = state.wallets[emailKey(email)]
  if (!w) return { gold: 0, silver: 0, copper: 0 }
  return { gold: w.gold, silver: w.silver, copper: w.copper }
}

export function listCourtLedger(email: string, options?: { limit?: number; offset?: number }) {
  const key = emailKey(email)
  const limit = Math.min(100, Math.max(1, options?.limit ?? 50))
  const offset = Math.max(0, options?.offset ?? 0)
  return state.ledger
    .filter((row) => row.email === key)
    .slice()
    .reverse()
    .slice(offset, offset + limit)
    .map(({ id, kind, label, amount, at }) => ({ id, kind, label, amount, at }))
}

function pushLedger(email: string, kind: 'credit' | 'debit', coin: Coin, amount: number, label: string) {
  state.ledger.push({
    id: randomUUID(),
    email: emailKey(email),
    kind,
    label,
    amount: `${kind === 'credit' ? '+' : '−'}${amount} ${COIN_LABEL[coin]}`,
    at: new Date().toISOString(),
  })
  if (state.ledger.length > 800) state.ledger = state.ledger.slice(-800)
}

type CoinMeta = { actorEmail?: string; sessionId?: string; operationId?: string }

export async function creditCoins(email: string, coin: Coin, amount: number, label: string, meta?: CoinMeta) {
  const qty = Math.max(0, Math.round(amount))
  if (qty <= 0) return getCourtWallet(email)
  return runCourtMutation(async () => {
    const w = ensureWalletForCredit(email)
    const before = String(w[coin])
    w[coin] += qty
    pushLedger(email, 'credit', coin, qty, label)
    const adjustment = /estorno|compens/i.test(label)
    await saveCourt()
    await recordOperationStrict({
      email,
      actorEmail: meta?.actorEmail?.trim() || email,
      kind: adjustment ? 'adjustment' : 'credit',
      summary: label,
      before,
      after: String(w[coin]),
      sessionId: meta?.sessionId,
      operationId: meta?.operationId,
    })
    return { ...w }
  })
}

export function applyDebitInMemory(email: string, coin: Coin, amount: number, label: string) {
  const qty = Math.round(amount)
  if (!Number.isFinite(qty) || qty < 0) {
    return { ok: false as const, error: 'Valor financeiro inválido.' }
  }
  if (qty === 0) return { ok: true as const, wallet: getCourtWallet(email), changed: false }
  const w = state.wallets[emailKey(email)]
  if (!w) {
    return { ok: false as const, error: 'Carteira não iniciada para esta conta.' }
  }
  if (w[coin] < qty) {
    return { ok: false as const, error: `Saldo insuficiente de ${COIN_LABEL[coin]}` }
  }
  const before = String(w[coin])
  w[coin] -= qty
  pushLedger(email, 'debit', coin, qty, label)
  return { ok: true as const, wallet: { ...w }, before, after: String(w[coin]), changed: true }
}

export async function commitCourtState() {
  await saveCourt()
}

export async function debitCoins(email: string, coin: Coin, amount: number, label: string, meta?: CoinMeta) {
  return runCourtMutation(async () => {
    const res = applyDebitInMemory(email, coin, amount, label)
    if (!res.ok) return res
    if (res.changed) {
      await saveCourt()
      await recordOperationStrict({
        email,
        actorEmail: meta?.actorEmail?.trim() || email,
        kind: 'debit',
        summary: label,
        before: res.before,
        after: res.after,
        sessionId: meta?.sessionId,
        operationId: meta?.operationId,
      })
    }
    return { ok: true as const, wallet: res.wallet }
  })
}

export function listAchievements() {
  return [...state.achievements].sort((a, b) => a.createdAt.localeCompare(b.createdAt))
}

export function muralFor(email: string) {
  const key = emailKey(email)
  return listAchievements().map((achievement) => {
    const unlock = state.unlocks.find((u) => u.achievementId === achievement.id && emailKey(u.email) === key)
    return {
      ...achievement,
      unlocked: Boolean(unlock),
      unlockedAt: unlock?.unlockedAt ?? null,
    }
  })
}

export async function createAchievement(input: { title: string; description: string; howToEarn: string }) {
  return runCourtMutation(async () => {
    const row: Achievement = {
      id: randomUUID(),
      title: input.title.trim(),
      description: input.description.trim(),
      howToEarn: input.howToEarn.trim(),
      createdAt: new Date().toISOString(),
    }
    state.achievements.push(row)
    await saveCourt()
    return row
  })
}

export async function deleteAchievement(id: string) {
  return runCourtMutation(async () => {
    const before = state.achievements.length
    state.achievements = state.achievements.filter((a) => a.id !== id)
    state.unlocks = state.unlocks.filter((u) => u.achievementId !== id)
    if (state.achievements.length === before) return false
    await saveCourt()
    return true
  })
}

export async function grantAchievement(email: string, achievementId: string, grantedBy: string) {
  return runCourtMutation(async () => {
    const achievement = state.achievements.find((a) => a.id === achievementId)
    if (!achievement) return { ok: false as const, error: 'Conquista não encontrada' }
    const key = emailKey(email)
    const existing = state.unlocks.find((u) => u.achievementId === achievementId && emailKey(u.email) === key)
    if (existing) return { ok: true as const, unlock: existing }
    const unlock: AchievementUnlock = {
      achievementId,
      email,
      unlockedAt: new Date().toISOString(),
      grantedBy,
    }
    state.unlocks.push(unlock)
    await saveCourt()
    return { ok: true as const, unlock }
  })
}

export function areFriends(a: string, b: string) {
  const link = findLink(a, b)
  return Boolean(link && link.status === 'accepted')
}

export function friendEmails(email: string) {
  const key = emailKey(email)
  return state.friends
    .filter((f) => f.status === 'accepted' && (emailKey(f.a) === key || emailKey(f.b) === key))
    .map((f) => (emailKey(f.a) === key ? f.b : f.a))
}

/** Projeção pública sem expor e-mail de terceiros (C26). */
function publicPlayer(email: string) {
  const profile = getProfile(email)
  const id = profile?.publicId ?? publicPlayerId(email)
  return {
    id,
    displayName: profile?.displayName ?? 'Cainita',
    handle: profile?.handle ?? `@${id}`,
    role: profile?.role ?? 'player',
    characters: profile?.characters.length ?? 0,
    memberSince: profile?.memberSince ?? null,
  }
}

function publicFriendLink(link: FriendLink) {
  return {
    id: link.id,
    status: link.status,
    createdAt: link.createdAt,
  }
}

export function listFriendCards(email: string) {
  return friendEmails(email).map((friend) => publicPlayer(friend))
}

export function listPendingFor(email: string) {
  const key = emailKey(email)
  return state.friends
    .filter((f) => f.status === 'pending' && emailKey(f.requestedBy) !== key && (emailKey(f.a) === key || emailKey(f.b) === key))
    .map((f) => ({
      id: f.id,
      from: publicPlayer(f.requestedBy),
      createdAt: f.createdAt,
    }))
}

export function listOutgoingFor(email: string) {
  const key = emailKey(email)
  return state.friends
    .filter((f) => f.status === 'pending' && emailKey(f.requestedBy) === key && (emailKey(f.a) === key || emailKey(f.b) === key))
    .map((f) => ({
      id: f.id,
      to: publicPlayer(emailKey(f.a) === key ? f.b : f.a),
      createdAt: f.createdAt,
    }))
}

export function searchPlayers(query: string, viewerEmail: string, limit = 20, includeEmpty = false) {
  const q = query.trim().toLowerCase()
  if (!includeEmpty && q.length < 2) return []
  const viewer = emailKey(viewerEmail)
  const safeLimit = Math.min(50, Math.max(1, limit))
  return listSearchableAccounts()
    .filter((p) => emailKey(p.email) !== viewer)
    .filter((p) => {
      if (!q) return true
      return (
        p.displayName.toLowerCase().includes(q) ||
        p.handle.toLowerCase().includes(q) ||
        p.id.toLowerCase().includes(q)
      )
    })
    .slice(0, safeLimit)
    .map((p) => {
      const link = findLink(viewerEmail, p.email)
      return {
        id: p.id,
        displayName: p.displayName,
        handle: p.handle,
        role: p.role,
        characters: p.characters,
        memberSince: p.memberSince,
        relation: !link
          ? ('none' as const)
          : link.status === 'accepted'
            ? ('friend' as const)
            : emailKey(link.requestedBy) === viewer
              ? ('outgoing' as const)
              : ('incoming' as const),
        linkId: link?.id ?? null,
      }
    })
}

export async function requestFriend(fromEmail: string, targetIdentifier: string, immediate = false) {
  return runCourtMutation(async () => {
    const target = findProfileByPublicId(targetIdentifier)
    if (!target) {
      return { ok: false as const, error: 'Usuário não encontrado' }
    }
    if (emailKey(fromEmail) === emailKey(target.email)) {
      return { ok: false as const, error: 'Não é possível adicionar a si mesmo' }
    }
    const existing = findLink(fromEmail, target.email)
    if (existing) {
      if (immediate && existing.status !== 'accepted') {
        existing.status = 'accepted'
        await saveCourt()
      }
      return { ok: true as const, link: publicFriendLink(existing) }
    }
    const link: FriendLink = {
      id: randomUUID(),
      a: fromEmail,
      b: target.email,
      status: immediate ? 'accepted' : 'pending',
      requestedBy: fromEmail,
      createdAt: new Date().toISOString(),
    }
    state.friends.push(link)
    await saveCourt()
    return { ok: true as const, link: publicFriendLink(link) }
  })
}

export async function acceptFriend(email: string, linkId: string) {
  return runCourtMutation(async () => {
    const link = state.friends.find((f) => f.id === linkId)
    if (!link) return { ok: false as const, error: 'Pedido não encontrado' }
    const key = emailKey(email)
    if (emailKey(link.a) !== key && emailKey(link.b) !== key) {
      return { ok: false as const, error: 'Pedido não encontrado' }
    }
    if (emailKey(link.requestedBy) === key) {
      return { ok: false as const, error: 'Aguarde o outro jogador aceitar' }
    }
    if (link.status === 'accepted') {
      return { ok: true as const, link: publicFriendLink(link) }
    }
    link.status = 'accepted'
    await saveCourt()
    return { ok: true as const, link: publicFriendLink(link) }
  })
}

export async function removeFriend(email: string, linkIdOrPlayerIdOrEmail: string) {
  return runCourtMutation(async () => {
    const key = emailKey(email)
    const targetProfile = findProfileByPublicId(linkIdOrPlayerIdOrEmail)
    const targetEmail = targetProfile ? emailKey(targetProfile.email) : emailKey(linkIdOrPlayerIdOrEmail)
    const before = state.friends.length
    state.friends = state.friends.filter((f) => {
      const involved = emailKey(f.a) === key || emailKey(f.b) === key
      if (!involved) return true
      if (f.id === linkIdOrPlayerIdOrEmail) return false
      if (emailKey(f.a) === targetEmail || emailKey(f.b) === targetEmail) return false
      return true
    })
    if (state.friends.length === before) return false
    await saveCourt()
    return true
  })
}

export function narratorFriendDirectory(narratorEmail: string) {
  const registered = listRegisteredPlayers()
  return {
    registeredCount: registered.length,
    friends: listFriendCards(narratorEmail),
    incoming: listPendingFor(narratorEmail),
    outgoing: listOutgoingFor(narratorEmail),
    roster: searchPlayers('', narratorEmail, 500, true),
  }
}

function bidWorth(bid: AuctionBid) {
  return bid.amount * COIN_VALUE[bid.coin]
}

function refundBidInMemory(bid: AuctionBid, label: string) {
  if (bid.npc || !bid.bidderEmail || bid.refunded) return
  const qty = Math.max(0, Math.round(bid.amount))
  if (qty <= 0) return
  const w = ensureWalletForCredit(bid.bidderEmail)
  w[bid.coin] += qty
  pushLedger(bid.bidderEmail, 'credit', bid.coin, qty, label)
  bid.refunded = true
}

async function settleAuction(auction: Auction, force = false) {
  if (auction.status !== 'open') return auction
  const active = auction.bids.filter((b) => !b.withdrawn)
  const expired = new Date(auction.endsAt).getTime() <= Date.now()
  const someoneLeft = auction.bids.some((b) => b.withdrawn)
  const early = someoneLeft && active.length === 1
  if (!force && !expired && !early) return auction
  if (!force && !expired && active.length === 0) return auction

  if (active.length === 0) {
    auction.status = 'cancelled'
    auction.granted = true
    return auction
  }
  const winner = [...active].sort((a, b) => bidWorth(b) - bidWorth(a) || a.at.localeCompare(b.at))[0]
  for (const bid of active) {
    if (bid.id !== winner.id) refundBidInMemory(bid, `Lance superado · ${auction.itemName}`)
  }
  auction.status = 'awarded'
  auction.winnerLabel = winner.displayName
  auction.winnerEmail = winner.npc ? null : winner.bidderEmail
  auction.granted = winner.npc || !winner.bidderEmail
  if (!auction.granted && winner.bidderEmail) {
    const entity = getEntity(auction.entityId)
    const session = getScheduledSession(auction.sessionId)
    const seat = session?.seats?.find((s) => !s.leftAt && emailKey(s.email) === emailKey(winner.bidderEmail!))
    if (entity && (await grantEntityToCharacter(winner.bidderEmail, seat?.characterId, entity))) {
      auction.granted = true
    }
  }
  return auction
}

export async function settleOpenAuctions() {
  return runCourtMutation(async () => {
    let changed = false
    for (const auction of state.auctions) {
      const beforeStatus = auction.status
      const beforeGranted = auction.granted
      await settleAuction(auction)
      if (auction.status !== beforeStatus || auction.granted !== beforeGranted) changed = true
    }
    if (changed) await saveCourt()
  })
}

export function getAuction(auctionId: string) {
  return state.auctions.find((a) => a.id === auctionId) ?? null
}

function sanitizeAuction(a: Auction) {
  const { winnerEmail: _we, ...rest } = a
  return {
    ...rest,
    bids: a.bids.map(({ bidderEmail: _be, ...bid }) => bid),
    leading: [...a.bids.filter((b) => !b.withdrawn)]
      .sort((x, y) => bidWorth(y) - bidWorth(x))
      .map(({ bidderEmail: _be, ...bid }) => bid)[0] ?? null,
  }
}

export async function listAuctions(sessionId?: string) {
  await settleOpenAuctions()
  return state.auctions
    .filter((a) => (sessionId ? a.sessionId === sessionId : true))
    .map(sanitizeAuction)
}

export async function releaseAuction(input: {
  sessionId: string
  entityId: string
  requiredLevel: number
  minutes: number
  createdBy: string
  npcName?: string
  npcAmount?: number
  npcCoin?: Coin
}) {
  return runCourtMutation(async () => {
    const entity = getEntity(input.entityId)
    if (!entity || entity.visibility !== 'published') {
      return { ok: false as const, error: 'Item da loja não publicado' }
    }
    const minutes = Math.min(180, Math.max(1, Math.round(input.minutes)))
    const auction: Auction = {
      id: randomUUID(),
      sessionId: input.sessionId,
      entityId: entity.id,
      itemName: entity.name,
      requiredLevel: Math.min(MAX_CHARACTER_LEVEL, Math.max(0, Math.round(input.requiredLevel || shopLevelOf(entity)))),
      endsAt: new Date(Date.now() + minutes * 60_000).toISOString(),
      status: 'open',
      createdBy: input.createdBy,
      bids: [],
      winnerEmail: null,
      winnerLabel: null,
      granted: false,
    }
    if (input.npcName?.trim() && (input.npcAmount ?? 0) > 0 && input.npcCoin) {
      auction.bids.push({
        id: randomUUID(),
        bidderEmail: null,
        displayName: input.npcName.trim(),
        amount: Math.round(input.npcAmount ?? 0),
        coin: input.npcCoin,
        npc: true,
        withdrawn: false,
        refunded: false,
        at: new Date().toISOString(),
      })
    }
    state.auctions.push(auction)
    await saveCourt()
    return { ok: true as const, auction: sanitizeAuction(auction) }
  })
}

export async function addNpcBid(auctionId: string, displayName: string, amount: number, coin: Coin) {
  return runCourtMutation(async () => {
    const auction = state.auctions.find((a) => a.id === auctionId)
    if (!auction || auction.status !== 'open' || new Date(auction.endsAt).getTime() <= Date.now()) {
      return { ok: false as const, error: 'Leilão encerrado' }
    }
    auction.bids.push({
      id: randomUUID(),
      bidderEmail: null,
      displayName: displayName.trim(),
      amount: Math.max(1, Math.round(amount)),
      coin,
      npc: true,
      withdrawn: false,
      refunded: false,
      at: new Date().toISOString(),
    })
    await saveCourt()
    return { ok: true as const, auction: sanitizeAuction(auction) }
  })
}

export async function placeBid(input: {
  auctionId: string
  email: string
  displayName: string
  amount: number
  coin: Coin
  level: number
}) {
  return runCourtMutation(async () => {
    for (const a of state.auctions) {
      if (a.status === 'open') await settleAuction(a)
    }
    const auction = state.auctions.find((a) => a.id === input.auctionId)
    if (!auction || auction.status !== 'open' || new Date(auction.endsAt).getTime() <= Date.now()) {
      return { ok: false as const, error: 'Leilão encerrado' }
    }
    if (!hasWallet(input.email)) {
      return { ok: false as const, error: 'Carteira não iniciada para dar lances.' }
    }
    if (input.level < auction.requiredLevel) {
      return { ok: false as const, error: `Nível ${auction.requiredLevel} necessário para este lote` }
    }
    const amount = Math.max(1, Math.round(input.amount))
    const mine = auction.bids.find(
      (b) => !b.withdrawn && b.bidderEmail && emailKey(b.bidderEmail) === emailKey(input.email),
    )
    const rivals = auction.bids.filter((b) => !b.withdrawn && b !== mine)
    const topRival = [...rivals].sort((a, b) => bidWorth(b) - bidWorth(a))[0]
    if (topRival && amount * COIN_VALUE[input.coin] <= bidWorth(topRival)) {
      return { ok: false as const, error: 'O lance precisa superar o maior valor' }
    }
    const purse = getCourtWallet(input.email)
    const available = purse[input.coin] + (mine && mine.coin === input.coin && !mine.refunded ? mine.amount : 0)
    if (available < amount) return { ok: false as const, error: `Saldo insuficiente de ${COIN_LABEL[input.coin]}` }
    if (mine) {
      mine.withdrawn = true
      refundBidInMemory(mine, `Lance refeito · ${auction.itemName}`)
    }
    const paid = applyDebitInMemory(input.email, input.coin, amount, `Lance · ${auction.itemName}`)
    if (!paid.ok) return paid
    auction.bids.push({
      id: randomUUID(),
      bidderEmail: input.email,
      displayName: input.displayName,
      amount,
      coin: input.coin,
      npc: false,
      withdrawn: false,
      refunded: false,
      at: new Date().toISOString(),
    })
    await saveCourt()
    return { ok: true as const, auction: sanitizeAuction(auction) }
  })
}

export async function withdrawBid(auctionId: string, email: string) {
  return runCourtMutation(async () => {
    const auction = state.auctions.find((a) => a.id === auctionId)
    if (!auction || auction.status !== 'open') return { ok: false as const, error: 'Leilão encerrado' }
    const mine = auction.bids.find(
      (b) => !b.withdrawn && b.bidderEmail && emailKey(b.bidderEmail) === emailKey(email),
    )
    if (!mine) return { ok: false as const, error: 'Você não tem lance ativo' }
    mine.withdrawn = true
    refundBidInMemory(mine, `Desistência · ${auction.itemName}`)
    await settleAuction(auction)
    await saveCourt()
    return { ok: true as const, auction: sanitizeAuction(auction) }
  })
}

export async function closeAuction(auctionId: string) {
  return runCourtMutation(async () => {
    const auction = state.auctions.find((a) => a.id === auctionId)
    if (!auction) return { ok: false as const, error: 'Leilão não encontrado' }
    await settleAuction(auction, true)
    await saveCourt()
    return { ok: true as const, auction: sanitizeAuction(auction) }
  })
}
