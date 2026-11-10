import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useMemo, useState } from 'react'
import { SessionActInlinePanel } from '../../components/session/SessionActInlinePanel'
import { api } from '../../services/api'
import { playerQueryKeys } from '../../lib/queryKeys'
import { useAuthStore } from '../../stores/authStore'
import { useToast } from '../../components/ui/ToastProvider'
import type { ScheduledSession } from '../../types/chronicle'

type PanelState = { sessionId: string; mode: 'summary' | 'canon' } | null

function formatDuration(ms: number) {
  const totalMin = Math.floor(ms / 60000)
  const h = Math.floor(totalMin / 60)
  const m = totalMin % 60
  if (h <= 0) return `${m} min`
  return `${h}h ${m}min`
}

function statusLabel(s: ScheduledSession) {
  if (s.status === 'open') return 'Ao vivo'
  if (s.status === 'closed') return 'Encerrada'
  return 'Agendada'
}

export default function SessionsPage() {
  const [panel, setPanel] = useState<PanelState>(null)
  const [joinSessionId, setJoinSessionId] = useState<string | null>(null)
  const [accessCode, setAccessCode] = useState('')
  const [characterId, setCharacterId] = useState('')
  const auth = useAuthStore((s) => s.session)
  const canConfirmPresence = auth?.role === 'player'
  const qc = useQueryClient()
  const { push } = useToast()

  const { data: scheduled = [], isLoading } = useQuery({
    queryKey: playerQueryKeys.scheduledSessions,
    queryFn: () => api.getScheduledSessions(),
  })
  const { data: profile } = useQuery({
    queryKey: playerQueryKeys.profile,
    queryFn: () => api.getMeProfile(),
  })

  const characters = profile?.characters ?? []

  const confirm = useMutation({
    mutationFn: (sessionId: string) => api.confirmSessionPresence(sessionId),
    onSuccess: () => {
      push('Presença confirmada para o narrador.', 'success')
      void qc.invalidateQueries({ queryKey: playerQueryKeys.scheduledSessions })
    },
    onError: (e: Error) => push(e.message, 'error'),
  })

  const join = useMutation({
    mutationFn: () =>
      api.joinSessionWithCode(joinSessionId!, { accessCode, characterId }),
    onSuccess: () => {
      push('Entrou na mesa.', 'success')
      const id = joinSessionId
      setJoinSessionId(null)
      setAccessCode('')
      void qc.invalidateQueries({ queryKey: playerQueryKeys.scheduledSessions })
      if (id) window.location.assign(`/user/sessions/${id}/table`)
    },
    onError: (e: Error) => push(e.message, 'error'),
  })

  const now = Date.now()
  const sorted = useMemo(
    () => [...scheduled].sort((a, b) => a.scheduledAt.localeCompare(b.scheduledAt)),
    [scheduled],
  )
  const next =
    sorted.find((s) => s.status === 'open') ??
    sorted.find((s) => s.status === 'scheduled' && new Date(s.scheduledAt).getTime() >= now) ??
    sorted.find((s) => s.status !== 'closed') ??
    null
  const history = sorted.filter((s) => s.id !== next?.id)

  function togglePanel(sessionId: string, mode: 'summary' | 'canon') {
    setPanel((prev) => (prev?.sessionId === sessionId && prev.mode === mode ? null : { sessionId, mode }))
  }

  return (
    <div className="space-y-8 pb-8">
      <header>
        <h1 className="font-headline-lg text-2xl text-on-surface">Central de sessões</h1>
        <p className="mt-2 max-w-3xl text-sm text-on-surface-variant">
          Confirme presença, use o código da mesa quando o mestre abrir a sala e escolha o personagem da sessão.
        </p>
      </header>

      {next ? (
        <section className="mesa-panel overflow-hidden">
          <div className="bg-gradient-to-r from-primary-container/40 to-surface-container-high px-5 py-6 sm:px-8">
            <p className="font-label-sm text-[0.65rem] text-secondary uppercase">Próxima sessão · {statusLabel(next)}</p>
            <h2 className="font-headline-lg mt-2 text-xl text-on-surface sm:text-2xl">
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
            <div className="mt-5 flex flex-wrap gap-3">
              {canConfirmPresence ? (
                <button
                  type="button"
                  className="btn-secondary text-xs"
                  disabled={confirm.isPending}
                  onClick={() => confirm.mutate(next.id)}
                >
                  Confirmar presença
                </button>
              ) : null}
              {next.status === 'open' ? (
                <button
                  type="button"
                  className="btn-primary text-xs"
                  onClick={() => {
                    setJoinSessionId(next.id)
                    setCharacterId(characters.find((c) => c.isPrimary)?.id ?? characters[0]?.id ?? '')
                  }}
                >
                  Entrar com código
                </button>
              ) : (
                <button type="button" className="btn-primary text-xs" disabled>
                  Aguardando o mestre abrir a mesa
                </button>
              )}
            </div>
            {next.presence?.length ? (
              <p className="mt-3 text-xs text-on-surface-variant">
                Presenças: {next.presence.map((p) => p.displayName).join(', ')}
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
        <div className="grid gap-4 lg:grid-cols-2">
          {history.map((s, i) => (
            <article key={s.id} className="mesa-panel p-5">
              <p className="text-xs text-secondary uppercase">
                {statusLabel(s)} · Capítulo {String(i + 1).padStart(2, '0')}
              </p>
              <h3 className="mt-1 font-serif text-lg text-on-surface">{s.chronicleName ?? s.title}</h3>
              <p className="mt-2 text-sm text-on-surface-variant">
                {new Date(s.scheduledAt).toLocaleString('pt-BR')}
                {s.startedAt ? ` · Início ${new Date(s.startedAt).toLocaleDateString('pt-BR')}` : ''}
                {s.endedAt ? ` · Fim ${new Date(s.endedAt).toLocaleDateString('pt-BR')}` : ''}
                {s.activeDurationMs ? ` · ${formatDuration(s.activeDurationMs)}` : ''}
              </p>
              <div className="mt-4 flex flex-wrap gap-2">
                {s.status === 'open' ? (
                  <button
                    type="button"
                    className="btn-primary text-xs"
                    onClick={() => {
                      setJoinSessionId(s.id)
                      setCharacterId(characters.find((c) => c.isPrimary)?.id ?? characters[0]?.id ?? '')
                    }}
                  >
                    Entrar com código
                  </button>
                ) : null}
                {canConfirmPresence && s.status === 'scheduled' ? (
                  <button
                    type="button"
                    className="btn-secondary text-xs"
                    onClick={() => confirm.mutate(s.id)}
                  >
                    Confirmar presença
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
          ))}
          {!isLoading && scheduled.length === 0 ? (
            <p className="text-sm text-on-surface-variant">Participe de atos para registrar memórias da mesa.</p>
          ) : null}
        </div>
      </section>

      {joinSessionId ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4" role="dialog">
          <div className="card-surface w-full max-w-md space-y-4 p-6">
            <h2 className="font-headline-sm text-lg text-on-surface">Entrar na mesa</h2>
            <p className="text-xs text-on-surface-variant">
              Informe o código criado com a mesa. Se saiu da sala, precisa do código novamente.
            </p>
            <label className="block text-xs uppercase text-on-surface-variant">
              Código / senha
              <input
                className="input-feudal mt-1 pl-4 uppercase tracking-widest"
                value={accessCode}
                onChange={(e) => setAccessCode(e.target.value)}
                placeholder="Ex: A7K2QM"
              />
            </label>
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
                disabled={!accessCode.trim() || !characterId || join.isPending}
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
