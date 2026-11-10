import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import type { ChronicleAmbience, ScheduledSession } from '../../types/chronicle'
import { useMesaHandout } from '../../hooks/useMesaHandout'
import { useAuthStore } from '../../stores/authStore'
import { StatBar } from '../domain/StatBar'
import { mesaDisplayName } from '../../lib/mesaSession'
import { MesaSceneThreatsPanel } from './MesaSceneThreatsPanel'
import { MesaSceneNpcsPanel } from './MesaSceneNpcsPanel'
import {
  AMBIENCE_FIELD_LABELS,
  CHRONICLE_AMBIENCE_OPTIONS,
  DEFAULT_CHRONICLE_AMBIENCE,
  EXTERNAL_MAP_NOTICE_ADMIN,
} from '../../lib/chronicleAmbience'
import { api } from '../../services/api'
import { adminQueryKeys } from '../../lib/queryKeys'
import { SessionTableInfoPanel, SessionTableMetaForm } from '../session/SessionTableInfoPanel'
import {
  isCampaignLocked,
  resolveSessionTableMeta,
  suggestSessionLabel,
  syncCampaignFields,
} from '../../lib/sessionTableMeta'
import type { SessionTableMeta } from '../../types/chronicle'

const PRIORITY_LABEL = { baixa: 'Secundária', media: 'Principal', alta: 'Urgente' } as const

type Props = {
  session: ScheduledSession
  actNumber: number
}

export function AdminMesaWorkbench({ session, actNumber }: Props) {
  const navigate = useNavigate()
  const qc = useQueryClient()
  const chronicle = mesaDisplayName(session)
  const narrator = useAuthStore((s) => s.session?.displayName ?? 'Mestre')
  const mesa = useMesaHandout(session.id)
  const [round, setRound] = useState(1)
  const [audit, setAudit] = useState<string[]>([])
  const [whisper, setWhisper] = useState('')
  const [grantParticipant, setGrantParticipant] = useState('')
  const [grantXp, setGrantXp] = useState(10)
  const [editTableMeta, setEditTableMeta] = useState(false)
  const [tableMetaDraft, setTableMetaDraft] = useState<SessionTableMeta>(() => resolveSessionTableMeta(session))

  useEffect(() => {
    if (audit.length === 0) {
      setAudit([`${new Date().toLocaleTimeString('pt-BR')} — Mesa aberta · ${chronicle}`])
    }
  }, [audit.length, chronicle])

  useEffect(() => {
    if (!editTableMeta) setTableMetaDraft(resolveSessionTableMeta(session))
  }, [session, editTableMeta])

  const restModeMutation = useMutation({
    mutationFn: (restMode: boolean) => api.adminSetMesaRestMode(session.id, restMode),
    onSuccess: (handout) => {
      qc.setQueryData(adminQueryKeys.mesaHandout(session.id), handout)
    },
  })

  const ambienceMutation = useMutation({
    mutationFn: (patch: Partial<ChronicleAmbience>) => api.adminPatchMesaAmbience(session.id, patch),
    onSuccess: (handout) => {
      qc.setQueryData(adminQueryKeys.mesaHandout(session.id), handout)
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
    if (!grantParticipant) return
    const amount = Math.min(250, Math.max(1, Math.round(grantXp)))
    void api
      .adminAwardCharacterXp({
        sessionId: session.id,
        participantDisplayName: grantParticipant,
        amount,
      })
      .then(() => {
        logAudit(`Concedido +${amount} XP para ${grantParticipant} (aplicado na ficha)`)
        void qc.invalidateQueries({ queryKey: adminQueryKeys.mesaHandout(session.id) })
      })
      .catch((e: unknown) => {
        const message = e instanceof Error ? e.message : 'Falha ao conceder XP'
        logAudit(`XP falhou · ${message}`)
      })
  }

  return (
    <div className="space-y-4 pb-8">
      <header className="mesa-panel overflow-hidden">
        <div className="flex flex-wrap items-start justify-between gap-4 px-4 py-4 sm:px-6">
          <div>
            <p className="text-xs text-on-surface-variant uppercase tracking-wider">Centro de comando</p>
            <h1 className="font-headline-lg text-xl text-primary sm:text-2xl">
              Sessão #{String(actNumber).padStart(2, '0')}: {chronicle}
            </h1>
            <p className="mt-1 text-sm text-on-surface-variant">
              Narrador · <span className="text-secondary">{narrator}</span>
            </p>
            {session.accessCode ? (
              <p className="mt-1 text-sm text-on-surface-variant">
                Código da mesa ·{' '}
                <span className="font-semibold tracking-widest text-secondary">{session.accessCode}</span>
              </p>
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
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-outline-variant/30 bg-surface-container-low/60 px-4 py-3 sm:px-6">
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
        <div className="space-y-3 p-4 sm:p-6">
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
                onClick={() => patchTableMeta.mutate(syncCampaignFields(tableMetaDraft))}
              >
                {patchTableMeta.isPending ? 'Salvando…' : 'Salvar ficha'}
              </button>
            </>
          ) : (
            <SessionTableInfoPanel session={session} />
          )}
        </div>
      </section>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <MetricCard label="Participantes" value={String(handout.participants.length || '—')} hint="Na mesa" />
        <MetricCard label="Personagens" value={String(handout.participants.length || '—')} hint="Registro do ato" />
        <MetricCard label="Sessão" value={`Sala ${String(actNumber).padStart(2, '0')}`} hint={live ? 'Em andamento' : 'Encerrada'} />
        <MetricCard label="Ameaças em cena" value={String(threats.length)} hint="Monstros ativos" />
        <MetricCard label="NPCs em cena" value={String(sceneNpcs.length)} hint="Missões / diálogo" />
      </div>

      <section className="mesa-panel p-4 sm:p-5">
        <h2 className="font-label-sm text-xs text-secondary uppercase">Governança da crônica</h2>
        <p className="mt-1 text-xs text-on-surface-variant">{EXTERNAL_MAP_NOTICE_ADMIN}</p>
        <p className="mt-1 text-xs text-on-surface-variant">Clima e tom — refletidos na sala dos jogadores (sem mapa embutido).</p>
        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {(Object.keys(CHRONICLE_AMBIENCE_OPTIONS) as Array<keyof ChronicleAmbience>).map((field) => (
            <label key={field} className="text-[0.65rem] uppercase text-on-surface-variant">
              {AMBIENCE_FIELD_LABELS[field]}
              <select
                className="input-feudal mt-1 w-full py-2 pl-3 text-sm normal-case"
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

      <div className="grid gap-4 lg:grid-cols-2">
        <section className="mesa-panel p-4 sm:p-5">
          <h2 className="font-label-sm text-xs text-secondary uppercase">Ameaças em cena</h2>
          <p className="mt-1 text-xs text-on-surface-variant">Escolha monstros publicados no acervo — sem sair da mesa.</p>
          <div className="mt-4">
            <MesaSceneThreatsPanel sessionId={session.id} live={live} threats={threats} />
          </div>
        </section>
        <section className="mesa-panel p-4 sm:p-5">
          <MesaSceneNpcsPanel sessionId={session.id} live={live} npcs={sceneNpcs} layout="standalone" />
        </section>
      </div>

      <div className="grid gap-4 lg:grid-cols-2 lg:items-stretch">
        <section className="mesa-panel flex h-full flex-col p-4 sm:p-6">
          <label className="flex min-h-0 flex-1 flex-col rounded border border-secondary/40 bg-secondary/5 p-3 text-xs">
            <span className="font-semibold text-secondary uppercase">Sussurro do narrador</span>
            <textarea
              className="input-feudal mt-2 min-h-[8rem] flex-1 w-full pl-3 text-sm normal-case lg:min-h-[10rem]"
              placeholder="Notas secretas, corrupção interna, gatilhos…"
              value={whisper}
              onChange={(e) => setWhisper(e.target.value)}
            />
          </label>
        </section>

        <section className="mesa-panel flex h-full flex-col p-4 sm:p-5">
          <h2 className="font-label-sm text-xs text-secondary uppercase">Iniciativa & ordem de turnos</h2>
          <p className="mt-1 text-xs text-on-surface-variant">
            Rodada {round} · arraste mental: personagens e NPCs colocados em cena.
          </p>
          <div className="mt-4 flex min-h-[8rem] flex-1 gap-3 overflow-x-auto pb-2 lg:min-h-[10rem]">
            {handout.participants.map((p, i) => (
              <InitiativeCard key={p.characterName} order={i + 1} name={p.characterName} subtitle={p.displayName} active={i === 0} />
            ))}
            {threats.map((t, i) => (
              <InitiativeCard
                key={t.id}
                order={handout.participants.length + i + 1}
                name={t.name}
                subtitle="Monstro"
                hp={t.hpCurrent}
                hpMax={t.hpMax}
              />
            ))}
            {handout.participants.length === 0 && threats.length === 0 ? (
              <p className="text-sm text-on-surface-variant">Adicione jogadores ao registro e ameaças na mesa.</p>
            ) : null}
          </div>
        </section>
      </div>

      <div className="grid gap-4 lg:grid-cols-12">
        <section className="mesa-panel p-4 lg:col-span-6">
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
              disabled={!grantParticipant || !live || mesa.patchHandout.isPending}
              onClick={grantXpToParticipant}
            >
              Conceder XP
            </button>
          </div>
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
        </section>

        <section className="mesa-panel p-4 lg:col-span-6">
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
              disabled={mesa.patchHandout.isPending}
              onClick={() => mesa.patchHandout.mutate({ status: 'closed' })}
            >
              Encerrar sessão
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
              onClick={() => {
                setRound((r) => r + 1)
                logAudit(`Rodada ${round + 1} iniciada`)
              }}
            >
              Concluir rodada
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
          <button type="button" className="btn-secondary text-xs" onClick={() => logAudit('Exportação de turno (em breve)')}>
            Exportar turno
          </button>
        </div>
        <ul className="mt-3 max-h-48 space-y-1 overflow-y-auto text-xs text-on-surface-variant">
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
    <div className="mesa-panel p-4">
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
}: {
  order: number
  name: string
  subtitle: string
  active?: boolean
  hp?: number
  hpMax?: number
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
      <button type="button" className="btn-secondary mt-2 w-full text-[10px]">
        Passar vez
      </button>
    </div>
  )
}
