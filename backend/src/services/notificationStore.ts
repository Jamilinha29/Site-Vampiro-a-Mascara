import { randomUUID } from 'node:crypto'
import { listHandouts, listPublishedSessionsForPlayers } from './chronicleStore.js'
import { commitDocument, documentWeight, loadDocument, runExclusive } from './campaignDocuments.js'
import { readJsonFile, writeJsonFile } from './localJson.js'

export type NotificationKind = 'session' | 'chronicle' | 'system' | 'news'

export type AppNotification = {
  id: string
  kind: NotificationKind
  title: string
  message: string
  createdAt: string
  href: string | null
  unread: boolean
}

const readByUser = new Map<string, Set<string>>()

export type SentNotice = {
  id: string
  title: string
  message: string
  senderEmail?: string
  senderName?: string
  createdAt: string
  href: string | null
}

const NOTICE_FILE = 'sent-notices.json'
const sentNotices: SentNotice[] = readJsonFile<SentNotice[]>(NOTICE_FILE) ?? []

function emailKey(email: string) {
  return email.trim().toLowerCase()
}

export function listSentNotices() {
  return [...sentNotices]
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .map(({ senderEmail: _senderEmail, ...rest }) => rest)
}

export async function createSentNotice(input: {
  title: string
  message: string
  href?: string | null
  senderEmail?: string
  senderName?: string
}) {
  return runExclusive('store:notices', async () => {
    const row: SentNotice = {
      id: randomUUID(),
      title: input.title.trim(),
      message: input.message.trim(),
      senderEmail: input.senderEmail,
      senderName: input.senderName,
      createdAt: new Date().toISOString(),
      href: input.href?.trim() || '/user',
    }
    const backup = [...sentNotices]
    sentNotices.unshift(row)
    try {
      await commitDocument('notices', sentNotices)
      writeJsonFile(NOTICE_FILE, sentNotices)
      const { senderEmail: _senderEmail, ...publicRow } = row
      return publicRow
    } catch (err) {
      sentNotices.splice(0, sentNotices.length, ...backup)
      throw err
    }
  })
}

export async function hydrateNotices() {
  const [doc, readsDoc] = await Promise.all([
    loadDocument<SentNotice[]>('notices'),
    loadDocument<Record<string, string[]>>('notification-reads'),
  ])
  if (doc && documentWeight(doc.body) > 0) {
    sentNotices.splice(0, sentNotices.length, ...doc.body)
  }
  if (readsDoc && readsDoc.body) {
    readByUser.clear()
    for (const [k, ids] of Object.entries(readsDoc.body)) {
      readByUser.set(emailKey(k), new Set(ids))
    }
  }
}

export function resetNoticesForTests() {
  sentNotices.length = 0
  readByUser.clear()
}

function formatSessionWhen(iso: string) {
  return new Date(iso).toLocaleString('pt-BR', {
    weekday: 'short',
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function mesaLabel(chronicleName: string | undefined, title: string) {
  return chronicleName?.trim() || title.replace(/^Mesa\s*[—-]\s*/i, '').trim() || title
}

export function listNotificationsForUser(email: string): AppNotification[] {
  const key = emailKey(email)
  const read = readByUser.get(key) ?? new Set<string>()
  const now = Date.now()
  const items: AppNotification[] = []

  // Somente sessões públicas ou em que o usuário participa (não vazar sessões privadas)
  const sessions = listPublishedSessionsForPlayers(email)
    .filter((s) => new Date(s.scheduledAt).getTime() >= now - 86_400_000)
    .sort((a, b) => a.scheduledAt.localeCompare(b.scheduledAt))

  for (const s of sessions) {
    const id = `session-${s.id}`
    const upcoming = new Date(s.scheduledAt).getTime() >= now
    items.push({
      id,
      kind: 'session',
      title: upcoming ? 'Sessão de RPG marcada' : 'Sessão recente',
      message: `${mesaLabel(s.chronicleName, s.title)} · ${formatSessionWhen(s.scheduledAt)}`,
      createdAt: s.scheduledAt,
      href: `/user/sessions/${s.id}/table`,
      unread: !read.has(id),
    })
  }

  const visibleSessionIds = new Set(sessions.map((s) => s.id))
  const chronicles = listHandouts(false)
    .filter((h) => h.status === 'closed' && h.publishedToPlayers)
    .filter((h) => !h.scheduledSessionId || visibleSessionIds.has(h.scheduledSessionId))
    .sort((a, b) => (b.closedAt ?? b.createdAt).localeCompare(a.closedAt ?? a.createdAt))
    .slice(0, 6)

  for (const h of chronicles) {
    const id = `chronicle-${h.id}`
    items.push({
      id,
      kind: 'chronicle',
      title: 'Crônica publicada',
      message: `${mesaLabel(h.chronicleName, h.title)} — resumo disponível para leitura.`,
      createdAt: h.closedAt ?? h.createdAt,
      href: h.scheduledSessionId ? `/user/sessions#${h.scheduledSessionId}` : '/user/sessions',
      unread: !read.has(id),
    })
  }

  for (const notice of listSentNotices()) {
    items.push({
      id: `notice-${notice.id}`,
      kind: 'news',
      title: notice.title,
      message: notice.message,
      createdAt: notice.createdAt,
      href: notice.href,
      unread: !read.has(`notice-${notice.id}`),
    })
  }

  items.sort((a, b) => b.createdAt.localeCompare(a.createdAt))
  return items
}

export function unreadNotificationCount(email: string) {
  return listNotificationsForUser(email).filter((n) => n.unread).length
}

async function persistReads() {
  const body: Record<string, string[]> = {}
  for (const [k, set] of readByUser) body[k] = [...set]
  await commitDocument('notification-reads', body)
}

export async function markNotificationsRead(email: string, ids: string[]) {
  return runExclusive('store:notices-reads', async () => {
    const key = emailKey(email)
    const set = new Set(readByUser.get(key) ?? [])
    for (const id of ids) set.add(id)
    const prev = readByUser.get(key)
    readByUser.set(key, set)
    try {
      await persistReads()
    } catch (err) {
      if (prev) readByUser.set(key, prev)
      else readByUser.delete(key)
      throw err
    }
  })
}

export async function markAllNotificationsRead(email: string) {
  const all = listNotificationsForUser(email).map((n) => n.id)
  await markNotificationsRead(email, all)
}
