import { useQuery } from '@tanstack/react-query'
import { api } from '../../services/api'
import { useAuthStore } from '../../stores/authStore'
import { adminQueryKeys } from '../../lib/queryKeys'

function formatMemberSince(iso: string) {
  try {
    return new Date(iso).toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })
  } catch {
    return '—'
  }
}

export default function AdminProfilePage() {
  const session = useAuthStore((s) => s.session)
  const { data: profile, isLoading } = useQuery({
    queryKey: ['me-profile'],
    queryFn: () => api.getMeProfile(),
    enabled: !!session,
  })
  const { data: activity } = useQuery({
    queryKey: adminQueryKeys.mesaActivity,
    queryFn: () => api.adminMesaActivityStats(),
  })
  const { data: scheduled = [] } = useQuery({
    queryKey: adminQueryKeys.scheduledSessions,
    queryFn: () => api.adminListScheduledSessions(),
  })
  const { data: players = [], isLoading: loadingPlayers } = useQuery({
    queryKey: ['admin-registered-players'],
    queryFn: () => api.adminListRegisteredPlayers(),
  })

  if (isLoading || !profile) {
    return <p className="text-sm text-on-surface-variant">Abrindo registro do mestre…</p>
  }

  const prefs = profile.preferences
  const mesasTotal = scheduled.length
  const mesasOpen = scheduled.filter((s) => s.status === 'open').length

  return (
    <div className="space-y-6 pb-10">
      <section className="overflow-hidden rounded-lg border border-outline-variant/50 bg-surface-container shadow-lg">
        <div className="relative h-40 sm:h-48">
          {profile.bannerUrl ? (
            <img src={profile.bannerUrl} alt="" className="h-full w-full object-cover" />
          ) : (
            <div className="h-full bg-gradient-to-br from-[#1a0f14] via-surface-container-high to-[#0f1218]" />
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-background/90 via-background/20 to-transparent" />
          <div className="absolute bottom-3 left-4 right-4 sm:left-6">
            <p className="font-label-sm text-[0.65rem] tracking-[0.25em] text-secondary uppercase">Mestre da Crônica</p>
            <h1 className="font-headline-lg text-2xl text-on-surface sm:text-3xl">
              {prefs.courtTitle?.trim() || profile.displayName}
            </h1>
            {prefs.chronicleSlogan?.trim() ? (
              <p className="mt-1 max-w-2xl font-serif text-sm text-on-surface-variant">{prefs.chronicleSlogan}</p>
            ) : null}
          </div>
        </div>

        <div className="flex flex-col gap-4 px-4 pb-5 sm:flex-row sm:items-end sm:px-6">
          <div className="-mt-12 relative h-24 w-24 shrink-0 overflow-hidden rounded-lg border-4 border-primary/80 bg-surface-container-high shadow-xl sm:h-28 sm:w-28">
            {profile.avatarUrl ? (
              <img src={profile.avatarUrl} alt="" className="h-full w-full object-cover" />
            ) : (
              <span className="material-symbols-outlined flex h-full w-full items-center justify-center text-4xl text-outline">
                theater_comedy
              </span>
            )}
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm text-secondary">{profile.handle}</p>
            <p className="text-xs text-on-surface-variant">{profile.email}</p>
            <div className="mt-2 flex flex-wrap gap-2">
              {profile.badges.map((b) => (
                <span
                  key={b}
                  className="rounded-full border border-secondary/40 bg-secondary/10 px-2 py-0.5 text-[10px] tracking-wide text-secondary uppercase"
                >
                  {b}
                </span>
              ))}
              <span className="rounded-full border border-primary/40 bg-primary/10 px-2 py-0.5 text-[10px] text-primary uppercase">
                Narrador
              </span>
            </div>
          </div>
        </div>
      </section>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[
          { label: 'Mesas registradas', value: mesasTotal },
          { label: 'Mesas ao vivo', value: mesasOpen },
          { label: 'Horas (mês)', value: activity?.month.hoursActive ?? '—' },
          { label: 'Atos encerrados (mês)', value: activity?.month.actsClosed ?? '—' },
        ].map((m) => (
          <div key={m.label} className="card-surface p-4 text-center">
            <p className="text-[0.65rem] uppercase text-on-surface-variant">{m.label}</p>
            <p className="mt-1 font-serif text-2xl text-secondary">{m.value}</p>
          </div>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <section className="card-surface p-5">
          <h2 className="font-label-sm text-xs text-secondary uppercase">Domínio narrativo</h2>
          <dl className="mt-3 space-y-3 text-sm">
            <div>
              <dt className="text-[0.65rem] uppercase text-on-surface-variant">Foco do acervo</dt>
              <dd className="text-on-surface">{prefs.archiveFocus?.trim() || '—'}</dd>
            </div>
            <div>
              <dt className="text-[0.65rem] uppercase text-on-surface-variant">RPG padrão das mesas</dt>
              <dd className="text-on-surface">{prefs.defaultRpgTitle?.trim() || '—'}</dd>
            </div>
            <div>
              <dt className="text-[0.65rem] uppercase text-on-surface-variant">Membro desde</dt>
              <dd className="text-on-surface">{formatMemberSince(profile.memberSince)}</dd>
            </div>
          </dl>
        </section>

        <section className="card-surface p-5">
          <h2 className="font-label-sm text-xs text-secondary uppercase">Juramento &amp; voz</h2>
          {prefs.bio?.trim() ? (
            <p className="mt-3 whitespace-pre-wrap font-serif text-sm leading-relaxed text-on-surface-variant">{prefs.bio}</p>
          ) : (
            <p className="mt-3 text-sm text-on-surface-variant">
              Título, lema e biografia podem ser definidos em Configurações no menu superior.
            </p>
          )}
        </section>
      </div>

      <section className="card-surface p-5">
        <h2 className="font-label-sm text-xs text-secondary uppercase">Jogadores inscritos</h2>
        <p className="mt-1 text-xs text-on-surface-variant">
          Contas registradas na corte ({players.length}).
        </p>
        {loadingPlayers ? (
          <p className="mt-3 text-sm text-on-surface-variant">Carregando…</p>
        ) : players.length === 0 ? (
          <p className="mt-3 text-sm text-on-surface-variant">Nenhum jogador inscrito ainda.</p>
        ) : (
          <ul className="mt-4 max-h-80 divide-y divide-outline-variant/30 overflow-y-auto">
            {players.map((p) => (
              <li key={p.email} className="flex flex-wrap items-center justify-between gap-2 py-3 text-sm">
                <div>
                  <p className="font-serif text-on-surface">{p.displayName}</p>
                  <p className="text-xs text-on-surface-variant">
                    {p.handle} · {p.email}
                  </p>
                </div>
                <div className="text-right text-xs text-on-surface-variant">
                  <p>{p.characters} personagem(ns)</p>
                  <p>Desde {new Date(p.memberSince).toLocaleDateString('pt-BR')}</p>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}
