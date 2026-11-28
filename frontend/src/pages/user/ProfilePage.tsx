import { Link, useParams } from 'react-router-dom'
import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { RadarChart } from '../../components/profile/RadarChart'
import { EmptyBlock, MetricValue } from '../../components/profile/MetricValue'
import { StatBar } from '../../components/domain/StatBar'
import { useToast } from '../../components/ui/useToast'
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
  const { push } = useToast()
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
    <div className="space-y-4 pb-4">
      <section className="overflow-hidden rounded-lg border border-outline-variant/50 bg-surface-container shadow-lg">
        <div className="relative h-28 sm:h-32">
          {profile.bannerUrl ? (
            <img src={profile.bannerUrl} alt="" className="h-full w-full object-cover" />
          ) : (
            <div className="h-full bg-gradient-to-br from-[#1a0f14] via-surface-container-high to-[#0f1218]" />
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-background/80 via-background/15 to-transparent" />
        </div>

        <div className="flex flex-col gap-4 px-4 pb-4 sm:flex-row sm:items-start sm:px-5">
          <div className="-mt-12 relative flex h-24 w-24 shrink-0 items-center justify-center overflow-hidden rounded-lg border-4 border-primary/80 bg-surface-container-high shadow-xl sm:-mt-14 sm:h-28 sm:w-28">
            {profile.avatarUrl ? (
              <img src={profile.avatarUrl} alt="" className="h-full w-full object-cover" />
            ) : (
              <span className="material-symbols-outlined text-4xl text-outline">person</span>
            )}
            <span className="absolute right-1 bottom-1 h-3 w-3 rounded-full border-2 border-surface bg-success" title="Online" />
          </div>

          <div className="min-w-0 flex-1 pt-1 sm:pt-2.5">
            <p className="font-label-sm text-[0.65rem] tracking-[0.22em] text-secondary uppercase">Jogador da Corte</p>
            <h1 className="font-headline-lg mt-0.5 break-words text-xl text-on-surface sm:text-2xl">{profile.displayName}</h1>
            <p className="mt-1 text-sm text-secondary">{profile.handle}</p>
            <p className="break-all text-xs text-on-surface-variant">
              {profile.email} · Membro desde {formatMemberSince(profile.memberSince)}
            </p>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <span className="rounded-full border border-secondary/40 bg-secondary/10 px-2 py-0.5 text-[10px] tracking-wide text-secondary uppercase">
                {profile.role === 'narrator' || profile.role === 'admin' ? 'Jogador · Mestre' : 'Jogador'}
              </span>
              {profile.badges.map((b) => (
                <span
                  key={b}
                  className="rounded-full border border-outline-variant/60 bg-surface-container-high px-2 py-0.5 text-[10px] tracking-wide text-on-surface-variant uppercase"
                >
                  {b}
                </span>
              ))}
              {profile.publicId ? (
                <button
                  type="button"
                  className="inline-flex items-center gap-1.5 rounded-full border border-outline-variant/60 bg-surface-container-lowest/70 px-2.5 py-0.5 font-mono text-[11px] text-on-surface transition hover:border-secondary/60"
                  title="Clique para copiar seu identificador de aliado"
                  onClick={() => {
                    const code = profile.publicId!
                    void navigator.clipboard?.writeText(code).then(
                      () => push('Identificador copiado para a área de transferência.', 'success'),
                      () => push(`Seu identificador: ${code}`, 'info'),
                    )
                  }}
                >
                  <span className="font-sans text-[10px] text-secondary uppercase">Aliado:</span>
                  <span>{profile.publicId}</span>
                </button>
              ) : null}
            </div>
          </div>
        </div>
      </section>

      <div className="grid auto-rows-fr grid-cols-2 gap-3 lg:grid-cols-4">
        {[
          { label: 'Personagens', value: profile.accountMetrics.characters },
          { label: 'Sessões', value: profile.accountMetrics.sessions },
          { label: 'Crônicas', value: profile.accountMetrics.chronicles },
          { label: 'XP total', value: profile.accountMetrics.totalXp },
        ].map((m) => (
          <div key={m.label} className="card-surface flex h-full flex-col justify-center p-3.5 text-center">
            <p className="text-[0.65rem] text-on-surface-variant uppercase">{m.label}</p>
            <div className="mt-1">
              <MetricValue value={m.value} />
            </div>
          </div>
        ))}
      </div>

      <div className="grid gap-3.5 lg:grid-cols-2 lg:items-stretch">
        <section className="card-surface flex h-full flex-col p-4">
          <h2 className="font-label-sm text-xs text-secondary uppercase">Dados pessoais e feudais</h2>
          <dl className="mt-3 grid gap-2.5 text-sm sm:grid-cols-2">
            <div>
              <dt className="text-[0.65rem] text-on-surface-variant uppercase">Feudo de origem</dt>
              <dd className="text-on-surface">{profile.preferences.fiefOrigin ?? '—'}</dd>
            </div>
            <div>
              <dt className="text-[0.65rem] text-on-surface-variant uppercase">Preferência narrativa</dt>
              <dd className="text-on-surface">{profile.preferences.narrativePreference ?? '—'}</dd>
            </div>
            <div>
              <dt className="text-[0.65rem] text-on-surface-variant uppercase">Endereço canônico</dt>
              <dd className="break-all text-xs text-on-surface">{profile.email}</dd>
            </div>
            <div>
              <dt className="text-[0.65rem] text-on-surface-variant uppercase">Identificador de aliado</dt>
              <dd className="font-mono text-xs text-secondary">{profile.publicId || '—'}</dd>
            </div>
          </dl>
        </section>

        <section className="card-surface flex h-full flex-col p-4">
          <h2 className="font-label-sm text-xs text-secondary uppercase">Juramento &amp; biografia</h2>
          {profile.preferences.bio?.trim() ? (
            <p className="mt-2.5 whitespace-pre-wrap font-serif text-sm leading-relaxed text-on-surface-variant">
              {profile.preferences.bio}
            </p>
          ) : (
            <p className="mt-2.5 text-sm text-on-surface-variant">
              Banner, retrato, feudo e biografia podem ser definidos em Configurações no menu lateral.
            </p>
          )}
        </section>
      </div>

      <div className="grid gap-3.5 lg:grid-cols-2 lg:items-stretch">
        <section className="card-surface flex h-full flex-col p-4">
          <h2 className="font-label-sm text-xs text-secondary uppercase">Estatísticas da linhagem</h2>
          <ul className="mt-3 space-y-2 text-sm">
            {[
              { label: 'Personagens criados', value: profile.lineageStats.charactersCreated },
              { label: 'Sessões participadas', value: profile.lineageStats.sessionsParticipated },
              { label: 'Horas em mesa', value: profile.lineageStats.hoursPlayed },
              { label: 'Vitórias em crônicas', value: profile.lineageStats.chronicleWins },
              { label: 'XP acumulado', value: profile.lineageStats.xpAccumulated },
              { label: 'Classe favorita', text: profile.lineageStats.favoriteClass },
            ].map((row) => (
              <li key={row.label} className="flex items-center justify-between border-b border-outline-variant/30 pb-1.5">
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

        <section className="card-surface flex h-full flex-col p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="font-label-sm text-xs text-secondary uppercase">Perfil de jogo</h2>
            {profile.characters.length > 0 ? (
              <label className="flex items-center gap-2 text-xs text-on-surface-variant">
                Personagem
                <select
                  className="rounded border border-outline-variant bg-surface-container-high px-2 py-1 text-xs text-on-surface"
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
            <div className="mt-3">
              <EmptyBlock>Crie ou vincule um personagem para ver o radar de equilíbrio aqui.</EmptyBlock>
            </div>
          ) : (
            <div className="mt-3">
              <RadarChart
                axes={
                  hasBalanceData && balanceProfile
                    ? balanceProfile.axes.map((a) => ({ label: a.label, value: a.value }))
                    : []
                }
                empty={!hasBalanceData}
              />
              {hasBalanceData && balanceProfile ? (
                <p className="mt-2 text-center text-xs text-on-surface-variant">
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

      <section className="card-surface p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="font-label-sm text-xs text-secondary uppercase">Personagens vinculados à linhagem</h2>
          <Link to="/user/characters/new/lineage" className="btn-primary text-xs">
            Criar novo cainita
          </Link>
        </div>
        {profile.characters.length === 0 ? (
          <div className="mt-3">
            <EmptyBlock>Nenhum personagem vinculado à sua conta. Forje sua linhagem para vê-los aqui.</EmptyBlock>
          </div>
        ) : (
          <ul className="mt-3 grid auto-rows-fr gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {profile.characters.map((ch) => (
              <li
                key={ch.id}
                className="flex h-full flex-col justify-between rounded border border-outline-variant/50 bg-surface-container-lowest/30 p-3.5"
              >
                <div className="flex items-start gap-3">
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded border border-outline-variant bg-surface-container-high">
                    {ch.portraitUrl ? (
                      <img src={ch.portraitUrl} alt="" className="h-full w-full object-cover" />
                    ) : (
                      <span className="material-symbols-outlined text-2xl text-outline">face</span>
                    )}
                  </div>
                  <div className="min-w-0">
                    <p className="truncate font-serif text-base text-on-surface">{ch.name}</p>
                    <p className="text-xs text-on-surface-variant">
                      {ch.species}
                      {ch.clan ? ` · ${ch.clan}` : ''} · Nv. {ch.level}
                    </p>
                    {ch.isPrimary ? (
                      <span className="mt-0.5 inline-block text-[10px] tracking-wide text-secondary uppercase">
                        Principal
                      </span>
                    ) : null}
                  </div>
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
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
