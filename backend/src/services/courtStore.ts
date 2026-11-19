import { randomUUID } from 'crypto'
import { getEntity, type ChronicleEntity } from './chronicleStore.js'
import { documentWeight, loadDocument, rememberDocument } from './campaignDocuments.js'
import { readJsonFile, writeJsonFile } from './localJson.js'
import { grantEntityToCharacter } from './itemGrant.js'
import { getProfile, listRegisteredPlayers } from './profileStore.js'

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
  raro: 6,
  ancestral: 10,
  proibido: 14,
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

function save() {
  if (process.env.NODE_ENV === 'test') return
  writeJsonFile(FILE, state)
  rememberDocument('court', state)
}

export async function hydrateCourt() {
  const doc = await loadDocument<CourtFile>('court')
  if (!doc || documentWeight(doc.body) === 0) return
  state = { ...emptyFile(), ...doc.body }
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
  if (stored && stored > 0) return stored
  if (entity.requiredLevel && entity.requiredLevel > 0) return entity.requiredLevel
  return RARITY_LEVEL[entity.rarity ?? ''] ?? 1
}

export function setShopLevel(entityId: string, level: number) {
  state.itemLevels[entityId] = Math.min(20, Math.max(1, Math.round(level)))
  save()
  return state.itemLevels[entityId]
}

export function listShopLevels() {
  return { ...state.itemLevels }
}

export function entityPrice(entity: Pick<ChronicleEntity, 'priceGold' | 'priceSilver' | 'priceCopper'>): {
  coin: Coin
  amount: number
} {
  if ((entity.priceGold ?? 0) > 0) return { coin: 'gold', amount: entity.priceGold ?? 0 }
  if ((entity.priceSilver ?? 0) > 0) return { coin: 'silver', amount: entity.priceSilver ?? 0 }
  if ((entity.priceCopper ?? 0) > 0) return { coin: 'copper', amount: entity.priceCopper ?? 0 }
  return { coin: 'silver', amount: 0 }
}

function walletOf(email: string) {
  const key = emailKey(email)
  if (!state.wallets[key]) state.wallets[key] = { gold: 0, silver: 0, copper: 0 }
  return state.wallets[key]
}

export function getCourtWallet(email: string) {
  const w = walletOf(email)
  return { gold: w.gold, silver: w.silver, copper: w.copper }
}

export function listCourtLedger(email: string) {
  const key = emailKey(email)
  return state.ledger
    .filter((row) => row.email === key)
    .slice()
    .reverse()
    .slice(0, 50)
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
  if (state.ledger.length > 400) state.ledger = state.ledger.slice(-400)
}

export function creditCoins(email: string, coin: Coin, amount: number, label: string) {
  const qty = Math.max(0, Math.round(amount))
  if (qty <= 0) return getCourtWallet(email)
  const w = walletOf(email)
  w[coin] += qty
  pushLedger(email, 'credit', coin, qty, label)
  save()
  return { ...w }
}

export function debitCoins(email: string, coin: Coin, amount: number, label: string) {
  const qty = Math.max(0, Math.round(amount))
  const w = walletOf(email)
  if (qty === 0) return { ok: true as const, wallet: { ...w } }
  if (w[coin] < qty) return { ok: false as const, error: `Saldo insuficiente de ${COIN_LABEL[coin]}` }
  w[coin] -= qty
  pushLedger(email, 'debit', coin, qty, label)
  save()
  return { ok: true as const, wallet: { ...w } }
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

export function createAchievement(input: { title: string; description: string; howToEarn: string }) {
  const row: Achievement = {
    id: randomUUID(),
    title: input.title.trim(),
    description: input.description.trim(),
    howToEarn: input.howToEarn.trim(),
    createdAt: new Date().toISOString(),
  }
  state.achievements.push(row)
  save()
  return row
}

export function deleteAchievement(id: string) {
  const before = state.achievements.length
  state.achievements = state.achievements.filter((a) => a.id !== id)
  state.unlocks = state.unlocks.filter((u) => u.achievementId !== id)
  if (state.achievements.length === before) return false
  save()
  return true
}

export function grantAchievement(email: string, achievementId: string, grantedBy: string) {
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
  save()
  return { ok: true as const, unlock }
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

function publicPlayer(email: string) {
  const profile = getProfile(email)
  return {
    email,
    displayName: profile?.displayName ?? email,
    handle: profile?.handle ?? email,
    characters: profile?.characters.length ?? 0,
    memberSince: profile?.memberSince ?? null,
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

export function searchPlayers(query: string, viewerEmail: string, limit = 20) {
  const q = query.trim().toLowerCase()
  const viewer = emailKey(viewerEmail)
  return listRegisteredPlayers()
    .filter((p) => emailKey(p.email) !== viewer)
    .filter((p) => {
      if (!q) return true
      return (
        p.displayName.toLowerCase().includes(q) ||
        p.handle.toLowerCase().includes(q) ||
        p.email.toLowerCase().includes(q)
      )
    })
    .slice(0, limit)
    .map((p) => {
      const link = findLink(viewerEmail, p.email)
      return {
        ...p,
        relation: !link ? 'none' : link.status === 'accepted' ? 'friend' : emailKey(link.requestedBy) === viewer ? 'outgoing' : 'incoming',
        linkId: link?.id ?? null,
      }
    })
}

export function requestFriend(fromEmail: string, toEmail: string, immediate = false) {
  if (emailKey(fromEmail) === emailKey(toEmail)) {
    return { ok: false as const, error: 'Não é possível adicionar a si mesmo' }
  }
  const target = getProfile(toEmail)
  if (!target || target.role !== 'player') {
    return { ok: false as const, error: 'Jogador não encontrado' }
  }
  const existing = findLink(fromEmail, toEmail)
  if (existing) {
    if (immediate && existing.status !== 'accepted') {
      existing.status = 'accepted'
      save()
    }
    return { ok: true as const, link: existing }
  }
  const link: FriendLink = {
    id: randomUUID(),
    a: fromEmail,
    b: toEmail,
    status: immediate ? 'accepted' : 'pending',
    requestedBy: fromEmail,
    createdAt: new Date().toISOString(),
  }
  state.friends.push(link)
  save()
  return { ok: true as const, link }
}

export function acceptFriend(email: string, linkId: string) {
  const link = state.friends.find((f) => f.id === linkId)
  if (!link) return { ok: false as const, error: 'Pedido não encontrado' }
  const key = emailKey(email)
  if (emailKey(link.a) !== key && emailKey(link.b) !== key) {
    return { ok: false as const, error: 'Pedido não encontrado' }
  }
  if (emailKey(link.requestedBy) === key) {
    return { ok: false as const, error: 'Aguarde o outro jogador aceitar' }
  }
  link.status = 'accepted'
  save()
  return { ok: true as const, link }
}

export function removeFriend(email: string, linkIdOrFriendEmail: string) {
  const key = emailKey(email)
  const before = state.friends.length
  state.friends = state.friends.filter((f) => {
    const involved = emailKey(f.a) === key || emailKey(f.b) === key
    if (!involved) return true
    if (f.id === linkIdOrFriendEmail) return false
    if (emailKey(f.a) === emailKey(linkIdOrFriendEmail) || emailKey(f.b) === emailKey(linkIdOrFriendEmail)) return false
    return true
  })
  if (state.friends.length === before) return false
  save()
  return true
}

export function narratorFriendDirectory(narratorEmail: string) {
  const registered = listRegisteredPlayers()
  return {
    registeredCount: registered.length,
    friends: listFriendCards(narratorEmail),
    incoming: listPendingFor(narratorEmail),
    outgoing: listOutgoingFor(narratorEmail),
    roster: searchPlayers('', narratorEmail, 500),
  }
}

function bidWorth(bid: AuctionBid) {
  return bid.amount * COIN_VALUE[bid.coin]
}

function refundBid(bid: AuctionBid, label: string) {
  if (bid.npc || !bid.bidderEmail || bid.refunded) return
  creditCoins(bid.bidderEmail, bid.coin, bid.amount, label)
  bid.refunded = true
}

function settleAuction(auction: Auction, force = false) {
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
    if (bid.id !== winner.id) refundBid(bid, `Lance superado · ${auction.itemName}`)
  }
  auction.status = 'awarded'
  auction.winnerLabel = winner.displayName
  auction.winnerEmail = winner.npc ? null : winner.bidderEmail
  auction.granted = winner.npc || !winner.bidderEmail
  if (!auction.granted && winner.bidderEmail) {
    const entity = getEntity(auction.entityId)
    if (entity && grantEntityToCharacter(winner.bidderEmail, undefined, entity)) {
      auction.granted = true
    }
  }
  return auction
}

export function settleOpenAuctions() {
  let changed = false
  for (const auction of state.auctions) {
    const beforeStatus = auction.status
    const beforeGranted = auction.granted
    settleAuction(auction)
    if (auction.status !== beforeStatus || auction.granted !== beforeGranted) changed = true
  }
  if (changed) save()
}

export function listAuctions(sessionId?: string) {
  settleOpenAuctions()
  return state.auctions
    .filter((a) => (sessionId ? a.sessionId === sessionId : true))
    .map((a) => ({
      ...a,
      leading: [...a.bids.filter((b) => !b.withdrawn)].sort((x, y) => bidWorth(y) - bidWorth(x))[0] ?? null,
    }))
}

export function releaseAuction(input: {
  sessionId: string
  entityId: string
  requiredLevel: number
  minutes: number
  createdBy: string
  npcName?: string
  npcAmount?: number
  npcCoin?: Coin
}) {
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
    requiredLevel: Math.min(20, Math.max(1, Math.round(input.requiredLevel || shopLevelOf(entity)))),
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
  save()
  return { ok: true as const, auction }
}

export function addNpcBid(auctionId: string, displayName: string, amount: number, coin: Coin) {
  const auction = state.auctions.find((a) => a.id === auctionId)
  if (!auction || auction.status !== 'open') return { ok: false as const, error: 'Leilão encerrado' }
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
  save()
  return { ok: true as const, auction }
}

export function placeBid(input: {
  auctionId: string
  email: string
  displayName: string
  amount: number
  coin: Coin
  level: number
}) {
  settleOpenAuctions()
  const auction = state.auctions.find((a) => a.id === input.auctionId)
  if (!auction || auction.status !== 'open') return { ok: false as const, error: 'Leilão encerrado' }
  if (input.level < auction.requiredLevel) {
    return { ok: false as const, error: `Nível ${auction.requiredLevel} necessário para este lote` }
  }
  const amount = Math.max(1, Math.round(input.amount))
  const mine = auction.bids.find((b) => !b.withdrawn && b.bidderEmail && emailKey(b.bidderEmail) === emailKey(input.email))
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
    refundBid(mine, `Lance refeito · ${auction.itemName}`)
  }
  const paid = debitCoins(input.email, input.coin, amount, `Lance · ${auction.itemName}`)
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
  save()
  return { ok: true as const, auction }
}

export function withdrawBid(auctionId: string, email: string) {
  const auction = state.auctions.find((a) => a.id === auctionId)
  if (!auction || auction.status !== 'open') return { ok: false as const, error: 'Leilão encerrado' }
  const mine = auction.bids.find((b) => !b.withdrawn && b.bidderEmail && emailKey(b.bidderEmail) === emailKey(email))
  if (!mine) return { ok: false as const, error: 'Você não tem lance ativo' }
  mine.withdrawn = true
  refundBid(mine, `Desistência · ${auction.itemName}`)
  settleAuction(auction)
  save()
  return { ok: true as const, auction }
}

export function closeAuction(auctionId: string) {
  const auction = state.auctions.find((a) => a.id === auctionId)
  if (!auction) return { ok: false as const, error: 'Leilão não encontrado' }
  settleAuction(auction, true)
  save()
  return { ok: true as const, auction }
}
