import { useMemo, useState } from 'react'
import type { ScheduledSession } from '../../types/chronicle'
import { adminChartShellClass } from './adminChartShell'

type Props = {
  sessions: ScheduledSession[]
  month?: Date
}

const weekdayLabels = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom']

function mondayIndex(date: Date) {
  return (date.getDay() + 6) % 7
}

function sameDay(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate()
}

function dayBadgeClass(isToday: boolean, hasSessions: boolean) {
  if (isToday) return 'bg-success text-white shadow-sm'
  if (hasSessions) return 'text-on-surface ring-1 ring-secondary/45 ring-inset'
  return 'text-on-surface hover:bg-surface-container/80'
}

export function AdminSessionCalendar({ sessions, month: initialMonth }: Props) {
  const [today] = useState(() => new Date())
  const [viewMonth, setViewMonth] = useState(() => {
    const base = initialMonth ?? new Date()
    return new Date(base.getFullYear(), base.getMonth(), 1)
  })

  const year = viewMonth.getFullYear()
  const monthIndex = viewMonth.getMonth()
  const first = new Date(year, monthIndex, 1)
  const startPad = mondayIndex(first)
  const daysInMonth = new Date(year, monthIndex + 1, 0).getDate()

  const byDay = useMemo(() => {
    const map = new Map<number, ScheduledSession[]>()
    for (const s of sessions) {
      const d = new Date(s.scheduledAt)
      if (d.getFullYear() === year && d.getMonth() === monthIndex) {
        const day = d.getDate()
        map.set(day, [...(map.get(day) ?? []), s])
      }
    }
    return map
  }, [sessions, year, monthIndex])

  const cells: Array<{ key: string; day: number | null }> = [
    ...Array.from({ length: startPad }, (_, offset) => ({
      key: `empty-${year}-${monthIndex}-${offset}`,
      day: null,
    })),
    ...Array.from({ length: daysInMonth }, (_, offset) => ({
      key: `day-${year}-${monthIndex}-${offset + 1}`,
      day: offset + 1,
    })),
  ]

  const monthTitle = viewMonth.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })
  const titleCaseMonth = monthTitle.charAt(0).toUpperCase() + monthTitle.slice(1)

  const shiftMonth = (delta: number) => {
    setViewMonth((prev) => new Date(prev.getFullYear(), prev.getMonth() + delta, 1))
  }

  return (
    <div className={adminChartShellClass}>
      <div className="mb-3 flex items-center justify-between gap-2">
        <p className="text-sm font-semibold tracking-tight text-on-surface capitalize">{titleCaseMonth}</p>
        <div className="flex items-center gap-0.5">
          <button
            type="button"
            className="flex h-7 w-7 items-center justify-center rounded text-on-surface-variant transition hover:bg-surface-container hover:text-on-surface"
            aria-label="Mês anterior"
            onClick={() => shiftMonth(-1)}
          >
            <span className="material-symbols-outlined text-lg leading-none">chevron_left</span>
          </button>
          <button
            type="button"
            className="flex h-7 w-7 items-center justify-center rounded text-on-surface-variant transition hover:bg-surface-container hover:text-on-surface"
            aria-label="Próximo mês"
            onClick={() => shiftMonth(1)}
          >
            <span className="material-symbols-outlined text-lg leading-none">chevron_right</span>
          </button>
        </div>
      </div>

      <div className="grid grid-cols-7 gap-y-1 text-center">
        {weekdayLabels.map((label) => (
          <span key={label} className="pb-1 text-[10px] font-medium text-on-surface-variant/80">
            {label}
          </span>
        ))}

        {cells.map(({ key, day }) => {
          if (day === null) {
            return <span key={key} className="aspect-square" aria-hidden="true" />
          }

          const list = byDay.get(day) ?? []
          const cellDate = new Date(year, monthIndex, day)
          const isToday = sameDay(cellDate, today)
          const titles = list.map((s) => s.title).join(' · ')

          return (
            <div key={key} className="flex aspect-square items-center justify-center">
              <span
                className={`relative flex h-8 w-8 items-center justify-center rounded-full text-xs font-medium tabular-nums transition ${dayBadgeClass(isToday, list.length > 0)}`}
                title={titles || undefined}
              >
                {day}
                {list.length > 0 && !isToday ? (
                  <>
                    <span
                      className="absolute bottom-1 h-1 w-1 rounded-full bg-secondary"
                      aria-hidden="true"
                    />
                    <span className="sr-only">
                      {` — ${list.length} ${list.length === 1 ? 'sessão' : 'sessões'}`}
                    </span>
                  </>
                ) : null}
              </span>
            </div>
          )
        })}
      </div>

      {byDay.size === 0 ? (
        <p className="mt-3 border-t border-outline-variant/30 pt-2 text-[10px] leading-snug text-on-surface-variant">
          Nenhuma sessão marcada neste mês.
        </p>
      ) : null}
    </div>
  )
}
