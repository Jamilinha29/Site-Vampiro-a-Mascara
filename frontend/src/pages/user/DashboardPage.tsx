import { Link, useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { AchievementMural } from '../../components/domain/AchievementMural'
import { StatBar } from '../../components/domain/StatBar'
import { WalletLedgerPanel } from '../../components/domain/WalletLedgerPanel'
import { CharacterArmorClassBar } from '../../components/characters/CharacterArmorClassBar'
import { api } from '../../services/api'
import { playerQueryKeys } from '../../lib/queryKeys'
import { useAuthStore } from '../../stores/authStore'

export default function DashboardPage() {
  const navigate = useNavigate()
  const session = useAuthStore((s) => s.session)
  const { data, isLoading, isError } = useQuery({
    queryKey: playerQueryKeys.dashboard,
    queryFn: () => api.getMeDashboard(),
  })
  const { data: profile } = useQuery({
    queryKey: playerQueryKeys.profile,
    queryFn: () => api.getMeProfile(),
  })

  if (isLoading) {
    return <p className="text-on-surface-variant">Consultando a corte…</p>
  }

  if (isError || !data) {
    return (
      <div className="card-surface p-8 text-center">
        <p className="text-on-surface-variant">Nenhum dado de campanha vinculado ainda.</p>
        <Link to="/user/characters/new/lineage" className="btn-primary mt-4 inline-flex">
          Criar personagem
        </Link>
      </div>
    )
  }

  const active = data.characters.find((c) => c.selected) ?? data.characters[0]
  const activeFull = profile?.characters.find((c) => c.id === active?.id) ?? null
  const chronicleTitle = data.activeChronicle?.name ?? 'As Crônicas de Beladona'

  function characterBlurb(id: string) {
    const ch = profile?.characters.find((c) => c.id === id)
    if (!ch) return ''
    const parts = [ch.identity?.nature, ch.identity?.demeanor, ch.clan].filter(Boolean)
    return parts.join(' · ')
  }

  return (
    <div className="space-y-4 pb-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="font-label-sm text-[11px] font-semibold tracking-[0.18em] text-secondary uppercase">
            Sua história continua
          </p>
          <h1 className="font-headline-lg mt-0.5 text-xl text-on-surface sm:text-2xl">
            Bem-vindo, {session?.displayName ?? 'jogador'}.
          </h1>
          <p className="mt-0.5 text-xs text-on-surface-variant sm:text-sm">
            Seus personagens, seus vínculos e o próximo capítulo da crônica.
          </p>
        </div>
        <Link to="/user/characters/new/lineage" className="btn-secondary text-xs">
          <span className="material-symbols-outlined text-base text-secondary">person_add</span>
          Novo personagem
        </Link>
      </div>

      <header className="mesa-panel overflow-hidden">
        <div className="border-b border-outline-variant/30 bg-surface-container-low/60 px-3.5 py-3 sm:px-4">
          <p className="font-label-sm text-[0.65rem] text-secondary uppercase tracking-[0.2em]">{chronicleTitle}</p>
          <h1 className="font-headline-lg mt-0.5 text-lg text-on-surface sm:text-xl">
            {data.activeChronicle?.act ?? 'Início da crônica'}
          </h1>
          <div className="mt-1.5 flex flex-wrap gap-3 text-xs text-on-surface-variant">
            <span>
              Jogador · <span className="text-on-surface">{session?.displayName ?? '—'}</span>
            </span>
            {data.nextSession ? (
              <span>
                Próxima mesa ·{' '}
                {new Date(data.nextSession.scheduledAt).toLocaleString('pt-BR', {
                  weekday: 'short',
                  day: 'numeric',
                  month: 'short',
                  hour: '2-digit',
                  minute: '2-digit',
                })}
              </span>
            ) : null}
          </div>
          {active ? (
            <p className="mt-1.5 text-xs text-on-surface-variant sm:text-sm">
              Personagem vinculado · <strong className="text-secondary">{active.name}</strong>
            </p>
          ) : null}
        </div>
        <div className="flex flex-wrap items-center justify-between gap-2 px-3.5 py-2 sm:px-4">
          <p className="text-xs text-secondary">Modo descanso pode restringir combates e feira — conforme mesa ao vivo.</p>
          <Link to="/user/sessions" className="btn-secondary text-xs">
            Ver sessões
          </Link>
        </div>
      </header>

      <div className="grid gap-4 lg:grid-cols-2 lg:items-stretch">
        <section className="mesa-panel flex h-full flex-col justify-center p-4">
          {active ? (
            <div className="flex flex-col gap-4 sm:flex-row">
              <div className="mx-auto flex h-40 w-32 shrink-0 items-center justify-center overflow-hidden rounded border border-secondary/35 bg-surface-container-high sm:mx-0">
                {activeFull?.portraitUrl ? (
                  <img src={activeFull.portraitUrl} alt={active.name} className="h-full w-full object-cover" />
                ) : (
                  <span className="material-symbols-outlined text-4xl text-outline">person</span>
                )}
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-xs text-secondary uppercase">
                  Nível {active.level ?? activeFull?.level ?? 1}
                  {active.subclass ? ` · ${active.subclass}` : ''}
                  {active.secondarySubclass ? ` / ${active.secondarySubclass}` : ''}
                </p>
                <h2 className="font-serif text-2xl text-on-surface">{active.name}</h2>
                <p className="text-sm text-on-surface-variant">
                  {active.species}
                  {active.clan ? ` · ${active.clan}` : ''}
                </p>
                <div className="mt-4 grid gap-3 sm:grid-cols-2">
                  <StatBar label="Vitalidade" current={active.hp.current} max={active.hp.max} variant="health" />
                  {active.blood ? (
                    <StatBar label="Sangue" current={active.blood.current} max={active.blood.max} variant="blood" />
                  ) : null}
                  <StatBar label="Vontade" current={active.will.current} max={active.will.max} variant="will" />
                  <StatBar label="XP" current={active.xp.current} max={active.xp.max} variant="xp" />
                  {activeFull ? <CharacterArmorClassBar character={activeFull} /> : null}
                </div>
                <div className="mt-4 flex flex-wrap gap-2">
                  <Link to={`/user/characters/${active.id}?view=ficha`} className="btn-primary text-xs">
                    Ficha
                  </Link>
                  <Link to={`/user/characters/${active.id}?view=inventario`} className="btn-secondary text-xs">
                    Inventário
                  </Link>
                </div>
              </div>
            </div>
          ) : (
            <div className="flex min-h-[13.5rem] flex-col items-center justify-center gap-2 px-4 py-6 text-center">
              <span className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-secondary/35 bg-surface-container-high text-secondary">
                <span className="material-symbols-outlined text-2xl">person_add</span>
              </span>
              <h2 className="font-serif text-lg text-on-surface">Nenhum personagem ativo</h2>
              <p className="max-w-sm text-xs leading-relaxed text-on-surface-variant">
                Crie um personagem para acompanhar vitalidade, atributos, equipamentos e vínculo com a mesa aqui.
              </p>
              <Link to="/user/characters/new/lineage" className="btn-primary mt-2 text-xs">
                Forjar primeiro personagem
              </Link>
            </div>
          )}
        </section>

        <aside className="grid h-full gap-3.5 sm:grid-cols-2 lg:grid-cols-1 lg:grid-rows-2">
          <div className="mesa-panel flex h-full flex-col justify-between p-4">
            <div>
              <h3 className="font-label-sm text-xs text-secondary uppercase">Carteira imperial</h3>
              <p className="mt-1 text-[11px] text-on-surface-variant">Recebimentos e gastos recentes</p>
            </div>
            <div className="mt-2.5">
              <WalletLedgerPanel />
            </div>
          </div>
          <div className="mesa-panel flex h-full flex-col justify-between p-4">
            <div>
              <h3 className="font-label-sm text-xs text-secondary uppercase">Próxima sessão</h3>
              {data.nextSession ? (
                <>
                  <p className="mt-2 font-serif text-lg text-on-surface">{data.nextSession.title}</p>
                  <p className="text-sm text-on-surface-variant">
                    {new Date(data.nextSession.scheduledAt).toLocaleString('pt-BR')}
                  </p>
                  <p className="mt-1.5 text-xs text-secondary">
                    {data.nextSession.canEnterLive
                      ? 'Participação confirmada · Mesa aberta ao vivo'
                      : data.nextSession.hasConfirmedPresence
                        ? data.nextSession.scheduledTimeReached
                          ? 'Participação confirmada · Aguardando o mestre abrir'
                          : 'Participação confirmada · Abre ao vivo no horário marcado'
                        : 'Confirme sua participação em Sessões para liberar ao vivo'}
                  </p>
                </>
              ) : (
                <p className="mt-2 text-sm text-on-surface-variant">Aguardando agenda do narrador.</p>
              )}
            </div>
            <div className="mt-3">
              <Link to="/user/sessions" className="btn-secondary w-full text-center text-xs">
                Central de sessões
              </Link>
            </div>
          </div>
        </aside>
      </div>

      <AchievementMural />

      <section>
        <h2 className="mb-3 font-headline-sm text-lg">Meus personagens</h2>
        <div className="grid auto-rows-fr gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {data.characters.map((ch) => {
            const full = profile?.characters.find((p) => p.id === ch.id)
            return (
              <Link
                key={ch.id}
                to={`/user/characters/${ch.id}?view=inventario`}
                className={`mesa-panel flex h-full min-h-[7.5rem] items-center p-4 transition hover:border-secondary/40 ${
                  ch.selected ? 'border-secondary/50' : ''
                }`}
              >
                <div className="flex w-full gap-3">
                  <div className="flex h-16 w-12 shrink-0 items-center justify-center overflow-hidden rounded border border-outline-variant/50 bg-surface-container-high">
                    {full?.portraitUrl ? (
                      <img src={full.portraitUrl} alt="" className="h-full w-full object-cover" />
                    ) : (
                      <span className="material-symbols-outlined text-2xl text-outline">
                        face
                      </span>
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-serif text-on-surface">{ch.name}</p>
                    <p className="text-xs text-primary">
                      {ch.species}
                      {ch.clan ? ` / ${ch.clan}` : ''}
                    </p>
                    <p className="mt-1 line-clamp-2 text-[11px] text-on-surface-variant">
                      {characterBlurb(ch.id) || 'Sem notas de natureza ou comportamento.'}
                    </p>
                  </div>
                </div>
              </Link>
            )
          })}
          <button
            type="button"
            onClick={() => navigate('/user/characters/new/lineage')}
            className="mesa-panel flex h-full min-h-[7.5rem] flex-col items-center justify-center border-dashed p-4 text-on-surface-variant hover:border-secondary/50"
          >
            <span className="material-symbols-outlined text-3xl">add</span>
            <span className="mt-1.5 text-center text-xs">Criar novo personagem</span>
          </button>
        </div>
      </section>
    </div>
  )
}
