import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { SessionActInlinePanel } from '../../components/session/SessionActInlinePanel'
import { api } from '../../services/api'
import { playerQueryKeys } from '../../lib/queryKeys'
import {
  evaluateClientLiveGate,
  formatScheduledDateTime,
  isScheduledTimeReached,
} from '../../lib/mesaSession'
import { useAuthStore } from '../../stores/authStore'
import { useToast } from '../../components/ui/useToast'
import type { ScheduledSession } from '../../types/chronicle'

type PanelState = { sessionId: string; mode: 'summary' | 'canon' } | null
type ConfirmModalState = {
  sessionId: string
  title: string
  scheduledAt?: string
  listing: 'public' | 'private'
  code: string
} | null

function formatDuration(ms: number) {
  const totalMin = Math.floor(ms / 60000)
  const h = Math.floor(totalMin / 60)
  const m = totalMin % 60
  if (h <= 0) return `${m} min`
  return `${h}h ${m}min`
}

function statusLabel(
  s: Pick<ScheduledSession, 'status' | 'scheduledAt' | 'hasConfirmedPresence' | 'myPresenceConfirmed' | 'presence'>,
  userEmail: string | undefined,
  nowMs: number,
) {
  if (s.status === 'closed') return 'Encerrada'
  const gate = evaluateClientLiveGate(s, userEmail, nowMs)
  if (gate.canEnterLive) return 'Ao vivo'
  if (gate.confirmed && !gate.timeReached) return 'Confirmada · Aguardando horário'
  if (gate.confirmed && s.status !== 'open') return 'Confirmada · Aguardando o mestre'
  if (!gate.confirmed && s.status === 'open' && gate.timeReached) return 'Confirme para entrar ao vivo'
  return 'Agendada'
}

export default function SessionsPage() {
  const [panel, setPanel] = useState<PanelState>(null)
  const [confirmModal, setConfirmModal] = useState<ConfirmModalState>(null)
  const [joinSessionId, setJoinSessionId] = useState<string | null>(null)
  const [publicJoin, setPublicJoin] = useState(false)
  const [boardQuery, setBoardQuery] = useState('')
  const [boardSearch, setBoardSearch] = useState('')
  const [privateCode, setPrivateCode] = useState('')
  const [accessCode, setAccessCode] = useState('')
  const [characterId, setCharacterId] = useState('')
  const [nowMs, setNowMs] = useState(() => Date.now())
  const auth = useAuthStore((s) => s.session)
  const canConfirmPresence = Boolean(auth)
  const qc = useQueryClient()
  const navigate = useNavigate()
  const { push } = useToast()

  useEffect(() => {
    const id = window.setInterval(() => setNowMs(Date.now()), 15_000)
    return () => window.clearInterval(id)
  }, [])

  const { data: scheduled = [], isLoading } = useQuery({
    queryKey: playerQueryKeys.scheduledSessions,
    queryFn: () => api.getScheduledSessions(),
  })
  const { data: profile } = useQuery({
    queryKey: playerQueryKeys.profile,
    queryFn: () => api.getMeProfile(),
  })
  const { data: board } = useQuery({
    queryKey: ['session-board', boardSearch],
    queryFn: () => api.getSessionBoard(boardSearch),
  })

  const characters = profile?.characters ?? []

  const confirm = useMutation({
    mutationFn: ({ sessionId, code }: { sessionId: string; code?: string }) =>
      api.confirmSessionPresence(sessionId, code),
    onSuccess: (updated) => {
      const gate = evaluateClientLiveGate(updated, auth?.email, Date.now())
      if (gate.canEnterLive) {
        push('Participação confirmada! A mesa já está liberada ao vivo para você.', 'success')
      } else if (!gate.timeReached) {
        push(
          `Participação confirmada! A mesa abrirá ao vivo em ${formatScheduledDateTime(updated.scheduledAt)}.`,
          'success',
        )
      } else {
        push('Participação confirmada para o narrador.', 'success')
      }
      setConfirmModal(null)
      void qc.invalidateQueries({ queryKey: playerQueryKeys.scheduledSessions })
      void qc.invalidateQueries({ queryKey: ['session-board'] })
      void qc.invalidateQueries({ queryKey: playerQueryKeys.dashboard })
    },
    onError: (e: Error) => push(e.message, 'error'),
  })

  const join = useMutation({
    mutationFn: () =>
      api.joinSessionWithCode(joinSessionId!, { accessCode: publicJoin ? '' : accessCode, characterId }),
    onSuccess: () => {
      push('Entrou na mesa.', 'success')
      const id = joinSessionId
      setJoinSessionId(null)
      setPublicJoin(false)
      setAccessCode('')
      void qc.invalidateQueries({ queryKey: playerQueryKeys.scheduledSessions })
      void qc.invalidateQueries({ queryKey: ['session-board'] })
      if (id) navigate(`/user/sessions/${id}/table`)
    },
    onError: (e: Error) => push(e.message, 'error'),
  })

  const sorted = useMemo(
    () =>
      [...scheduled].sort((a, b) => {
        const rank = (s: ScheduledSession) => {
          if (s.status === 'closed') return 3
          const gate = evaluateClientLiveGate(s, auth?.email, nowMs)
          if (gate.canEnterLive) return 0
          if (gate.confirmed) return 1
          return 2
        }
        const diff = rank(a) - rank(b)
        if (diff !== 0) return diff
        return a.status === 'closed'
          ? b.scheduledAt.localeCompare(a.scheduledAt)
          : a.scheduledAt.localeCompare(b.scheduledAt)
      }),
    [scheduled, auth?.email, nowMs],
  )
  const next =
    sorted.find((s) => evaluateClientLiveGate(s, auth?.email, nowMs).canEnterLive) ??
    sorted.find((s) => s.status !== 'closed' && new Date(s.scheduledAt).getTime() >= nowMs) ??
    sorted.find((s) => s.status !== 'closed') ??
    null
  const history = sorted.filter((s) => s.id !== next?.id)
  const nextGate = next ? evaluateClientLiveGate(next, auth?.email, nowMs) : null

  function togglePanel(sessionId: string, mode: 'summary' | 'canon') {
    setPanel((prev) => (prev?.sessionId === sessionId && prev.mode === mode ? null : { sessionId, mode }))
  }

  function requestConfirm(target: {
    id: string
    title: string
    scheduledAt?: string
    listing?: 'public' | 'private'
  }) {
    if ((target.listing ?? 'private') === 'private') {
      setConfirmModal({
        sessionId: target.id,
        title: target.title,
        scheduledAt: target.scheduledAt,
        listing: 'private',
        code: '',
      })
      return
    }
    confirm.mutate({ sessionId: target.id })
  }

  return (
    <div className="space-y-4 pb-4">
      <header>
        <h1 className="font-headline-lg text-2xl text-on-surface">Central de sessões</h1>
        <p className="mt-1 max-w-3xl text-sm text-on-surface-variant">
          Confirme sua participação para liberar a mesa ao vivo na data e horário marcados. Mesas privadas pedem o código de sala.
        </p>
      </header>

      <section className="mesa-panel space-y-3 p-3.5 sm:p-4">
        <h2 className="font-headline-sm text-base">Procurar sessão</h2>
        <form
          className="flex flex-wrap gap-2"
          onSubmit={(e) => {
            e.preventDefault()
            setBoardSearch(boardQuery.trim())
          }}
        >
          <input
            className="input-feudal min-w-[14rem] flex-1 pl-4"
            value={boardQuery}
            onChange={(e) => setBoardQuery(e.target.value)}
            placeholder="Nome da crônica, narrador ou amigo"
          />
          <button type="submit" className="btn-secondary text-xs">
            Procurar
          </button>
        </form>
        <div className="grid gap-3 md:grid-cols-2 md:items-stretch">
          <div className="flex h-full flex-col rounded-lg border border-outline-variant/30 bg-surface-container-lowest/35 p-3.5">
            <p className="text-xs font-semibold uppercase text-secondary">Abertas ao público</p>
            <ul className="mt-2 space-y-2">
              {(board?.publicTables ?? []).length === 0 ? (
                <li className="text-sm text-on-surface-variant">Nenhuma mesa pública.</li>
              ) : null}
              {(board?.publicTables ?? []).map((table) => {
                const gate = evaluateClientLiveGate(
                  {
                    status: table.status,
                    scheduledAt: table.scheduledAt,
                    hasConfirmedPresence: table.hasConfirmedPresence,
                    presence: [],
                  },
                  auth?.email,
                  nowMs,
                )
                return (
                  <li key={table.id} className="rounded border border-outline-variant/30 px-3 py-2 text-sm">
                    <p className="font-serif text-on-surface">{table.title}</p>
                    <p className="text-xs text-on-surface-variant">
                      {table.narratorName} · {formatScheduledDateTime(table.scheduledAt)} ·{' '}
                      {gate.canEnterLive ? 'Ao vivo' : gate.confirmed ? 'Confirmada' : 'Agendada'}
                    </p>
                    <div className="mt-2 flex flex-wrap items-center gap-2">
                      {!gate.confirmed && canConfirmPresence ? (
                        <button
                          type="button"
                          className="btn-secondary text-[10px]"
                          disabled={confirm.isPending}
                          onClick={() => confirm.mutate({ sessionId: table.id })}
                        >
                          Confirmar participação
                        </button>
                      ) : null}
                      {gate.canEnterLive ? (
                        <button
                          type="button"
                          className="btn-primary text-[10px]"
                          onClick={() => {
                            setPublicJoin(true)
                            setAccessCode('')
                            setJoinSessionId(table.id)
                            setCharacterId(characters.find((c) => c.isPrimary)?.id ?? characters[0]?.id ?? '')
                          }}
                        >
                          Entrar ao vivo
                        </button>
                      ) : gate.confirmed ? (
                        <span className="text-[11px] text-secondary">
                          {!gate.timeReached
                            ? `Confirmada · Abre em ${formatScheduledDateTime(table.scheduledAt)}`
                            : 'Confirmada · Aguardando o mestre abrir'}
                        </span>
                      ) : null}
                    </div>
                  </li>
                )
              })}
            </ul>
          </div>
          <div className="flex h-full flex-col rounded-lg border border-outline-variant/30 bg-surface-container-lowest/35 p-3.5">
            <p className="text-xs font-semibold uppercase text-secondary">Mesas de amigos</p>
            <ul className="mt-2 space-y-2">
              {(board?.friendTables ?? []).length === 0 ? (
                <li className="text-sm text-on-surface-variant">Nenhuma mesa privada de amigos.</li>
              ) : null}
              {(board?.friendTables ?? []).map((table) => {
                const gate = evaluateClientLiveGate(
                  {
                    status: table.status,
                    scheduledAt: table.scheduledAt,
                    hasConfirmedPresence: table.hasConfirmedPresence,
                    presence: [],
                  },
                  auth?.email,
                  nowMs,
                )
                return (
                  <li key={table.id} className="rounded border border-outline-variant/30 px-3 py-2 text-sm">
                    <p className="font-serif text-on-surface">{table.title}</p>
                    <p className="text-xs text-on-surface-variant">
                      {table.narratorName} · {formatScheduledDateTime(table.scheduledAt)}
                      {table.seatedNames.length ? ` · ${table.seatedNames.join(', ')}` : ''} · código de sala
                    </p>
                    <div className="mt-2 flex flex-wrap items-center gap-2">
                      {!gate.confirmed && canConfirmPresence ? (
                        <button
                          type="button"
                          className="btn-secondary text-[10px]"
                          onClick={() =>
                            setConfirmModal({
                              sessionId: table.id,
                              title: table.title,
                              scheduledAt: table.scheduledAt,
                              listing: 'private',
                              code: '',
                            })
                          }
                        >
                          Confirmar participação
                        </button>
                      ) : null}
                      {gate.canEnterLive ? (
                        <button
                          type="button"
                          className="btn-primary text-[10px]"
                          onClick={() => {
                            setPublicJoin(false)
                            setAccessCode('')
                            setJoinSessionId(table.id)
                            setCharacterId(characters.find((c) => c.isPrimary)?.id ?? characters[0]?.id ?? '')
                          }}
                        >
                          Entrar com código
                        </button>
                      ) : gate.confirmed ? (
                        <span className="text-[11px] text-secondary">
                          {!gate.timeReached
                            ? `Confirmada · Abre em ${formatScheduledDateTime(table.scheduledAt)}`
                            : 'Confirmada · Aguardando o mestre abrir'}
                        </span>
                      ) : null}
                    </div>
                  </li>
                )
              })}
            </ul>
          </div>
        </div>
        <form
          className="flex flex-wrap items-end gap-2 border-t border-outline-variant/30 pt-3"
          onSubmit={(e) => {
            e.preventDefault()
            const code = privateCode.trim()
            if (!code) return
            void api.joinSessionByCode(code).then(
              (found) => {
                const timeReached = isScheduledTimeReached(found.scheduledAt, Date.now())
                if (!found.hasConfirmedPresence) {
                  setConfirmModal({
                    sessionId: found.sessionId,
                    title: found.title ?? 'Mesa privada',
                    scheduledAt: found.scheduledAt,
                    listing: found.listing ?? 'private',
                    code,
                  })
                  return
                }
                if (found.status === 'open' && timeReached) {
                  setPublicJoin(false)
                  setAccessCode(code)
                  setJoinSessionId(found.sessionId)
                  setCharacterId(characters.find((c) => c.isPrimary)?.id ?? characters[0]?.id ?? '')
                  return
                }
                if (!timeReached && found.scheduledAt) {
                  push(
                    `Participação já confirmada! A mesa abre ao vivo em ${formatScheduledDateTime(found.scheduledAt)}.`,
                    'info',
                  )
                } else {
                  push('Participação confirmada! Aguardando o narrador abrir a mesa ao vivo.', 'info')
                }
                void qc.invalidateQueries({ queryKey: playerQueryKeys.scheduledSessions })
              },
              (err: Error) => push(err.message, 'error'),
            )
          }}
        >
          <label className="text-xs uppercase text-on-surface-variant">
            Mesa privada · código
            <input
              className="input-feudal mt-1 pl-4 uppercase tracking-widest"
              value={privateCode}
              onChange={(e) => setPrivateCode(e.target.value)}
              placeholder="Código de sala"
            />
          </label>
          <button type="submit" className="btn-secondary text-xs">
            Achar sala
          </button>
        </form>
      </section>

      {next && nextGate ? (
        <section className="mesa-panel overflow-hidden">
          <div className="bg-gradient-to-r from-primary-container/40 to-surface-container-high px-4 py-4 sm:px-5">
            <p className="font-label-sm text-[0.65rem] text-secondary uppercase">
              Próxima sessão · {statusLabel(next, auth?.email, nowMs)}
            </p>
            <h2 className="font-headline-lg mt-1 text-lg text-on-surface sm:text-xl">
              {next.chronicleName ?? next.title}
            </h2>
            <p className="mt-2 text-sm text-on-surface-variant">
              {new Date(next.scheduledAt).toLocaleString('pt-BR', {
                weekday: 'long',
                day: 'numeric',
                month: 'long',
                hour: '2-digit',
                minute: '2-digit',
              })}
            </p>
            {next.startedAt ? (
              <p className="mt-1 text-xs text-on-surface-variant">
                Início registrado: {new Date(next.startedAt).toLocaleString('pt-BR')}
                {next.endedAt ? ` · Término: ${new Date(next.endedAt).toLocaleString('pt-BR')}` : ''}
                {next.activeDurationMs ? ` · Ativa: ${formatDuration(next.activeDurationMs)}` : ''}
              </p>
            ) : null}
            <div className="mt-5 flex flex-wrap items-center gap-3">
              {canConfirmPresence && !nextGate.confirmed && next.status !== 'closed' ? (
                <button
                  type="button"
                  className="btn-secondary text-xs"
                  disabled={confirm.isPending}
                  onClick={() =>
                    requestConfirm({
                      id: next.id,
                      title: next.chronicleName ?? next.title,
                      scheduledAt: next.scheduledAt,
                      listing: next.listing,
                    })
                  }
                >
                  Confirmar participação
                </button>
              ) : null}
              {nextGate.confirmed && next.status !== 'closed' ? (
                <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/40 bg-emerald-500/10 px-2.5 py-1 text-[11px] font-medium text-emerald-300">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                  Participação confirmada
                </span>
              ) : null}
              {nextGate.canEnterLive ? (
                <button
                  type="button"
                  className="btn-primary text-xs"
                  onClick={() => {
                    setPublicJoin((next.listing ?? 'private') === 'public')
                    setAccessCode('')
                    setJoinSessionId(next.id)
                    setCharacterId(characters.find((c) => c.isPrimary)?.id ?? characters[0]?.id ?? '')
                  }}
                >
                  {(next.listing ?? 'private') === 'public' ? 'Entrar ao vivo' : 'Entrar ao vivo com código'}
                </button>
              ) : (
                <button type="button" className="btn-primary text-xs" disabled>
                  {!nextGate.confirmed
                    ? 'Confirme participação para entrar ao vivo'
                    : !nextGate.timeReached
                      ? `Abre ao vivo em ${formatScheduledDateTime(next.scheduledAt)}`
                      : 'Aguardando o mestre abrir a mesa'}
                </button>
              )}
            </div>
            {next.presence?.length ? (
              <p className="mt-3 text-xs text-on-surface-variant">
                Presenças confirmadas: {next.presence.map((p) => p.displayName).join(', ')}
              </p>
            ) : null}
          </div>
        </section>
      ) : (
        <section className="mesa-panel p-6 text-sm text-on-surface-variant">
          {isLoading ? 'Carregando agenda…' : 'Nenhuma sessão agendada pelo narrador.'}
        </section>
      )}

      <section>
        <h2 className="font-headline-sm mb-4 text-lg">Todas as mesas</h2>
        <div className="grid auto-rows-fr gap-3 md:grid-cols-2">
          {history.map((s, i) => {
            const gate = evaluateClientLiveGate(s, auth?.email, nowMs)
            return (
              <article key={s.id} className="mesa-panel flex h-full flex-col justify-between p-4">
                <div>
                  <p className="text-xs text-secondary uppercase">
                    {statusLabel(s, auth?.email, nowMs)} · Capítulo {String(i + 1).padStart(2, '0')}
                  </p>
                  <h3 className="mt-1 font-serif text-lg text-on-surface">{s.chronicleName ?? s.title}</h3>
                  <p className="mt-2 text-sm text-on-surface-variant">
                    {new Date(s.scheduledAt).toLocaleString('pt-BR')}
                    {s.startedAt ? ` · Início ${new Date(s.startedAt).toLocaleDateString('pt-BR')}` : ''}
                    {s.endedAt ? ` · Fim ${new Date(s.endedAt).toLocaleDateString('pt-BR')}` : ''}
                    {s.activeDurationMs ? ` · ${formatDuration(s.activeDurationMs)}` : ''}
                  </p>
                  {gate.confirmed && s.status !== 'closed' ? (
                    <p className="mt-1 text-xs text-emerald-300">
                      Participação confirmada
                      {!gate.timeReached ? ` · Libera em ${formatScheduledDateTime(s.scheduledAt)}` : ''}
                    </p>
                  ) : null}
                </div>
                <div className="mt-4 flex flex-wrap gap-2">
                  {gate.canEnterLive ? (
                    <button
                      type="button"
                      className="btn-primary text-xs"
                      onClick={() => {
                        setPublicJoin((s.listing ?? 'private') === 'public')
                        setAccessCode('')
                        setJoinSessionId(s.id)
                        setCharacterId(characters.find((c) => c.isPrimary)?.id ?? characters[0]?.id ?? '')
                      }}
                    >
                      {(s.listing ?? 'private') === 'public' ? 'Entrar ao vivo' : 'Entrar com código'}
                    </button>
                  ) : null}
                  {canConfirmPresence && !gate.confirmed && s.status !== 'closed' ? (
                    <button
                      type="button"
                      className="btn-secondary text-xs"
                      disabled={confirm.isPending}
                      onClick={() =>
                        requestConfirm({
                          id: s.id,
                          title: s.chronicleName ?? s.title,
                          scheduledAt: s.scheduledAt,
                          listing: s.listing,
                        })
                      }
                    >
                      Confirmar participação
                    </button>
                  ) : null}
                  <button
                    type="button"
                    className={`btn-secondary text-xs ${panel?.sessionId === s.id && panel.mode === 'summary' ? 'border-secondary text-secondary' : ''}`}
                    onClick={() => togglePanel(s.id, 'summary')}
                  >
                    Ver resumo
                  </button>
                  <button
                    type="button"
                    className={`btn-secondary text-xs ${panel?.sessionId === s.id && panel.mode === 'canon' ? 'border-secondary text-secondary' : ''}`}
                    onClick={() => togglePanel(s.id, 'canon')}
                  >
                    Crônica canônica
                  </button>
                </div>
                {panel?.sessionId === s.id ? <SessionActInlinePanel sessionId={s.id} mode={panel.mode} /> : null}
              </article>
            )
          })}
          {!isLoading && history.length === 0 ? (
            <p className="text-sm text-on-surface-variant">Participe de atos para registrar memórias da mesa.</p>
          ) : null}
        </div>
      </section>

      {confirmModal ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4" role="dialog" aria-modal="true">
          <div className="card-surface w-full max-w-md space-y-4 p-6">
            <h2 className="font-headline-sm text-lg text-on-surface">Confirmar participação</h2>
            <p className="text-xs text-on-surface-variant">
              <strong className="text-on-surface">{confirmModal.title}</strong>
              {confirmModal.scheduledAt ? ` · ${formatScheduledDateTime(confirmModal.scheduledAt)}` : ''}
            </p>
            <p className="text-xs text-on-surface-variant">
              A mesa abrirá ao vivo para você somente após confirmar participação e a partir da data e horário marcados.
            </p>
            {confirmModal.listing === 'private' ? (
              <label className="block text-xs uppercase text-on-surface-variant">
                Código da sala privada
                <input
                  className="input-feudal mt-1 pl-4 uppercase tracking-widest"
                  value={confirmModal.code}
                  onChange={(e) => setConfirmModal((prev) => (prev ? { ...prev, code: e.target.value } : null))}
                  placeholder="Ex: A7K2QM"
                />
              </label>
            ) : null}
            <div className="flex justify-end gap-2">
              <button type="button" className="btn-secondary text-xs" onClick={() => setConfirmModal(null)}>
                Cancelar
              </button>
              <button
                type="button"
                className="btn-primary text-xs"
                disabled={(confirmModal.listing === 'private' && !confirmModal.code.trim()) || confirm.isPending}
                onClick={() =>
                  confirm.mutate({
                    sessionId: confirmModal.sessionId,
                    code: confirmModal.listing === 'private' ? confirmModal.code.trim() : undefined,
                  })
                }
              >
                {confirm.isPending ? 'Confirmando…' : 'Confirmar participação'}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {joinSessionId ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4" role="dialog">
          <div className="card-surface w-full max-w-md space-y-4 p-6">
            <h2 className="font-headline-sm text-lg text-on-surface">Entrar na mesa</h2>
            <p className="text-xs text-on-surface-variant">
              {publicJoin
                ? 'Mesa pública. Escolha o personagem para sentar.'
                : 'Informe o código da sala privada. Se saiu, precisa do código novamente.'}
            </p>
            {publicJoin ? null : (
            <label className="block text-xs uppercase text-on-surface-variant">
              Código / senha
              <input
                className="input-feudal mt-1 pl-4 uppercase tracking-widest"
                value={accessCode}
                onChange={(e) => setAccessCode(e.target.value)}
                placeholder="Ex: A7K2QM"
              />
            </label>
            )}
            <label className="block text-xs uppercase text-on-surface-variant">
              Personagem na sessão
              <select
                className="input-feudal mt-1 pl-4 normal-case"
                value={characterId}
                onChange={(e) => setCharacterId(e.target.value)}
              >
                <option value="">Selecionar…</option>
                {characters.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </label>
            <div className="flex justify-end gap-2">
              <button type="button" className="btn-secondary text-xs" onClick={() => setJoinSessionId(null)}>
                Cancelar
              </button>
              <button
                type="button"
                className="btn-primary text-xs"
                disabled={(!publicJoin && !accessCode.trim()) || !characterId || join.isPending}
                onClick={() => join.mutate()}
              >
                Entrar
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}
