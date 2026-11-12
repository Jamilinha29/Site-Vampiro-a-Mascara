import { randomUUID } from 'crypto'
import { listHandouts, listScheduledSessions } from './chronicleStore.js'
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
  createdAt: string
  href: string | null
}

const NOTICE_FILE = 'sent-notices.json'
const sentNotices: SentNotice[] = readJsonFile<SentNotice[]>(NOTICE_FILE) ?? []

export function listSentNotices() {
  return [...sentNotices].sort((a, b) => b.createdAt.localeCompare(a.createdAt))
}

export function createSentNotice(input: { title: string; message: string; href?: string | null }) {
  const row: SentNotice = {
    id: randomUUID(),
    title: input.title.trim(),
    message: input.message.trim(),
    createdAt: new Date().toISOString(),
    href: input.href?.trim() || '/user',
  }
  sentNotices.unshift(row)
  writeJsonFile(NOTICE_FILE, sentNotices)
  return row
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
  const read = readByUser.get(email) ?? new Set<string>()
  const now = Date.now()
  const items: AppNotification[] = []

  const sessions = listScheduledSessions()
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

  const chronicles = listHandouts(false)
    .filter((h) => h.status === 'closed' && h.publishedToPlayers)
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

export function markNotificationsRead(email: string, ids: string[]) {
  const set = readByUser.get(email) ?? new Set<string>()
  for (const id of ids) set.add(id)
  readByUser.set(email, set)
}

export function markAllNotificationsRead(email: string) {
  const all = listNotificationsForUser(email).map((n) => n.id)
  markNotificationsRead(email, all)
}
