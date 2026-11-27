import { useEffect, useRef, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Link, useNavigate } from 'react-router-dom'
import type { ChronicleAmbience, ScheduledSession } from '../../types/chronicle'
import { useMesaHandout } from '../../hooks/useMesaHandout'
import { useAuthStore } from '../../stores/authStore'
import { StatBar } from '../domain/StatBar'
import { mesaDisplayName } from '../../lib/mesaSession'
import { MesaAuctionDesk } from './MesaAuctionDesk'
import { MesaCoinGrant } from './MesaCoinGrant'
import { MesaSceneThreatsPanel } from './MesaSceneThreatsPanel'
import { MesaSceneNpcsPanel } from './MesaSceneNpcsPanel'
import {
  AMBIENCE_FIELD_LABELS,
  CHRONICLE_AMBIENCE_OPTIONS,
  DEFAULT_CHRONICLE_AMBIENCE,
  EXTERNAL_MAP_NOTICE_ADMIN,
} from '../../lib/chronicleAmbience'
import { api } from '../../services/api'
import { adminQueryKeys, invalidatePlayerPublishedContent } from '../../lib/queryKeys'
import { SessionTableInfoPanel, SessionTableMetaForm } from '../session/SessionTableInfoPanel'
import {
  isCampaignLocked,
  resolveSessionTableMeta,
  suggestSessionLabel,
  syncCampaignFields,
  trimSessionTableMeta,
} from '../../lib/sessionTableMeta'
import type { SessionTableMeta } from '../../types/chronicle'

const PRIORITY_LABEL = { baixa: 'Secundária', media: 'Principal', alta: 'Urgente' } as const

type Props = {
  session: ScheduledSession
  actNumber: number
  liveCount?: number
}

export function AdminMesaWorkbench({ session, actNumber, liveCount = 0 }: Props) {
  const navigate = useNavigate()
  const qc = useQueryClient()
  const chronicle = mesaDisplayName(session)
  const narrator = useAuthStore((s) => s.session?.displayName ?? 'Mestre')
  const currentUserEmail = useAuthStore((s) => s.session?.email?.toLowerCase() ?? '')
  const currentUserRole = useAuthStore((s) => s.session?.role ?? 'narrator')
  const isPrimaryOwner =
    currentUserRole === 'admin' ||
    !session.narratorEmail ||
    session.narratorEmail.toLowerCase() === currentUserEmail
  const mesa = useMesaHandout(session.id)
  const [round, setRound] = useState(1)
  const [activeTurnIdx, setActiveTurnIdx] = useState(0)
  const [audit, setAudit] = useState<string[]>(() => [
    `${new Date().toLocaleTimeString('pt-BR')} — Mesa aberta · ${chronicle}`,
  ])
  const [whisperDraft, setWhisperDraft] = useState<{ sessionId: string; text: string } | null>(null)
  const whisper = whisperDraft?.sessionId === session.id ? whisperDraft.text : (mesa.handout?.narratorWhisper ?? '')
  const setWhisper = (text: string) => setWhisperDraft({ sessionId: session.id, text })
  const [grantParticipant, setGrantParticipant] = useState('')
  const [grantXp, setGrantXp] = useState(10)
  const xpOpRef = useRef<string | null>(null)
  const [editTableMeta, setEditTableMeta] = useState(false)
  const [tableMetaDraft, setTableMetaDraft] = useState<SessionTableMeta>(() => resolveSessionTableMeta(session))

  const sessionActions = useQuery({
    queryKey: ['admin-session-actions', session.id],
    queryFn: () => api.adminGetSessionActions(session.id),
    refetchInterval: session.status === 'open' ? 10_000 : false,
    refetchIntervalInBackground: false,
  })

  useEffect(() => {
    xpOpRef.current = null
  }, [session.id, grantParticipant, grantXp])

  const restModeMutation = useMutation({
    mutationFn: (restMode: boolean) => api.adminSetMesaRestMode(session.id, restMode),
    onSuccess: (handout) => {
      qc.setQueryData(adminQueryKeys.mesaHandout(session.id), handout)
    },
  })

  const listingMutation = useMutation({
    mutationFn: (next: 'public' | 'private') => api.adminPatchScheduledSession(session.id, { listing: next }),
    onSuccess: (_updated, next) => {
      void qc.invalidateQueries({ queryKey: adminQueryKeys.scheduledSessions })
      void qc.invalidateQueries({ queryKey: ['admin-live-mesas'] })
      invalidatePlayerPublishedContent(qc)
      logAudit(next === 'public' ? 'Mesa alterada para pública' : 'Mesa alterada para privada')
    },
  })

  const coNarratorMutation = useMutation({
    mutationFn: (allowCoNarrator: boolean) => api.adminPatchScheduledSession(session.id, { allowCoNarrator }),
    onSuccess: (_updated, allow) => {
      void qc.invalidateQueries({ queryKey: adminQueryKeys.scheduledSessions })
      void qc.invalidateQueries({ queryKey: ['admin-live-mesas'] })
      logAudit(allow ? 'Narrador secundário liberado nesta mesa' : 'Narrador secundário bloqueado nesta mesa')
    },
  })

  const closeSessionMutation = useMutation({
    mutationFn: () => api.adminCloseScheduledSession(session.id),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: adminQueryKeys.scheduledSessions })
      void qc.invalidateQueries({ queryKey: ['admin-live-mesas'] })
      void qc.invalidateQueries({ queryKey: adminQueryKeys.handouts })
      void qc.invalidateQueries({ queryKey: adminQueryKeys.mesaHandout(session.id) })
      invalidatePlayerPublishedContent(qc)
      logAudit('Sessão encerrada')
    },
  })

  const ambienceMutation = useMutation({
    mutationFn: (patch: Partial<ChronicleAmbience>) => api.adminPatchMesaAmbience(session.id, patch),
    onSuccess: (handout) => {
      qc.setQueryData(adminQueryKeys.mesaHandout(session.id), handout)
    },
  })

  const whisperMutation = useMutation({
    mutationFn: (text: string) => api.adminPatchMesaWhisper(session.id, text),
    onSuccess: (handout) => {
      qc.setQueryData(adminQueryKeys.mesaHandout(session.id), handout)
      setAudit((prev) => [`${new Date().toLocaleTimeString('pt-BR')} — Sussurro do narrador salvo`, ...prev].slice(0, 20))
    },
  })

  const rotateCodeMutation = useMutation({
    mutationFn: () => api.adminRotateSessionCode(session.id),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: adminQueryKeys.scheduledSessions })
      setAudit((prev) => [`${new Date().toLocaleTimeString('pt-BR')} — Código de acesso rotacionado`, ...prev].slice(0, 20))
    },
  })

  const patchTableMeta = useMutation({
    mutationFn: (meta: SessionTableMeta) =>
      api.adminPatchScheduledSession(session.id, {
        chronicleName: meta.campaignName.trim() || chronicle,
        title: meta.sessionLabel.trim() || session.title,
        tableMeta: meta,
      }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: adminQueryKeys.scheduledSessions })
      void qc.invalidateQueries({ queryKey: adminQueryKeys.sessionLine })
      setEditTableMeta(false)
      logAudit('Ficha da mesa atualizada')
    },
  })

  const markNextSession = useMutation({
    mutationFn: () => {
      const next = new Date(session.scheduledAt)
      next.setDate(next.getDate() + 7)
      const meta = resolveSessionTableMeta(session)
      const campaign = meta.campaignName || session.chronicleName || chronicle
      const suggested = suggestSessionLabel(
        qc.getQueryData<ScheduledSession[]>(adminQueryKeys.scheduledSessions) ?? [],
        campaign,
      )
      return api.adminCreateScheduledSession({
        title: suggested.label,
        chronicleName: campaign,
        scheduledAt: next.toISOString(),
        tableMeta: syncCampaignFields({
          ...meta,
          campaignName: campaign,
          sessionLabel: suggested.label,
          sessionOrdinal: suggested.ordinal,
        }),
      })
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: adminQueryKeys.scheduledSessions })
      void qc.invalidateQueries({ queryKey: ['admin-live-mesas'] })
      void qc.invalidateQueries({ queryKey: adminQueryKeys.handouts })
    },
    onError: (err: Error) => {
      logAudit(`Falha ao marcar próxima sessão · ${err.message}`)
    },
  })

  const awardXpMutation = useMutation({
    mutationFn: () => {
      const amount = Math.min(250, Math.max(1, Math.round(grantXp)))
      xpOpRef.current ??= crypto.randomUUID()
      return api.adminAwardCharacterXp({
        sessionId: session.id,
        participantDisplayName: grantParticipant,
        amount,
        operationId: xpOpRef.current,
      })
    },
    onSuccess: () => {
      const amount = Math.min(250, Math.max(1, Math.round(grantXp)))
      xpOpRef.current = null
      logAudit(`Concedido +${amount} XP para ${grantParticipant} (aplicado na ficha)`)
      void qc.invalidateQueries({ queryKey: adminQueryKeys.mesaHandout(session.id) })
    },
    onError: (err: Error) => {
      const status = 'status' in err ? Number((err as { status?: number }).status) : 0
      if (status >= 400 && status < 500) xpOpRef.current = null
      logAudit(`XP falhou · ${err.message}`)
    },
  })

  const advanceRoundMutation = useMutation({
    mutationFn: () => api.adminAdvanceTurn(session.id),
    onSuccess: () => {
      setRound((r) => {
        const nextRound = r + 1
        logAudit(`Rodada ${nextRound} iniciada`)
        return nextRound
      })
      setActiveTurnIdx(0)
    },
    onError: (err: Error) => {
      logAudit(`Avançar rodada falhou · ${err.message}`)
    },
  })

  if (mesa.isLoading) {
    return <p className="text-sm text-on-surface-variant">Sincronizando comando da mesa…</p>
  }

  if (mesa.isError || !mesa.handout) {
    const message = (mesa.error as Error)?.message ?? 'Não foi possível carregar a mesa.'
    return (
      <div className="mesa-panel space-y-2 p-6 text-sm text-primary">
        <p>{message}</p>
      </div>
    )
  }

  const { handout } = mesa
  const live = handout.status === 'pending_close'
  const threats = handout.sceneThreats ?? []
  const sceneNpcs = handout.sceneNpcs ?? []
  const ambience = handout.chronicleAmbience ?? DEFAULT_CHRONICLE_AMBIENCE
  const restMode = handout.restMode ?? false

  function logAudit(line: string) {
    setAudit((prev) => [`${new Date().toLocaleTimeString('pt-BR')} — ${line}`, ...prev].slice(0, 20))
  }

  function toggleRestMode() {
    const next = !restMode
    restModeMutation.mutate(next, {
      onSuccess: () => logAudit(next ? 'Modo descanso ativado' : 'Modo descanso desligado'),
    })
  }

  function patchAmbienceField(field: keyof ChronicleAmbience, value: string) {
    ambienceMutation.mutate(
      { [field]: value },
      { onSuccess: () => logAudit(`Governança · ${AMBIENCE_FIELD_LABELS[field]}: ${value}`) },
    )
  }

  function grantXpToParticipant() {
    if (!grantParticipant || awardXpMutation.isPending) return
    awardXpMutation.mutate()
  }

  return (
    <div className="min-w-0 space-y-3 pb-4">
      <header className="mesa-panel overflow-hidden">
        <div className="flex flex-wrap items-start justify-between gap-3 px-3.5 py-3 sm:px-4">
          <div>
            <p className="text-xs text-on-surface-variant uppercase tracking-wider">Centro de comando</p>
            <h1 className="font-headline-lg text-xl text-primary sm:text-2xl">
              Sessão #{String(actNumber).padStart(2, '0')}: {chronicle}
            </h1>
            <p className="mt-1 text-sm text-on-surface-variant">
              Narrador · <span className="text-secondary">{narrator}</span>
            </p>
            {session.accessCode ? (
              <div className="mt-1 flex flex-wrap items-center gap-2 text-sm text-on-surface-variant">
                <span>
                  Código da mesa ·{' '}
                  <span className="font-semibold tracking-widest text-secondary">{session.accessCode}</span>
                </span>
                <button
                  type="button"
                  className="btn-secondary px-2 py-0.5 text-[10px]"
                  disabled={rotateCodeMutation.isPending}
                  onClick={() => rotateCodeMutation.mutate()}
                >
                  {rotateCodeMutation.isPending ? 'Girando…' : 'Girar código'}
                </button>
              </div>
            ) : null}
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              className={`btn-secondary text-xs ${restMode ? 'border-secondary text-secondary' : ''}`}
              disabled={!live || restModeMutation.isPending}
              onClick={toggleRestMode}
            >
              Modo descanso
            </button>
            <button
              type="button"
              className={`btn-secondary text-xs ${
                (session.listing ?? 'private') === 'public' ? 'border-secondary text-secondary' : ''
              }`}
              disabled={session.status === 'closed' || listingMutation.isPending}
              onClick={() =>
                listingMutation.mutate((session.listing ?? 'private') === 'public' ? 'private' : 'public')
              }
            >
              <span className="material-symbols-outlined text-sm">
                {(session.listing ?? 'private') === 'public' ? 'public' : 'lock'}
              </span>
              {(session.listing ?? 'private') === 'public' ? 'Pública · Tornar privada' : 'Privada · Tornar pública'}
            </button>
            {isPrimaryOwner ? (
              <button
                type="button"
                className={`btn-secondary text-xs ${session.allowCoNarrator ? 'border-secondary text-secondary' : ''}`}
                disabled={session.status === 'closed' || coNarratorMutation.isPending}
                onClick={() => coNarratorMutation.mutate(!session.allowCoNarrator)}
              >
                {session.allowCoNarrator ? 'Co-narrador: Liberado' : 'Permitir co-narrador'}
              </button>
            ) : null}
            {liveCount > 1 ? (
              <Link to="/admin/mesa?select=1" className="btn-secondary text-xs">
                Trocar mesa ({liveCount})
              </Link>
            ) : null}
            <Link to="/admin" className="btn-secondary text-xs">
              Início
            </Link>
          </div>
        </div>
        {restMode ? (
          <div className="border-t border-secondary/30 bg-secondary/10 px-4 py-2 text-xs text-secondary sm:px-6">
            Descanso ativo — mesa pausada para intervalo; jogadores veem aviso na sala.
          </div>
        ) : null}
      </header>

      <section className="mesa-panel overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-outline-variant/30 bg-surface-container-low/60 px-3.5 py-2.5 sm:px-4">
          <h2 className="font-label-sm text-xs text-secondary uppercase">Ficha da mesa</h2>
          <button
            type="button"
            className="btn-secondary text-xs"
            onClick={() => {
              if (editTableMeta) {
                setEditTableMeta(false)
                setTableMetaDraft(resolveSessionTableMeta(session))
              } else {
                setTableMetaDraft(resolveSessionTableMeta(session))
                setEditTableMeta(true)
              }
            }}
          >
            {editTableMeta ? 'Cancelar' : 'Editar ficha'}
          </button>
        </div>
        <div className="space-y-2.5 p-3.5 sm:p-4">
          {editTableMeta ? (
            <>
              <SessionTableMetaForm
                value={tableMetaDraft}
                onChange={setTableMetaDraft}
                options={{
                  campaignLocked: isCampaignLocked(session.tableMeta, session),
                  sessionLabelReadOnly: true,
                }}
              />
              <button
                type="button"
                className="btn-primary text-xs"
                disabled={patchTableMeta.isPending}
                onClick={() => patchTableMeta.mutate(trimSessionTableMeta(tableMetaDraft))}
              >
                {patchTableMeta.isPending ? 'Salvando…' : 'Salvar ficha'}
              </button>
            </>
          ) : (
            <SessionTableInfoPanel session={session} />
          )}
        </div>
      </section>

      <div className="grid auto-rows-fr grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-5">
        <MetricCard label="Participantes" value={String(handout.participants.length || '—')} hint="Na mesa" />
        <MetricCard label="Personagens" value={String(handout.participants.length || '—')} hint="Registro do ato" />
        <MetricCard label="Sessão" value={`Sala ${String(actNumber).padStart(2, '0')}`} hint={live ? 'Em andamento' : 'Encerrada'} />
        <MetricCard label="Ameaças em cena" value={String(threats.length)} hint="Monstros ativos" />
        <MetricCard label="NPCs em cena" value={String(sceneNpcs.length)} hint="Missões / diálogo" />
      </div>

      <section className="mesa-panel p-3.5 sm:p-4">
        <h2 className="font-label-sm text-xs text-secondary uppercase">Governança da crônica</h2>
        <p className="mt-1 text-xs text-on-surface-variant">{EXTERNAL_MAP_NOTICE_ADMIN}</p>
        <p className="mt-1 text-xs text-on-surface-variant">Clima e tom — refletidos na sala dos jogadores (sem mapa embutido).</p>
        <div className="mt-3 grid gap-2.5 sm:grid-cols-2 lg:grid-cols-4">
          {(Object.keys(CHRONICLE_AMBIENCE_OPTIONS) as Array<keyof ChronicleAmbience>).map((field) => (
            <label key={field} className="text-[0.65rem] uppercase text-on-surface-variant">
              {AMBIENCE_FIELD_LABELS[field]}
              <select
                className="input-feudal mt-1 w-full pl-3 normal-case"
                value={ambience[field]}
                disabled={!live || ambienceMutation.isPending}
                onChange={(e) => patchAmbienceField(field, e.target.value)}
              >
                {CHRONICLE_AMBIENCE_OPTIONS[field].map((opt) => (
                  <option key={opt} value={opt}>
                    {opt}
                  </option>
                ))}
              </select>
            </label>
          ))}
        </div>
      </section>

      <div className="grid gap-3 md:grid-cols-2 md:items-stretch">
        <section className="mesa-panel flex h-full flex-col p-3.5 sm:p-4">
          <h2 className="font-label-sm text-xs text-secondary uppercase">Ameaças em cena</h2>
          <p className="mt-1 text-xs text-on-surface-variant">Escolha monstros publicados no acervo — sem sair da mesa.</p>
          <div className="mt-3">
            <MesaSceneThreatsPanel sessionId={session.id} live={live} threats={threats} />
          </div>
        </section>
        <section className="mesa-panel flex h-full flex-col p-3.5 sm:p-4">
          <MesaSceneNpcsPanel sessionId={session.id} live={live} npcs={sceneNpcs} layout="standalone" />
        </section>
      </div>

      <div className="grid gap-3 lg:grid-cols-2 lg:items-stretch">
        <section className="mesa-panel flex h-full flex-col p-3.5 sm:p-4">
          <div className="flex min-h-0 flex-1 flex-col rounded border border-secondary/40 bg-secondary/5 p-2.5 text-xs">
            <div className="flex items-center justify-between gap-2">
              <span className="font-semibold text-secondary uppercase">Sussurro do narrador</span>
              <button
                type="button"
                className="btn-secondary text-[10px]"
                disabled={whisperMutation.isPending}
                onClick={() => whisperMutation.mutate(whisper)}
              >
                {whisperMutation.isPending ? 'Salvando…' : 'Salvar notas'}
              </button>
            </div>
            <textarea
              className="input-feudal mt-2 min-h-[6rem] flex-1 w-full pl-3 text-sm normal-case lg:min-h-[7rem]"
              placeholder="Notas secretas, corrupção interna, gatilhos…"
              value={whisper}
              onChange={(e) => setWhisper(e.target.value)}
            />
          </div>
        </section>

        <section className="mesa-panel flex h-full flex-col p-3.5 sm:p-4">
          <h2 className="font-label-sm text-xs text-secondary uppercase">Iniciativa & ordem de turnos</h2>
          <p className="mt-1 text-xs text-on-surface-variant">
            Rodada {round} · personagens e ameaças colocados em cena.
          </p>
          <div className="mt-3 flex min-h-[6rem] flex-1 gap-2.5 overflow-x-auto pb-1.5 lg:min-h-[7rem]">
            {handout.participants.map((p, i) => (
              <InitiativeCard
                key={p.characterName}
                order={i + 1}
                name={p.characterName}
                subtitle={p.displayName}
                active={activeTurnIdx === i}
                onAdvance={() => {
                  const total = Math.max(1, handout.participants.length + threats.length)
                  setActiveTurnIdx((i + 1) % total)
                  logAudit(`Turno passado por ${p.characterName}`)
                }}
              />
            ))}
            {threats.map((t, i) => {
              const idx = handout.participants.length + i
              return (
                <InitiativeCard
                  key={t.id}
                  order={idx + 1}
                  name={t.name}
                  subtitle="Monstro"
                  hp={t.hpCurrent}
                  hpMax={t.hpMax}
                  active={activeTurnIdx === idx}
                  onAdvance={() => {
                    const total = Math.max(1, handout.participants.length + threats.length)
                    setActiveTurnIdx((idx + 1) % total)
                    logAudit(`Turno passado por ${t.name}`)
                  }}
                />
              )
            })}
            {handout.participants.length === 0 && threats.length === 0 ? (
              <p className="text-sm text-on-surface-variant">Adicione jogadores ao registro e ameaças na mesa.</p>
            ) : null}
          </div>
        </section>
      </div>

      <div className="grid auto-rows-fr gap-4 lg:grid-cols-2 lg:items-stretch">
        <section className="mesa-panel flex h-full flex-col p-4">
          <h2 className="font-label-sm text-xs text-secondary uppercase">Concessão rápida</h2>
          <p className="mt-2 text-xs text-on-surface-variant">
            XP de +1 a +250 — só o narrador concede; aplica direto na ficha (jogador não altera).
          </p>
          <label className="mt-3 block text-xs uppercase text-on-surface-variant">
            Jogador na mesa
            <select
              className="input-feudal mt-1 w-full py-2 pl-3 text-sm normal-case"
              value={grantParticipant}
              onChange={(e) => setGrantParticipant(e.target.value)}
            >
              <option value="">Selecionar…</option>
              {(session.seats ?? [])
                .filter((s) => !s.leftAt)
                .map((s) => (
                  <option key={`${s.email}-${s.characterId}`} value={s.displayName}>
                    {s.displayName} · {s.characterName}
                  </option>
                ))}
              {(session.seats ?? []).filter((s) => !s.leftAt).length === 0
                ? handout.participants.map((p) => (
                    <option key={p.displayName} value={p.displayName}>
                      {p.displayName} · {p.characterName}
                    </option>
                  ))
                : null}
            </select>
          </label>
          <div className="mt-3 flex flex-wrap items-end gap-2">
            <label className="text-xs uppercase text-on-surface-variant">
              XP
              <input
                type="number"
                min={1}
                max={250}
                className="input-feudal mt-1 block w-24 py-1 pl-2 text-sm normal-case"
                value={grantXp}
                onChange={(e) => setGrantXp(Number(e.target.value) || 1)}
              />
            </label>
            <button
              type="button"
              className="btn-primary text-xs"
              disabled={!grantParticipant || !live || awardXpMutation.isPending}
              onClick={grantXpToParticipant}
            >
              {awardXpMutation.isPending ? 'Concedendo…' : 'Conceder XP'}
            </button>
          </div>
          {awardXpMutation.isError ? (
            <p className="mt-1 text-xs text-primary">{(awardXpMutation.error as Error).message}</p>
          ) : null}
          <div className="mt-2 flex flex-wrap gap-2">
            {[1, 5, 10, 25, 50, 100, 250].map((n) => (
              <button
                key={n}
                type="button"
                className="btn-secondary text-[10px]"
                disabled={!grantParticipant || !live}
                onClick={() => {
                  setGrantXp(n)
                }}
              >
                {n}
              </button>
            ))}
          </div>
          <MesaCoinGrant sessionId={session.id} participant={grantParticipant} live={live} />
        </section>

        <section className="mesa-panel flex h-full flex-col p-4">
          <h2 className="font-label-sm text-xs text-secondary uppercase">Objetivos do ato</h2>
          {handout.missions.length === 0 ? (
            <p className="mt-2 text-xs text-on-surface-variant">Continuidade da crônica.</p>
          ) : (
            <ul className="mt-2 space-y-1 text-sm">
              {handout.missions.map((m, i) => (
                <li key={`${m.title}-${i}`}>
                  {m.title}{' '}
                  <span className="text-[0.65rem] text-secondary uppercase">{PRIORITY_LABEL[m.priority]}</span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      <div className="grid gap-4 lg:grid-cols-12">
        <MesaAuctionDesk sessionId={session.id} live={live} />
      </div>

      <section className="mesa-panel p-4 sm:p-5">
        <h2 className="font-label-sm text-xs text-secondary uppercase">Teatro da mente</h2>
        <p className="mt-1 text-xs text-on-surface-variant">
          Descreva a cena atual para os jogadores. O resumo alimenta o handout ao encerrar a sessão.
        </p>
        <textarea
          className="input-feudal mt-3 min-h-28 w-full pl-4 font-serif text-sm"
          placeholder="A catedral respira incenso e pó; sombras colossais deslizam entre as colunas…"
          value={mesa.narrativeSummary}
          disabled={!live}
          onChange={(e) => mesa.setNarrativeSummary(e.target.value)}
        />
        <div className="mt-3 flex flex-wrap gap-2">
          {live ? (
            <button
              type="button"
              className="btn-primary text-xs"
              disabled={!mesa.dirty || mesa.saveNarrative.isPending}
              onClick={() => {
                mesa.saveNarrative.mutate()
                logAudit('Teatro da mente salvo')
              }}
            >
              Salvar resumo narrativo
            </button>
          ) : null}
          {live ? (
            <button
              type="button"
              className="btn-secondary text-xs"
              disabled={closeSessionMutation.isPending}
              onClick={() => closeSessionMutation.mutate()}
            >
              {closeSessionMutation.isPending ? 'Encerrando…' : 'Encerrar sessão'}
            </button>
          ) : null}
          {live ? (
            <button
              type="button"
              className="btn-secondary text-xs"
              disabled={markNextSession.isPending}
              onClick={() => {
                markNextSession.mutate(undefined, {
                  onSuccess: (created) => {
                    logAudit(`Próxima sessão marcada · ${new Date(created.scheduledAt).toLocaleString('pt-BR')}`)
                    navigate(`/admin/mesa/${created.id}`)
                  },
                })
              }}
            >
              Marca próxima sessão
            </button>
          ) : null}
          {live ? (
            <button
              type="button"
              className="btn-primary text-xs"
              disabled={advanceRoundMutation.isPending}
              onClick={() => advanceRoundMutation.mutate()}
            >
              {advanceRoundMutation.isPending ? 'Avançando…' : 'Concluir rodada'}
            </button>
          ) : null}
          {handout.status === 'closed' && !handout.publishedToPlayers ? (
            <button
              type="button"
              className="btn-primary text-xs"
              disabled={mesa.patchHandout.isPending}
              onClick={() => mesa.patchHandout.mutate({ publishedToPlayers: true })}
            >
              Publicar handout
            </button>
          ) : null}
        </div>
      </section>

      <section className="mesa-panel p-4 sm:p-5">
        <div className="flex items-center justify-between gap-2">
          <h2 className="font-label-sm text-xs text-secondary uppercase">Auditoria da crônica</h2>
          <button
            type="button"
            className="btn-secondary text-xs"
            onClick={() => {
              const actions = (sessionActions.data ?? []).map(
                (a) => `- [${new Date(a.createdAt).toLocaleTimeString('pt-BR')}] ${a.actorName}: ${a.summary}`,
              )
              const report = [
                `Crônica: ${chronicle}`,
                `Rodada atual: ${round}`,
                `Data da exportação: ${new Date().toLocaleString('pt-BR')}`,
                '',
                '--- Ações da mesa ---',
                ...(actions.length ? actions : ['Sem ações persistidas ainda.']),
                '',
                '--- Log do narrador ---',
                ...audit,
              ].join('\n')
              const blob = new Blob([report], { type: 'text/plain;charset=utf-8' })
              const url = URL.createObjectURL(blob)
              const link = document.createElement('a')
              link.href = url
              link.download = `mesa-${session.id}-rodada-${round}.txt`
              link.click()
              URL.revokeObjectURL(url)
              logAudit(`Turno da rodada ${round} exportado`)
            }}
          >
            Exportar turno
          </button>
        </div>
        <ul className="mt-3 max-h-48 space-y-1 overflow-y-auto text-xs text-on-surface-variant">
          {(sessionActions.data ?? []).map((act) => (
            <li key={act.id} className="text-on-surface">
              {new Date(act.createdAt).toLocaleTimeString('pt-BR')} — {act.actorName}: {act.summary}
            </li>
          ))}
          {audit.map((line, i) => (
            <li key={`${line}-${i}`}>{line}</li>
          ))}
        </ul>
      </section>
    </div>
  )
}

function MetricCard({ label, value, hint }: { label: string; value: string; hint: string }) {
  return (
    <div className="mesa-panel flex h-full flex-col justify-between p-4">
      <p className="text-[0.65rem] uppercase tracking-wider text-on-surface-variant">{label}</p>
      <p className="mt-1 font-serif text-2xl text-on-surface">{value}</p>
      <p className="mt-1 text-xs text-secondary">{hint}</p>
    </div>
  )
}

function InitiativeCard({
  order,
  name,
  subtitle,
  active,
  hp,
  hpMax,
  onAdvance,
}: {
  order: number
  name: string
  subtitle: string
  active?: boolean
  hp?: number
  hpMax?: number
  onAdvance?: () => void
}) {
  return (
    <div
      className={`min-w-[10rem] shrink-0 rounded border p-3 ${
        active ? 'border-primary/50 bg-primary/10' : 'border-outline-variant/40 bg-surface-container-low/50'
      }`}
    >
      <p className="text-[0.65rem] text-secondary">{order}º</p>
      <p className="font-serif text-sm text-on-surface">{name}</p>
      <p className="text-xs text-on-surface-variant">{subtitle}</p>
      {hp != null && hpMax != null ? (
        <div className="mt-2">
          <StatBar label="HP" current={hp} max={hpMax} />
        </div>
      ) : null}
      <button type="button" className="btn-secondary mt-2 w-full text-[10px]" onClick={onAdvance}>
        Passar vez
      </button>
    </div>
  )
}
