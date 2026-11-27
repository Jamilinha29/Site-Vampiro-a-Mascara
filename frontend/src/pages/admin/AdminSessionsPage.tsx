import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Link, useNavigate } from 'react-router-dom'
import { useState } from 'react'
import { AdminHandoutSummaryEditor } from '../../components/admin/AdminHandoutSummaryEditor'
import { SessionTableMetaForm } from '../../components/session/SessionTableInfoPanel'
import { useToast } from '../../components/ui/useToast'
import { api } from '../../services/api'
import { adminQueryKeys, invalidatePlayerPublishedContent } from '../../lib/queryKeys'
import { formatScheduledDateTime, isScheduledTimeReached, mesaDisplayName } from '../../lib/mesaSession'
import {
  DEFAULT_SESSION_RPG,
  newSessionTableMetaDefaults,
  suggestSessionLabel,
  syncCampaignFields,
  trimSessionTableMeta,
} from '../../lib/sessionTableMeta'
import type { SessionTableMeta } from '../../types/chronicle'

function defaultScheduledLocalValue() {
  const d = new Date()
  d.setHours(20, 0, 0, 0)
  if (d.getTime() < Date.now()) d.setDate(d.getDate() + 1)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

function initialTableMetaFromStorage(): SessionTableMeta {
  const base = newSessionTableMetaDefaults()
  try {
    const raw = localStorage.getItem('beladona-admin-mesa-defaults')
    const parsed = raw ? (JSON.parse(raw) as { playerGroup?: string; defaultRpgTitle?: string }) : null
    if (!parsed) return base
    return syncCampaignFields({
      ...base,
      rpgTitle: parsed.defaultRpgTitle ?? base.rpgTitle ?? DEFAULT_SESSION_RPG,
      campaignName: parsed.defaultRpgTitle ?? base.campaignName ?? DEFAULT_SESSION_RPG,
      playerGroup: parsed.playerGroup ?? base.playerGroup,
    })
  } catch {
    return base
  }
}

export default function AdminSessionsPage() {
  const [expandedHandoutId, setExpandedHandoutId] = useState<string | null>(null)
  const [tableMeta, setTableMeta] = useState<SessionTableMeta>(initialTableMetaFromStorage)
  const [scheduledLocal, setScheduledLocal] = useState(defaultScheduledLocalValue)
  const [listing, setListing] = useState<'public' | 'private'>('private')
  const qc = useQueryClient()
  const navigate = useNavigate()
  const { push } = useToast()

  const { data: scheduled = [] } = useQuery({
    queryKey: adminQueryKeys.scheduledSessions,
    queryFn: () => api.adminListScheduledSessions(),
  })
  const { data: handouts = [] } = useQuery({
    queryKey: adminQueryKeys.handouts,
    queryFn: () => api.adminListHandouts(),
  })

  const createTable = useMutation({
    mutationFn: () => {
      const campaign = tableMeta.campaignName.trim()
      if (!campaign) throw new Error('Informe o nome da campanha.')
      const parsedDate = new Date(scheduledLocal)
      if (Number.isNaN(parsedDate.getTime())) throw new Error('Informe uma data e horário válidos.')
      const suggested = suggestSessionLabel(scheduled, campaign)
      const sessionLabel = tableMeta.sessionLabel.trim() || suggested.label
      const meta: SessionTableMeta = trimSessionTableMeta({
        ...tableMeta,
        campaignName: campaign,
        sessionLabel,
        sessionOrdinal: suggested.ordinal,
      })
      return api.adminCreateScheduledSession({
        title: sessionLabel,
        chronicleName: campaign,
        scheduledAt: parsedDate.toISOString(),
        tableMeta: meta,
        listing,
      })
    },
    onSuccess: (created) => {
      void qc.invalidateQueries({ queryKey: adminQueryKeys.scheduledSessions })
      void qc.invalidateQueries({ queryKey: ['admin-live-mesas'] })
      void qc.invalidateQueries({ queryKey: adminQueryKeys.handouts })
      void qc.invalidateQueries({ queryKey: adminQueryKeys.sessionLine })
      void qc.invalidateQueries({ queryKey: adminQueryKeys.mesaActivity })
      invalidatePlayerPublishedContent(qc)
      setTableMeta(initialTableMetaFromStorage())
      setScheduledLocal(defaultScheduledLocalValue())
      navigate(`/admin/mesa/${created.id}`)
    },
  })

  const openMesa = useMutation({
    mutationFn: (id: string) => api.adminOpenScheduledSession(id),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: adminQueryKeys.scheduledSessions })
      void qc.invalidateQueries({ queryKey: ['admin-live-mesas'] })
      invalidatePlayerPublishedContent(qc)
    },
    onError: (e: Error) => push(e.message || 'Não foi possível abrir a mesa.', 'error'),
  })

  const closeMesa = useMutation({
    mutationFn: (id: string) => api.adminCloseScheduledSession(id),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: adminQueryKeys.scheduledSessions })
      void qc.invalidateQueries({ queryKey: ['admin-live-mesas'] })
      void qc.invalidateQueries({ queryKey: adminQueryKeys.handouts })
      invalidatePlayerPublishedContent(qc)
    },
    onError: (e: Error) => push(e.message || 'Não foi possível encerrar a mesa.', 'error'),
  })

  const setListingOn = useMutation({
    mutationFn: ({ id, next }: { id: string; next: 'public' | 'private' }) =>
      api.adminPatchScheduledSession(id, { listing: next }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: adminQueryKeys.scheduledSessions })
      void qc.invalidateQueries({ queryKey: ['admin-live-mesas'] })
      invalidatePlayerPublishedContent(qc)
    },
    onError: (e: Error) => push(e.message || 'Não foi possível alterar a visibilidade.', 'error'),
  })

  const deleteMesa = useMutation({
    mutationFn: (id: string) => api.adminDeleteScheduledSession(id),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: adminQueryKeys.scheduledSessions })
      void qc.invalidateQueries({ queryKey: ['admin-live-mesas'] })
      void qc.invalidateQueries({ queryKey: adminQueryKeys.handouts })
      void qc.invalidateQueries({ queryKey: adminQueryKeys.sessionLine })
      void qc.invalidateQueries({ queryKey: adminQueryKeys.mesaActivity })
      invalidatePlayerPublishedContent(qc)
    },
    onError: (e: Error) => window.alert(e.message || 'Não foi possível excluir a mesa.'),
  })

  const rescheduleMesa = useMutation({
    mutationFn: (id: string) => api.adminRescheduleScheduledSession(id),
    onSuccess: (created) => {
      void qc.invalidateQueries({ queryKey: adminQueryKeys.scheduledSessions })
      void qc.invalidateQueries({ queryKey: ['admin-live-mesas'] })
      void qc.invalidateQueries({ queryKey: adminQueryKeys.handouts })
      invalidatePlayerPublishedContent(qc)
      navigate(`/admin/mesa/${created.id}`)
    },
    onError: (e: Error) => window.alert(e.message || 'Não foi possível remarcar a mesa.'),
  })

  function confirmDeleteMesa(s: { id: string; status: string }, displayName: string) {
    if (s.status === 'open') {
      window.alert('Encerre a mesa ao vivo antes de excluí-la.')
      return
    }
    const ok = window.confirm(
      `Excluir de vez a mesa “${displayName}”?\n\nSome a mesa, o ato, as rolagens e os segredos desta sessão. Não dá para desfazer.`,
    )
    if (ok) deleteMesa.mutate(s.id)
  }

  function formatDuration(ms: number) {
    const totalMin = Math.floor(ms / 60000)
    const h = Math.floor(totalMin / 60)
    const m = totalMin % 60
    if (h <= 0) return `${m} min`
    return `${h}h ${m}min`
  }

  const sortedHandouts = [...handouts].sort((a, b) => b.createdAt.localeCompare(a.createdAt))

  return (
    <div className="space-y-4 pb-4">
      <header>
        <h1 className="font-headline-lg text-2xl text-on-surface">Sessões</h1>
        <p className="mt-1 max-w-3xl text-sm text-on-surface-variant">
          Crie mesas, acompanhe a agenda e publique resumos narrativos para os jogadores.
        </p>
      </header>

      <section className="admin-form-panel">
        <p className="font-label-sm text-xs text-secondary uppercase">Criar outra mesa</p>
        <p className="text-xs text-on-surface-variant sm:text-sm">
          Defina a data, o horário e a ficha da mesa — os jogadores veem a mesma tabela na sala ao vivo.
        </p>
        <SessionTableMetaForm columns="row" value={tableMeta} onChange={setTableMeta} />
        <div className="mt-2 grid gap-2 sm:grid-cols-2">
          <label className="block text-xs uppercase text-on-surface-variant">
            Data e horário
            <input
              type="datetime-local"
              className="input-feudal mt-1 pl-3 normal-case"
              value={scheduledLocal}
              onChange={(e) => setScheduledLocal(e.target.value)}
            />
            <span className="mt-1 block text-[11px] normal-case text-on-surface-variant/80">
              A mesa só abre ao vivo para jogadores que confirmaram participação a partir deste horário.
            </span>
          </label>
          <label className="block text-xs uppercase text-on-surface-variant">
            Acesso
            <select
              className="input-feudal mt-1 pl-3 normal-case"
              value={listing}
              onChange={(e) => setListing(e.target.value as 'public' | 'private')}
            >
              <option value="private">Privada — só com código de sala</option>
              <option value="public">Aberta ao público</option>
            </select>
          </label>
        </div>
        <button
          type="button"
          className="btn-primary mt-3 text-xs"
          disabled={createTable.isPending || !tableMeta.campaignName.trim()}
          onClick={() => createTable.mutate()}
        >
          {createTable.isPending ? 'Criando…' : 'Criar mesa'}
        </button>
        {createTable.isError ? (
          <p className="mt-2 text-xs text-primary">{(createTable.error as Error).message}</p>
        ) : null}
      </section>

      <section className="mesa-panel p-3.5 sm:p-4">
        <h2 className="font-headline-sm text-base sm:text-lg">Mesas em andamento</h2>
        <ul className="mt-3 grid gap-2.5 text-sm md:grid-cols-2">
          {[...scheduled]
            .filter((s) => s.status !== 'closed')
            .sort((a, b) => a.scheduledAt.localeCompare(b.scheduledAt))
            .map((s) => (
              <li
                key={s.id}
                className="flex flex-col justify-between rounded border border-outline-variant/40 px-3 py-2.5"
              >
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <p className="font-serif text-on-surface">{mesaDisplayName(s)}</p>
                    <p className="mt-1 text-xs text-on-surface-variant">
                      {s.status === 'open'
                        ? isScheduledTimeReached(s.scheduledAt)
                          ? 'Ao vivo'
                          : 'Liberada · aguarda horário'
                        : s.status === 'closed'
                          ? 'Encerrada'
                          : 'Agendada'}{' '}
                      · {formatScheduledDateTime(s.scheduledAt)}
                    </p>
                    <p className="mt-1 text-xs text-secondary">
                      {(s.listing ?? 'private') === 'public' ? 'Pública' : 'Privada'} · Código da mesa:{' '}
                      <strong className="tracking-widest">{s.accessCode}</strong>
                    </p>
                    {(s.startedAt || s.endedAt || s.activeDurationMs) && (
                      <p className="mt-1 text-xs text-on-surface-variant">
                        {s.startedAt ? `Início ${new Date(s.startedAt).toLocaleString('pt-BR')}` : ''}
                        {s.endedAt ? ` · Fim ${new Date(s.endedAt).toLocaleString('pt-BR')}` : ''}
                        {s.activeDurationMs ? ` · Ativa ${formatDuration(s.activeDurationMs)}` : ''}
                      </p>
                    )}
                    {s.presence?.length ? (
                      <p className="mt-1 text-xs text-on-surface-variant">
                        Confirmados ({s.presence.length}): {s.presence.map((p) => p.displayName).join(', ')}
                      </p>
                    ) : (
                      <p className="mt-1 text-xs text-outline">Nenhuma participação confirmada ainda.</p>
                    )}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      className="btn-secondary text-xs"
                      disabled={setListingOn.isPending}
                      onClick={() =>
                        setListingOn.mutate({
                          id: s.id,
                          next: (s.listing ?? 'private') === 'public' ? 'private' : 'public',
                        })
                      }
                    >
                      {(s.listing ?? 'private') === 'public' ? 'Tornar privada' : 'Tornar pública'}
                    </button>
                    {s.status !== 'open' && s.status !== 'closed' ? (
                      <button
                        type="button"
                        className="btn-primary text-xs"
                        disabled={openMesa.isPending}
                        onClick={() => openMesa.mutate(s.id)}
                      >
                        Abrir ao vivo
                      </button>
                    ) : null}
                    {s.status === 'open' ? (
                      <button
                        type="button"
                        className="btn-secondary text-xs"
                        disabled={closeMesa.isPending}
                        onClick={() => closeMesa.mutate(s.id)}
                      >
                        Encerrar mesa
                      </button>
                    ) : null}
                    <Link to={`/admin/mesa/${s.id}`} className="btn-secondary text-xs">
                      Painel da mesa
                    </Link>
                    <button
                      type="button"
                      className="btn-secondary border-primary/40 text-xs text-primary"
                      disabled={deleteMesa.isPending || s.status === 'open'}
                      title={s.status === 'open' ? 'Encerre a mesa antes de excluir' : 'Excluir mesa'}
                      onClick={() => confirmDeleteMesa(s, mesaDisplayName(s))}
                    >
                      Excluir
                    </button>
                  </div>
                </div>
              </li>
            ))}
          {scheduled.filter((s) => s.status !== 'closed').length === 0 ? (
            <li className="text-on-surface-variant">Nenhuma mesa em andamento — use Criar outra mesa acima.</li>
          ) : null}
        </ul>
      </section>

      <section className="mesa-panel p-5">
        <h2 className="font-headline-sm text-lg">Mesas encerradas</h2>
        <p className="mt-1 text-sm text-on-surface-variant">
          Uma mesa encerrada não continua. Para jogar de novo nela, remarque uma nova sessão.
        </p>
        <ul className="mt-4 space-y-3 text-sm">
          {scheduled
            .filter((s) => s.status === 'closed')
            .map((s) => (
              <li key={s.id} className="flex flex-wrap items-center justify-between gap-2 rounded border border-outline-variant/40 px-3 py-3">
                <div>
                  <p className="font-serif text-on-surface">{mesaDisplayName(s)}</p>
                  <p className="mt-1 text-xs text-on-surface-variant">
                    Encerrada
                    {s.endedAt ? ` · ${new Date(s.endedAt).toLocaleString('pt-BR')}` : ''}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    className="btn-primary text-xs"
                    disabled={rescheduleMesa.isPending}
                    onClick={() => rescheduleMesa.mutate(s.id)}
                  >
                    Remarcar nova sessão nesta mesa
                  </button>
                  <button
                    type="button"
                    className="btn-secondary border-primary/40 text-xs text-primary"
                    disabled={deleteMesa.isPending}
                    onClick={() => confirmDeleteMesa(s, mesaDisplayName(s))}
                  >
                    Excluir
                  </button>
                </div>
              </li>
            ))}
          {scheduled.filter((s) => s.status === 'closed').length === 0 ? (
            <li className="text-on-surface-variant">Nenhuma mesa encerrada.</li>
          ) : null}
        </ul>
      </section>

      <section className="mesa-panel p-5">
        <h2 className="font-headline-sm text-lg">Resumos dos atos</h2>
        <p className="mt-1 text-sm text-on-surface-variant">
          Clique em ver resumo para ler e editar. Jogadores só veem após encerrar a mesa e publicar.
        </p>
        <ul className="mt-4 space-y-3">
          {sortedHandouts.map((h) => {
            const open = expandedHandoutId === h.id
            return (
              <li key={h.id} className="rounded border border-outline-variant/40 px-3 py-3">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <p className="font-serif text-on-surface">{h.chronicleName ?? h.title}</p>
                    <p className="mt-1 text-xs text-on-surface-variant">
                      {h.status === 'pending_close' ? 'Em andamento' : 'Encerrada'}
                      {h.publishedToPlayers ? ' · publicada' : ' · rascunho oculto'}
                      {h.closedAt ? ` · ${new Date(h.closedAt).toLocaleDateString('pt-BR')}` : ''}
                    </p>
                  </div>
                  <button
                    type="button"
                    className="btn-secondary text-xs"
                    onClick={() => setExpandedHandoutId(open ? null : h.id)}
                  >
                    {open ? 'Fechar' : 'Ver resumo'}
                  </button>
                </div>
                {open ? (
                  <>
                    {h.narrativeSummary.trim() ? (
                      <p className="mt-3 whitespace-pre-wrap font-serif text-sm text-on-surface-variant">
                        {h.narrativeSummary}
                      </p>
                    ) : (
                      <p className="mt-3 text-sm text-on-surface-variant">Sem resumo registrado ainda.</p>
                    )}
                    <AdminHandoutSummaryEditor handout={h} />
                  </>
                ) : null}
              </li>
            )
          })}
          {sortedHandouts.length === 0 ? (
            <li className="text-sm text-on-surface-variant">Nenhum ato registrado.</li>
          ) : null}
        </ul>
      </section>
    </div>
  )
}
