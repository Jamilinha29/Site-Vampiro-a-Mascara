import { Link, useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
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
    <div className="space-y-6 pb-8">
      <header className="mesa-panel overflow-hidden">
        <div className="border-b border-outline-variant/30 bg-surface-container-low/60 px-4 py-4 sm:px-6">
          <p className="font-label-sm text-[0.65rem] text-secondary uppercase tracking-[0.2em]">{chronicleTitle}</p>
          <h1 className="font-headline-lg mt-1 text-xl text-on-surface sm:text-2xl">
            {data.activeChronicle?.act ?? 'Início da crônica'}
          </h1>
          <div className="mt-2 flex flex-wrap gap-3 text-xs text-on-surface-variant">
            <span>
              Narrador · <span className="text-on-surface">{session?.displayName ?? '—'}</span>
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
            <p className="mt-2 text-sm text-on-surface-variant">
              Personagem vinculado · <strong className="text-secondary">{active.name}</strong>
            </p>
          ) : null}
        </div>
        <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-2 sm:px-6">
          <p className="text-xs text-secondary">Modo descanso pode restringir combates e feira — conforme mesa ao vivo.</p>
          <Link to="/user/sessions" className="btn-secondary text-xs">
            Ver sessões
          </Link>
        </div>
      </header>

      <div className="grid gap-6 xl:grid-cols-12">
        <section className="mesa-panel p-5 xl:col-span-8">
          {active ? (
            <div className="flex flex-col gap-5 sm:flex-row">
              <div className="mx-auto h-40 w-32 shrink-0 rounded border-2 border-secondary/40 bg-surface-container-high sm:mx-0" />
              <div className="min-w-0 flex-1">
                <p className="text-xs text-secondary uppercase">Nível —</p>
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
            <p className="text-on-surface-variant">Crie um personagem para ver o painel do cainita ativo.</p>
          )}
        </section>

        <aside className="space-y-4 xl:col-span-4">
          <div className="mesa-panel p-5">
            <h3 className="font-label-sm text-xs text-secondary uppercase">Carteira imperial</h3>
            <p className="mt-1 text-[11px] text-on-surface-variant">Recebimentos e gastos recentes</p>
            <div className="mt-3">
              <WalletLedgerPanel />
            </div>
          </div>
          <div className="mesa-panel p-5">
            <h3 className="font-label-sm text-xs text-secondary uppercase">Próxima sessão</h3>
            {data.nextSession ? (
              <>
                <p className="mt-2 font-serif text-lg text-on-surface">{data.nextSession.title}</p>
                <p className="text-sm text-on-surface-variant">
                  {new Date(data.nextSession.scheduledAt).toLocaleString('pt-BR')}
                </p>
                <div className="mt-4 flex flex-col gap-2">
                  <Link to="/user/sessions" className="btn-primary w-full text-center text-xs">
                    Central de sessões
                  </Link>
                </div>
              </>
            ) : (
              <p className="mt-2 text-sm text-on-surface-variant">Aguardando agenda do narrador.</p>
            )}
          </div>
        </aside>
      </div>

      <section>
        <h2 className="mb-3 font-headline-sm text-lg">Meus personagens</h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {data.characters.map((ch) => {
            const full = profile?.characters.find((p) => p.id === ch.id)
            return (
              <Link
                key={ch.id}
                to={`/user/characters/${ch.id}?view=inventario`}
                className={`mesa-panel block p-4 transition hover:border-secondary/40 ${
                  ch.selected ? 'border-secondary/50' : ''
                }`}
              >
                <div className="flex gap-3">
                  <div className="h-16 w-12 shrink-0 overflow-hidden rounded border border-outline-variant/50 bg-surface-container-high">
                    {full?.portraitUrl ? (
                      <img src={full.portraitUrl} alt="" className="h-full w-full object-cover" />
                    ) : (
                      <span className="material-symbols-outlined flex h-full w-full items-center justify-center text-2xl text-outline">
                        face
                      </span>
                    )}
                  </div>
                  <div className="min-w-0">
                    <p className="font-serif text-on-surface">{ch.name}</p>
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
            className="mesa-panel flex min-h-[8rem] flex-col items-center justify-center border-dashed p-4 text-on-surface-variant hover:border-secondary/50"
          >
            <span className="material-symbols-outlined text-3xl">add</span>
            <span className="mt-2 text-center text-xs">+ mostra novos personagem</span>
          </button>
        </div>
      </section>
    </div>
  )
}
