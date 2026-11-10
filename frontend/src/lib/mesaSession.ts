import type { ScheduledSession } from '../types/chronicle'

export function isSameCalendarDay(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate()
}

/** Mesa agendada para hoje (mais recente se houver várias). */
export function findTodayMesaSession(sessions: ScheduledSession[], ref = new Date()) {
  const today = sessions.filter((s) => isSameCalendarDay(new Date(s.scheduledAt), ref))
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
