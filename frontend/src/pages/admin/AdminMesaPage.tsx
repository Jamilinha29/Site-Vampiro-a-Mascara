import { useState } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { AdminMesaWorkbench } from '../../components/admin/AdminMesaWorkbench'
import { useToast } from '../../components/ui/ToastProvider'
import { api } from '../../services/api'
import { adminQueryKeys, playerQueryKeys } from '../../lib/queryKeys'
import { findTodayMesaSession, mesaDisplayName } from '../../lib/mesaSession'
import type { LiveMesaSummary } from '../../types/chronicle'

type JoinModalState = {
  mesa: LiveMesaSummary
  mode: 'co-narrator' | 'player'
} | null

export default function AdminMesaPage() {
  const { sessionId } = useParams()
  const [searchParams] = useSearchParams()
  const forceSelect = searchParams.get('select') === '1'
  const navigate = useNavigate()
  const qc = useQueryClient()
  const { push } = useToast()

  const [joinModal, setJoinModal] = useState<JoinModalState>(null)
  const [accessCode, setAccessCode] = useState('')
  const [characterId, setCharacterId] = useState('')

  const { data: scheduled = [], isLoading: loadingScheduled } = useQuery({
    queryKey: adminQueryKeys.scheduledSessions,
    queryFn: () => api.adminListScheduledSessions(),
  })
  const { data: liveMesas = [], isLoading: loadingLive } = useQuery({
    queryKey: ['admin-live-mesas'],
    queryFn: () => api.adminListLiveMesas(),
  })
  const { data: handouts = [] } = useQuery({
    queryKey: adminQueryKeys.handouts,
    queryFn: () => api.adminListHandouts(),
  })
  const { data: profile } = useQuery({
    queryKey: playerQueryKeys.profile,
    queryFn: () => api.getMeProfile(),
  })

  const characters = profile?.characters ?? []

  const joinCoNarrator = useMutation({
    mutationFn: ({ id, code }: { id: string; code?: string }) => api.adminJoinCoNarrator(id, code ?? ''),
    onSuccess: (joined) => {
      push('Você entrou como narrador secundário nesta mesa.', 'success')
      setJoinModal(null)
      setAccessCode('')
      void qc.invalidateQueries({ queryKey: adminQueryKeys.scheduledSessions })
      void qc.invalidateQueries({ queryKey: ['admin-live-mesas'] })
      navigate(`/admin/mesa/${joined.id}`)
    },
    onError: (e: Error) => push(e.message, 'error'),
  })

  const joinAsPlayer = useMutation({
    mutationFn: ({ id, code, charId }: { id: string; code?: string; charId: string }) =>
      api.joinSessionWithCode(id, { accessCode: code ?? '', characterId: charId }),
    onSuccess: (_joined, vars) => {
      push('Entrou na mesa como jogador.', 'success')
      setJoinModal(null)
      setAccessCode('')
      void qc.invalidateQueries({ queryKey: playerQueryKeys.scheduledSessions })
      void qc.invalidateQueries({ queryKey: ['admin-live-mesas'] })
      navigate(`/user/sessions/${vars.id}/table`)
    },
    onError: (e: Error) => push(e.message, 'error'),
  })

  if (loadingScheduled || loadingLive) {
    return <p className="text-sm text-on-surface-variant">Abrindo a mesa…</p>
  }

  const computeActNumber = (targetId: string, fallbackTitle: string) => {
    const found = scheduled.find((s) => s.id === targetId)
    const key = (found ? mesaDisplayName(found) : fallbackTitle).trim().toLowerCase()
    const sameChronicle = handouts.filter((h) => (h.chronicleName ?? h.title).trim().toLowerCase() === key)
    return Math.max(1, sameChronicle.length)
  }

  if (sessionId && !forceSelect) {
    const selected = scheduled.find((s) => s.id === sessionId)
    if (selected) {
      return (
        <AdminMesaWorkbench
          session={selected}
          actNumber={computeActNumber(selected.id, mesaDisplayName(selected))}
          liveCount={liveMesas.length}
        />
      )
    }
  }

  // Se existe exatamente 1 mesa confirmada ao vivo que este narrador conduz/co-narra, abre direto sem precisar clicar em "Painel da mesa"
  if (!forceSelect && liveMesas.length === 1 && (liveMesas[0].isOwner || liveMesas[0].isCoNarrator)) {
    const onlyLive = scheduled.find((s) => s.id === liveMesas[0].id)
    if (onlyLive) {
      return (
        <AdminMesaWorkbench
          session={onlyLive}
          actNumber={computeActNumber(onlyLive.id, mesaDisplayName(onlyLive))}
          liveCount={1}
        />
      )
    }
  }

  // Mais de 1 mesa ao vivo (ou mesa ao vivo de outro narrador disponível para co-narrar / participar)
  if (liveMesas.length >= 1) {
    return (
      <div className="space-y-4 pb-4">
        <header className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="font-label-sm text-[11px] font-semibold tracking-[0.18em] text-secondary uppercase">
              Mesas confirmadas ao vivo
            </p>
            <h1 className="font-headline-lg mt-0.5 text-xl text-on-surface sm:text-2xl">
              Selecionar mesa ao vivo ({liveMesas.length})
            </h1>
            <p className="mt-1 max-w-3xl text-xs text-on-surface-variant sm:text-sm">
              Escolha a mesa que deseja conduzir, entrar como narrador secundário (se o narrador principal permitir) ou participar como jogador.
            </p>
          </div>
          <Link to="/admin/sessions" className="btn-secondary text-xs">
            Gerenciar sessões
          </Link>
        </header>

        <div className="grid gap-3 md:grid-cols-2">
          {liveMesas.map((m) => {
            const title = m.chronicleName?.trim() || m.title
            const isPublic = m.listing === 'public'
            const defaultCharId = characters.find((c) => c.isPrimary)?.id ?? characters[0]?.id ?? ''
            return (
              <article key={m.id} className="mesa-panel flex flex-col justify-between gap-3 p-3.5 sm:p-4">
                <div>
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/40 bg-emerald-500/10 px-2.5 py-0.5 text-[10px] font-semibold tracking-wider text-emerald-300 uppercase">
                      <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                      Ao vivo
                    </span>
                    <span
                      className={`rounded-full border px-2.5 py-0.5 text-[10px] font-semibold tracking-wider uppercase ${
                        isPublic
                          ? 'border-secondary/45 bg-secondary/10 text-secondary'
                          : 'border-primary/45 bg-primary-container/20 text-primary'
                      }`}
                    >
                      {isPublic ? 'Pública' : 'Privada · código'}
                    </span>
                  </div>
                  <h2 className="mt-3 font-serif text-xl text-on-surface">{title}</h2>
                  <p className="mt-1 text-xs text-on-surface-variant">
                    Narrador principal: <strong className="text-on-surface">{m.narratorName}</strong>
                  </p>
                  <p className="mt-1 text-xs text-on-surface-variant">
                    {m.seatedCount} jogador(es) sentado(s) ·{' '}
                    {m.allowCoNarrator ? 'Aceita narrador secundário' : 'Apenas narrador principal'}
                  </p>
                </div>

                <div className="flex flex-wrap gap-2 border-t border-outline-variant/30 pt-3">
                  {m.isOwner || m.isCoNarrator ? (
                    <Link to={`/admin/mesa/${m.id}`} className="btn-primary text-xs">
                      {m.isOwner ? 'Abrir mesa ao vivo' : 'Narrar como secundário'}
                    </Link>
                  ) : m.allowCoNarrator ? (
                    <button
                      type="button"
                      className="btn-primary text-xs"
                      disabled={joinCoNarrator.isPending}
                      onClick={() => {
                        if (isPublic) {
                          joinCoNarrator.mutate({ id: m.id })
                        } else {
                          setAccessCode('')
                          setJoinModal({ mesa: m, mode: 'co-narrator' })
                        }
                      }}
                    >
                      Narrar como secundário
                    </button>
                  ) : null}

                  {m.isSeated ? (
                    <Link to={`/user/sessions/${m.id}/table`} className="btn-secondary text-xs">
                      Ir para mesa (jogador)
                    </Link>
                  ) : (
                    <button
                      type="button"
                      className="btn-secondary text-xs"
                      onClick={() => {
                        setAccessCode('')
                        setCharacterId(defaultCharId)
                        setJoinModal({ mesa: m, mode: 'player' })
                      }}
                    >
                      {isPublic ? 'Participar da mesa' : 'Participar com código'}
                    </button>
                  )}
                </div>
              </article>
            )
          })}
        </div>

        {joinModal ? (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4"
            role="dialog"
            aria-modal="true"
          >
            <div className="card-surface w-full max-w-md space-y-4 p-6">
              <h2 className="font-headline-sm text-lg text-on-surface">
                {joinModal.mode === 'co-narrator' ? 'Entrar como narrador secundário' : 'Participar da mesa'}
              </h2>
              <p className="text-xs text-on-surface-variant">
                {joinModal.mesa.chronicleName || joinModal.mesa.title} ·{' '}
                {joinModal.mesa.listing === 'public'
                  ? 'Mesa pública — entrada direta.'
                  : 'Mesa privada — informe o código da sala.'}
              </p>

              {joinModal.mesa.listing === 'private' ? (
                <label className="block text-xs uppercase text-on-surface-variant">
                  Código da mesa
                  <input
                    className="input-feudal mt-1 pl-4 uppercase tracking-widest"
                    value={accessCode}
                    onChange={(e) => setAccessCode(e.target.value)}
                    placeholder="Ex: A7K2QM"
                  />
                </label>
              ) : null}

              {joinModal.mode === 'player' ? (
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
                  {characters.length === 0 ? (
                    <span className="mt-1 block text-[11px] normal-case text-primary">
                      Crie um personagem na Área do jogador antes de participar como jogador.
                    </span>
                  ) : null}
                </label>
              ) : null}

              <div className="flex justify-end gap-2">
                <button type="button" className="btn-secondary text-xs" onClick={() => setJoinModal(null)}>
                  Cancelar
                </button>
                {joinModal.mode === 'co-narrator' ? (
                  <button
                    type="button"
                    className="btn-primary text-xs"
                    disabled={(joinModal.mesa.listing === 'private' && !accessCode.trim()) || joinCoNarrator.isPending}
                    onClick={() => joinCoNarrator.mutate({ id: joinModal.mesa.id, code: accessCode.trim() })}
                  >
                    {joinCoNarrator.isPending ? 'Entrando…' : 'Confirmar'}
                  </button>
                ) : (
                  <button
                    type="button"
                    className="btn-primary text-xs"
                    disabled={
                      !characterId ||
                      (joinModal.mesa.listing === 'private' && !accessCode.trim()) ||
                      joinAsPlayer.isPending
                    }
                    onClick={() =>
                      joinAsPlayer.mutate({
                        id: joinModal.mesa.id,
                        code: joinModal.mesa.listing === 'public' ? '' : accessCode.trim(),
                        charId: characterId,
                      })
                    }
                  >
                    {joinAsPlayer.isPending ? 'Entrando…' : 'Entrar na mesa'}
                  </button>
                )}
              </div>
            </div>
          </div>
        ) : null}
      </div>
    )
  }

  // Fallback para mesa agendada hoje (ainda não confirmada ao vivo)
  const todayMesa = findTodayMesaSession(scheduled)
  if (todayMesa) {
    return (
      <AdminMesaWorkbench
        session={todayMesa}
        actNumber={computeActNumber(todayMesa.id, mesaDisplayName(todayMesa))}
        liveCount={0}
      />
    )
  }

  return (
    <div className="card-surface space-y-4 p-8 text-center">
      <h1 className="font-headline-lg text-2xl text-on-surface">Mesa ao vivo</h1>
      <p className="text-sm text-on-surface-variant">
        Nenhuma mesa aberta ao vivo no momento. Em <strong className="text-on-surface">Sessões</strong>, crie uma mesa e
        clique em <strong className="text-on-surface">Abrir ao vivo</strong>.
      </p>
      <div className="flex flex-wrap justify-center gap-2">
        <Link to="/admin/sessions" className="btn-primary inline-flex text-xs">
          Ir para Sessões
        </Link>
        <Link to="/admin" className="btn-secondary inline-flex text-xs">
          Voltar ao início
        </Link>
      </div>
    </div>
  )
}
