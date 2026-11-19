import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Link, useNavigate } from 'react-router-dom'
import { useEffect, useState } from 'react'
import { AdminHandoutSummaryEditor } from '../../components/admin/AdminHandoutSummaryEditor'
import { SessionTableMetaForm } from '../../components/session/SessionTableInfoPanel'
import { api } from '../../services/api'
import { adminQueryKeys, invalidatePlayerPublishedContent } from '../../lib/queryKeys'
import { mesaDisplayName } from '../../lib/mesaSession'
import {
  DEFAULT_SESSION_RPG,
  newSessionTableMetaDefaults,
  suggestSessionLabel,
  syncCampaignFields,
} from '../../lib/sessionTableMeta'
import type { SessionTableMeta } from '../../types/chronicle'

export default function AdminSessionsPage() {
  const [expandedHandoutId, setExpandedHandoutId] = useState<string | null>(null)
  const [tableMeta, setTableMeta] = useState<SessionTableMeta>(() => newSessionTableMetaDefaults())
  const [listing, setListing] = useState<'public' | 'private'>('private')
  const qc = useQueryClient()
  const navigate = useNavigate()

  useEffect(() => {
    try {
      const raw = localStorage.getItem('beladona-admin-mesa-defaults')
      const parsed = raw ? (JSON.parse(raw) as { playerGroup?: string; defaultRpgTitle?: string }) : null
      setTableMeta((prev) =>
        syncCampaignFields({
          ...prev,
          rpgTitle: parsed?.defaultRpgTitle ?? prev.rpgTitle ?? DEFAULT_SESSION_RPG,
          campaignName: parsed?.defaultRpgTitle ?? prev.campaignName ?? DEFAULT_SESSION_RPG,
          playerGroup: parsed?.playerGroup ?? prev.playerGroup,
        }),
      )
    } catch {
      /* ignore */
    }
  }, [])

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
      const start = new Date()
      start.setHours(20, 0, 0, 0)
      const suggested = suggestSessionLabel(scheduled, campaign)
      const sessionLabel = tableMeta.sessionLabel.trim() || suggested.label
      const meta: SessionTableMeta = syncCampaignFields({
        ...tableMeta,
        campaignName: campaign,
        sessionLabel,
        sessionOrdinal: suggested.ordinal,
      })
      return api.adminCreateScheduledSession({
        title: sessionLabel,
        chronicleName: campaign,
        scheduledAt: start.toISOString(),
        tableMeta: meta,
        listing,
      })
    },
    onSuccess: (created) => {
      void qc.invalidateQueries({ queryKey: adminQueryKeys.scheduledSessions })
      void qc.invalidateQueries({ queryKey: adminQueryKeys.handouts })
      void qc.invalidateQueries({ queryKey: adminQueryKeys.sessionLine })
      void qc.invalidateQueries({ queryKey: adminQueryKeys.mesaActivity })
      invalidatePlayerPublishedContent(qc)
      setTableMeta(newSessionTableMetaDefaults())
      navigate(`/admin/mesa/${created.id}`)
    },
  })

  const openMesa = useMutation({
    mutationFn: (id: string) => api.adminOpenScheduledSession(id),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: adminQueryKeys.scheduledSessions })
      invalidatePlayerPublishedContent(qc)
    },
  })

  const closeMesa = useMutation({
    mutationFn: (id: string) => api.adminCloseScheduledSession(id),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: adminQueryKeys.scheduledSessions })
      void qc.invalidateQueries({ queryKey: adminQueryKeys.handouts })
      invalidatePlayerPublishedContent(qc)
    },
  })

  const setListingOn = useMutation({
    mutationFn: ({ id, next }: { id: string; next: 'public' | 'private' }) =>
      api.adminPatchScheduledSession(id, { listing: next }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: adminQueryKeys.scheduledSessions })
      invalidatePlayerPublishedContent(qc)
    },
  })

  const deleteMesa = useMutation({
    mutationFn: (id: string) => api.adminDeleteScheduledSession(id),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: adminQueryKeys.scheduledSessions })
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
    <div className="space-y-8 pb-8">
      <header>
        <h1 className="font-headline-lg text-2xl text-on-surface">Sessões</h1>
        <p className="mt-2 max-w-3xl text-sm text-on-surface-variant">
          Crie mesas, acompanhe a agenda e publique resumos narrativos para os jogadores.
        </p>
      </header>

      <section className="admin-form-panel">
        <p className="font-label-sm text-xs text-secondary uppercase">Criar outra mesa</p>
        <p className="text-sm text-on-surface-variant">
          Nova sessão agendada para hoje às 20h (horário local). Preencha a ficha da mesa — os jogadores veem a mesma
          tabela na sala ao vivo.
        </p>
        <SessionTableMetaForm columns="row" value={tableMeta} onChange={setTableMeta} />
        <label className="mt-3 block text-xs uppercase text-on-surface-variant">
          Acesso
          <select
            className="input-feudal mt-1 py-2 pl-3 text-sm normal-case"
            value={listing}
            onChange={(e) => setListing(e.target.value as 'public' | 'private')}
          >
            <option value="private">Privada — só com código de sala</option>
            <option value="public">Aberta ao público</option>
          </select>
        </label>
        <button
          type="button"
          className="btn-primary mt-4 text-xs"
          disabled={createTable.isPending || !tableMeta.campaignName.trim()}
          onClick={() => createTable.mutate()}
        >
          {createTable.isPending ? 'Criando…' : 'Criar mesa'}
        </button>
        {createTable.isError ? (
          <p className="mt-2 text-xs text-primary">{(createTable.error as Error).message}</p>
        ) : null}
      </section>

      <section className="mesa-panel p-5">
        <h2 className="font-headline-sm text-lg">Mesas em andamento</h2>
        <ul className="mt-4 space-y-3 text-sm">
          {[...scheduled]
            .filter((s) => s.status !== 'closed')
            .sort((a, b) => a.scheduledAt.localeCompare(b.scheduledAt))
            .map((s) => (
              <li
                key={s.id}
                className="rounded border border-outline-variant/40 px-3 py-3"
              >
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <p className="font-serif text-on-surface">{mesaDisplayName(s)}</p>
                    <p className="mt-1 text-xs text-on-surface-variant">
                      {s.status === 'open' ? 'Ao vivo' : s.status === 'closed' ? 'Encerrada' : 'Agendada'} ·{' '}
                      {new Date(s.scheduledAt).toLocaleString('pt-BR')}
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
                        Presenças: {s.presence.map((p) => p.displayName).join(', ')}
                      </p>
                    ) : null}
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
