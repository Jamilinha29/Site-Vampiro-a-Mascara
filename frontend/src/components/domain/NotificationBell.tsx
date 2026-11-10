import { useEffect, useId, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '../../services/api'
import { playerQueryKeys } from '../../lib/queryKeys'
import type { AppNotification, NotificationKind } from '../../types/notifications'

const kindIcon: Record<NotificationKind, string> = {
  session: 'event',
  chronicle: 'auto_stories',
  system: 'info',
  news: 'campaign',
}

function formatWhen(iso: string) {
  try {
    return new Date(iso).toLocaleString('pt-BR', {
      day: '2-digit',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    })
  } catch {
    return ''
  }
}

export function NotificationBell({ className = '' }: { className?: string }) {
  const panelId = useId()
  const rootRef = useRef<HTMLDivElement>(null)
  const [open, setOpen] = useState(false)
  const qc = useQueryClient()

  const { data: countData } = useQuery({
    queryKey: playerQueryKeys.notificationsUnread,
    queryFn: () => api.getUnreadNotificationCount(),
    refetchInterval: 60_000,
  })

  const { data: items = [], isLoading, isFetching } = useQuery({
    queryKey: playerQueryKeys.notifications,
    queryFn: () => api.getNotifications(),
    enabled: open,
  })

  const markRead = useMutation({
    mutationFn: (ids: string[]) => api.markNotificationsRead({ ids }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: playerQueryKeys.notifications })
      void qc.invalidateQueries({ queryKey: playerQueryKeys.notificationsUnread })
    },
  })

  const count = countData?.count ?? 0

  useEffect(() => {
    if (!open) return
    function onPointerDown(e: PointerEvent) {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false)
    }
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('pointerdown', onPointerDown, true)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('pointerdown', onPointerDown, true)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [open])

  return (
    <div ref={rootRef} className={`relative ${className}`}>
      <button
        type="button"
        className="relative rounded p-2 text-on-surface-variant transition hover:bg-surface-container hover:text-primary"
        aria-label={count ? `${count} notificações não lidas` : 'Notificações'}
        aria-expanded={open}
        aria-controls={panelId}
        aria-haspopup="dialog"
        onClick={() => setOpen((v) => !v)}
      >
        <span className="material-symbols-outlined text-xl">notifications</span>
        {count > 0 ? (
          <span
            className="absolute top-0.5 right-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-primary-container px-1 text-[9px] font-bold leading-none text-on-primary-container ring-2 ring-surface"
            aria-hidden
          >
            {count > 99 ? '99+' : count}
          </span>
        ) : null}
      </button>

      {open ? (
        <div
          id={panelId}
          role="dialog"
          aria-label="Notificações"
          className="absolute right-0 z-50 mt-2 flex w-[min(22.5rem,calc(100vw-2rem))] max-h-[min(28rem,70vh)] flex-col overflow-hidden rounded-lg border border-outline-variant/50 bg-surface-container-lowest shadow-[0_12px_40px_rgba(0,0,0,0.45)]"
        >
          <div className="shrink-0 border-b border-outline-variant/40 px-4 py-3">
            <p className="font-label-sm text-xs text-secondary uppercase">Notificações</p>
            {count > 0 ? (
              <p className="mt-0.5 text-[11px] text-on-surface-variant">
                {count} não {count === 1 ? 'lida' : 'lidas'}
              </p>
            ) : (
              <p className="mt-0.5 text-[11px] text-on-surface-variant">Tudo em dia</p>
            )}
          </div>

          <ul
            className="min-h-0 flex-1 overflow-y-auto overscroll-contain py-1"
            aria-busy={isLoading || isFetching}
          >
            {isLoading ? (
              <li className="px-4 py-6 text-sm text-on-surface-variant">Carregando…</li>
            ) : items.length === 0 ? (
              <li className="px-4 py-8 text-center text-sm text-on-surface-variant">Nenhuma notificação no momento.</li>
            ) : (
              items.map((n) => (
                <NotificationRow
                  key={n.id}
                  item={n}
                  marking={markRead.isPending}
                  onNavigate={() => setOpen(false)}
                  onMarkRead={(id) => markRead.mutate([id])}
                />
              ))
            )}
          </ul>

          <div className="shrink-0 border-t border-outline-variant/40 px-3 py-2.5 text-center">
            <Link
              to="/user/sessions"
              className="text-xs text-secondary hover:underline"
              onClick={() => setOpen(false)}
            >
              Ver central de sessões
            </Link>
          </div>
        </div>
      ) : null}
    </div>
  )
}

function NotificationRow({
  item,
  marking,
  onNavigate,
  onMarkRead,
}: {
  item: AppNotification
  marking: boolean
  onNavigate: () => void
  onMarkRead: (id: string) => void
}) {
  const unread = item.unread

  const rowClass = [
    'flex w-full gap-3 px-4 py-3 text-left transition',
    'border-b border-outline-variant/15 last:border-b-0',
    unread
      ? 'border-l-[3px] border-l-secondary bg-secondary/[0.07] hover:bg-secondary/10'
      : 'border-l-[3px] border-l-transparent opacity-75 hover:bg-surface-container/60 hover:opacity-100',
  ].join(' ')

  const inner = (
    <>
      <span
        className={`material-symbols-outlined mt-0.5 shrink-0 text-lg ${unread ? 'text-secondary' : 'text-outline-variant/80'}`}
        aria-hidden
      >
        {kindIcon[item.kind]}
      </span>
      <div className="min-w-0 flex-1">
        <p className={`text-sm leading-snug ${unread ? 'font-semibold text-on-surface' : 'font-normal text-on-surface-variant'}`}>
          {item.title}
        </p>
        <p className={`mt-1 text-xs leading-relaxed ${unread ? 'text-on-surface-variant' : 'text-outline'}`}>
          {item.message}
        </p>
        <time className="mt-1.5 block text-[10px] tabular-nums text-outline" dateTime={item.createdAt}>
          {formatWhen(item.createdAt)}
        </time>
      </div>
      {unread ? (
        <span
          className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-primary-container shadow-[0_0_6px_rgba(158,27,45,0.6)]"
          title="Não lida"
          aria-label="Não lida"
        />
      ) : null}
    </>
  )

  const handleActivate = () => {
    if (unread && !marking) onMarkRead(item.id)
  }

  if (item.href) {
    return (
      <li>
        <Link
          to={item.href}
          className={rowClass}
          onClick={() => {
            handleActivate()
            onNavigate()
          }}
        >
          {inner}
        </Link>
      </li>
    )
  }

  return (
    <li>
      <button type="button" className={rowClass} onClick={handleActivate}>
        {inner}
      </button>
    </li>
  )
}
