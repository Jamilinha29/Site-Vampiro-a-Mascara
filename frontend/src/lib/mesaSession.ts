import type { ScheduledSession } from '../types/chronicle'

export function isSameCalendarDay(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate()
}

export function isScheduledTimeReached(scheduledAt?: string, nowMs = Date.now()) {
  const raw = scheduledAt?.trim()
  if (!raw) return true
  const ts = Date.parse(raw)
  if (Number.isNaN(ts)) return true
  return nowMs >= ts
}

export function formatScheduledDateTime(scheduledAt: string) {
  const d = new Date(scheduledAt)
  if (Number.isNaN(d.getTime())) return scheduledAt
  return d.toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export function hasConfirmedPresenceOnSession(
  session: Pick<ScheduledSession, 'hasConfirmedPresence' | 'myPresenceConfirmed' | 'presence'>,
  userEmail?: string,
) {
  if (session.hasConfirmedPresence || session.myPresenceConfirmed) return true
  const normalized = userEmail?.trim().toLowerCase()
  return (session.presence ?? []).some(
    (p) => p.isMe || (normalized && p.email?.trim().toLowerCase() === normalized),
  )
}

export function evaluateClientLiveGate(
  session: Pick<
    ScheduledSession,
    'status' | 'scheduledAt' | 'hasConfirmedPresence' | 'myPresenceConfirmed' | 'presence'
  >,
  userEmail?: string,
  nowMs = Date.now(),
): {
  confirmed: boolean
  timeReached: boolean
  canEnterLive: boolean
  reason?: 'closed' | 'presence_required' | 'before_schedule' | 'not_open'
} {
  const confirmed = hasConfirmedPresenceOnSession(session, userEmail)
  const timeReached = isScheduledTimeReached(session.scheduledAt, nowMs)
  if (session.status === 'closed') {
    return { confirmed, timeReached, canEnterLive: false, reason: 'closed' }
  }
  if (!confirmed) {
    return { confirmed, timeReached, canEnterLive: false, reason: 'presence_required' }
  }
  if (!timeReached) {
    return { confirmed, timeReached, canEnterLive: false, reason: 'before_schedule' }
  }
  if (session.status !== 'open') {
    return { confirmed, timeReached, canEnterLive: false, reason: 'not_open' }
  }
  return { confirmed, timeReached, canEnterLive: true }
}

/** Mesa agendada para hoje (mais recente se houver várias). */
export function findTodayMesaSession(sessions: ScheduledSession[], ref = new Date()) {
  const today = sessions.filter((s) => s.status !== 'closed' && isSameCalendarDay(new Date(s.scheduledAt), ref))
  if (today.length === 0) return null
  return today.sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0]
}

export function mesaDisplayName(session: ScheduledSession) {
  return (
    session.tableMeta?.campaignName?.trim() ||
    session.chronicleName?.trim() ||
    session.title.replace(/^Mesa\s*[—-]\s*/i, '').trim() ||
    'Crônica do dia'
  )
}
