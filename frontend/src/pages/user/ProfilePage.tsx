import { Link } from 'react-router-dom'
import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useParams } from 'react-router-dom'
import { RadarChart } from '../../components/profile/RadarChart'
import { EmptyBlock, MetricValue } from '../../components/profile/MetricValue'
import { StatBar } from '../../components/domain/StatBar'
import { api } from '../../services/api'
import { useAuthStore } from '../../stores/authStore'
import { computeCharacterBalanceProfile } from '../../lib/characterBalanceProfile'

function formatMemberSince(iso: string) {
  try {
    return new Date(iso).toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })
  } catch {
    return '—'
  }
}

export default function ProfilePage() {
  const { userId: routeUserId } = useParams()
  const session = useAuthStore((s) => s.session)
  const isOwnProfile = !routeUserId || routeUserId === session?.userId || routeUserId === session?.email
  const { data: profile, isLoading, isError } = useQuery({
    queryKey: ['me-profile'],
    queryFn: () => api.getMeProfile(),
    enabled: isOwnProfile && !!session,
  })

  const [selectedCharacterId, setSelectedCharacterId] = useState<string>('')

  const effectiveCharacterId = useMemo(() => {
    if (selectedCharacterId) return selectedCharacterId
    const primary = profile?.characters.find((c) => c.isPrimary)
    return primary?.id ?? profile?.characters[0]?.id ?? ''
  }, [profile, selectedCharacterId])

  const selectedCharacter = useMemo(
    () => profile?.characters.find((c) => c.id === effectiveCharacterId),
    [profile, effectiveCharacterId],
  )

  const balanceProfile = useMemo(
    () => (selectedCharacter ? computeCharacterBalanceProfile(selectedCharacter) : null),
    [selectedCharacter],
  )

  if (!isOwnProfile) {
    return (
      <div className="card-surface p-8 text-center">
        <p className="text-on-surface-variant">Perfis públicos de outros jogadores ainda não estão disponíveis.</p>
        <Link to="/user/profile" className="btn-secondary mt-4 inline-flex">
          Voltar ao meu perfil
        </Link>
      </div>
    )
  }

  if (isLoading) {
    return <p className="text-on-surface-variant">Abrindo o registro da linhagem…</p>
  }

  if (isError || !profile) {
    return (
      <div className="card-surface p-8 text-center">
        <p className="text-on-surface-variant">Não foi possível carregar seu perfil. Tente entrar novamente.</p>
        <Link to="/auth/login" className="btn-primary mt-4 inline-flex">
          Entrar
        </Link>
      </div>
    )
  }

  const hasBalanceData = balanceProfile?.hasData === true

  return (
    <div className="space-y-8 pb-10">
      <section className="relative">
        <div className="relative h-40 overflow-hidden rounded-lg border border-outline-variant sm:h-48 md:h-56">
          {profile.bannerUrl ? (
            <img src={profile.bannerUrl} alt="" className="h-full w-full object-cover" />
          ) : (
            <div className="flex h-full flex-col items-center justify-center gap-2 bg-gradient-to-br from-surface-container-high via-[#1a1218] to-surface-container-lowest px-4 text-center">
              <span className="material-symbols-outlined text-3xl text-outline-variant">panorama</span>
              <p className="text-sm text-on-surface-variant">Banner da conta — edite em Configurações</p>
            </div>
          )}
        </div>

        <div className="-mt-14 flex flex-col items-center px-4 sm:-mt-16">
          <div className="relative">
            <div className="flex h-28 w-28 items-center justify-center overflow-hidden rounded-lg border-4 border-primary/70 bg-surface-container-high shadow-lg sm:h-32 sm:w-32">
              {profile.avatarUrl ? (
                <img src={profile.avatarUrl} alt="" className="h-full w-full object-cover" />
              ) : (
                <span className="material-symbols-outlined text-5xl text-outline-variant">person</span>
              )}
            </div>
            <span className="absolute right-1 bottom-1 h-3 w-3 rounded-full border-2 border-surface bg-success" title="Online" />
          </div>
          <h1 className="font-headline-lg mt-4 text-center text-2xl text-on-surface">{profile.displayName}</h1>
          <p className="text-sm text-secondary">{profile.handle}</p>
          {profile.badges.length > 0 ? (
            <div className="mt-2 flex flex-wrap justify-center gap-2">
              {profile.badges.map((b) => (
                <span
                  key={b}
                  className="rounded-full border border-secondary/40 bg-secondary/10 px-2 py-0.5 text-[11px] tracking-wide text-secondary uppercase"
                >
                  {b}
                </span>
              ))}
            </div>
          ) : null}
          <p className="mt-2 text-xs text-on-surface-variant">
            Membro desde {formatMemberSince(profile.memberSince)}
            {profile.accountMetrics.sessions != null ? ` · ${profile.accountMetrics.sessions} sessões` : ''}
            {profile.accountMetrics.characters != null ? ` · ${profile.accountMetrics.characters} personagens` : ''}
          </p>
          {profile.preferences.bio?.trim() ? (
            <p className="mt-3 max-w-xl text-center text-sm text-on-surface-variant">{profile.preferences.bio}</p>
          ) : null}
        </div>
      </section>

      <section className="card-surface p-6">
        <h2 className="font-label-sm text-xs text-secondary uppercase">Dados pessoais e feudais</h2>
        <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded border border-outline-variant/40 p-3 text-sm">
            <p className="text-[10px] uppercase text-on-surface-variant">Endereço canônico</p>
            <p className="mt-1 text-on-surface">{profile.email}</p>
            <p className="text-xs text-on-surface-variant">Criptografado por direito de sangue</p>
          </div>
          <div className="rounded border border-outline-variant/40 p-3 text-sm">
            <p className="text-[10px] uppercase text-on-surface-variant">Feudo de origem</p>
            <p className="mt-1 text-on-surface">{profile.preferences.fiefOrigin ?? '—'}</p>
          </div>
          <div className="rounded border border-outline-variant/40 p-3 text-sm">
            <p className="text-[10px] uppercase text-on-surface-variant">Preferência narrativa</p>
            <p className="mt-1 text-on-surface">{profile.preferences.narrativePreference ?? '—'}</p>
          </div>
          <div className="rounded border border-outline-variant/40 p-3 text-sm">
            <p className="text-[10px] uppercase text-on-surface-variant">Papel na mesa</p>
            <p className="mt-1 text-on-surface">
              {profile.role === 'narrator' || profile.role === 'admin' ? 'Jogador · também Mestre' : 'Jogador'}
            </p>
          </div>
        </div>
      </section>

      <section className="card-surface p-6">
        <h2 className="font-label-sm text-xs text-secondary uppercase">Resumo da conta</h2>
        <div className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-4">
          {[
            { label: 'Personagens', value: profile.accountMetrics.characters },
            { label: 'Sessões', value: profile.accountMetrics.sessions },
            { label: 'Crônicas', value: profile.accountMetrics.chronicles },
            { label: 'XP total', value: profile.accountMetrics.totalXp },
          ].map((m) => (
            <div key={m.label} className="rounded border border-outline-variant/40 bg-surface-container-lowest/40 p-4 text-center">
              <p className="text-xs text-on-surface-variant">{m.label}</p>
              <div className="mt-1">
                <MetricValue value={m.value} />
              </div>
            </div>
          ))}
        </div>
        <p className="mt-3 text-xs text-on-surface-variant">
          Os números aparecem conforme sua atividade real na plataforma — sem valores fictícios.
        </p>
      </section>

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="card-surface p-6">
          <h2 className="font-label-sm text-xs text-secondary uppercase">Estatísticas da linhagem</h2>
          <ul className="mt-4 space-y-3 text-sm">
            {[
              { label: 'Personagens criados', value: profile.lineageStats.charactersCreated },
              { label: 'Sessões participadas', value: profile.lineageStats.sessionsParticipated },
              { label: 'Horas em mesa', value: profile.lineageStats.hoursPlayed },
              { label: 'Vitórias em crônicas', value: profile.lineageStats.chronicleWins },
              { label: 'XP acumulado', value: profile.lineageStats.xpAccumulated },
              { label: 'Classe favorita', text: profile.lineageStats.favoriteClass },
            ].map((row) => (
              <li key={row.label} className="flex items-center justify-between border-b border-outline-variant/30 pb-2">
                <span className="text-on-surface-variant">{row.label}</span>
                {'text' in row ? (
                  <span className="text-on-surface">{row.text ?? '—'}</span>
                ) : (
                  <MetricValue value={row.value} />
                )}
              </li>
            ))}
          </ul>
        </section>

        <section className="card-surface p-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="font-label-sm text-xs text-secondary uppercase">Perfil de jogo</h2>
            {profile.characters.length > 0 ? (
              <label className="flex items-center gap-2 text-xs text-on-surface-variant">
                Personagem
                <select
                  className="rounded border border-outline-variant bg-surface-container-high px-2 py-1 text-sm text-on-surface"
                  value={effectiveCharacterId}
                  onChange={(e) => setSelectedCharacterId(e.target.value)}
                >
                  {profile.characters.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </label>
            ) : null}
          </div>
          {profile.characters.length === 0 ? (
            <div className="mt-4">
              <EmptyBlock>Crie ou vincule um personagem para ver o radar de equilíbrio aqui.</EmptyBlock>
            </div>
          ) : (
            <div className="mt-4">
              <RadarChart
                axes={
                  hasBalanceData && balanceProfile
                    ? balanceProfile.axes.map((a) => ({ label: a.label, value: a.value }))
                    : []
                }
                empty={!hasBalanceData}
              />
              {hasBalanceData && balanceProfile ? (
                <p className="mt-2 text-center text-sm text-on-surface-variant">
                  Índice de equilíbrio: <strong className="text-secondary">{balanceProfile.balancePercent}%</strong> —{' '}
                  {balanceProfile.characterName}
                </p>
              ) : (
                <p className="mt-2 text-center text-xs text-on-surface-variant">
                  Preencha atributos e perícias na ficha do personagem para gerar o perfil.
                </p>
              )}
            </div>
          )}
        </section>
      </div>

      <section className="card-surface p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="font-label-sm text-xs text-secondary uppercase">Personagens vinculados à linhagem</h2>
          <Link to="/user/characters/new/lineage" className="btn-primary text-xs">
            Criar novo cainita
          </Link>
        </div>
        {profile.characters.length === 0 ? (
          <div className="mt-4">
            <EmptyBlock>Nenhum personagem vinculado à sua conta. Forje sua linhagem para vê-los aqui.</EmptyBlock>
          </div>
        ) : (
          <ul className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {profile.characters.map((ch) => (
              <li
                key={ch.id}
                className="flex flex-col rounded border border-outline-variant/50 bg-surface-container-lowest/30 p-4"
              >
                <div className="flex items-start gap-3">
                  <div className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded border border-outline-variant bg-surface-container-high">
                    {ch.portraitUrl ? (
                      <img src={ch.portraitUrl} alt="" className="h-full w-full object-cover" />
                    ) : (
                      <span className="material-symbols-outlined text-2xl text-outline">face</span>
                    )}
                  </div>
                  <div className="min-w-0">
                    <p className="truncate font-serif text-lg text-on-surface">{ch.name}</p>
                    <p className="text-xs text-on-surface-variant">
                      {ch.species}
                      {ch.clan ? ` · ${ch.clan}` : ''} · Nv. {ch.level}
                    </p>
                    {ch.isPrimary ? (
                      <span className="mt-1 inline-block text-[10px] tracking-wide text-secondary uppercase">
                        Principal
                      </span>
                    ) : null}
                  </div>
                </div>
                <div className="mt-4 flex flex-wrap gap-2">
                  <Link to={`/user/characters/${ch.id}?view=ficha`} className="btn-secondary flex-1 text-center text-xs">
                    Ficha completa
                  </Link>
                  <Link to={`/user/characters/${ch.id}?view=inventario`} className="btn-secondary flex-1 text-center text-xs">
                    Inventário
                  </Link>
                </div>
                <div className="mt-2">
                  <StatBar label="Vitalidade" current={ch.hp.current} max={ch.hp.max} />
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}
