import { useEffect, useState, type ReactNode } from 'react'
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { api } from '../../services/api'
import { useAuthStore } from '../../stores/authStore'

export type SidebarNavItem = {
  to: string
  label: string
  icon: string
  end?: boolean
}

export type SidebarNavGroup = {
  label: string
  items: readonly SidebarNavItem[]
}

type Props = {
  context: 'player' | 'admin'
  sectionLabel?: string
  navItems?: readonly SidebarNavItem[]
  navGroups?: readonly SidebarNavGroup[]
  breadcrumbRoot: string
  routeLabels: Record<string, string>
  headerRight?: ReactNode
}

function resolveBreadcrumb(pathname: string, items: readonly SidebarNavItem[], routeLabels: Record<string, string>) {
  const direct = items.find((i) => (i.end ? pathname === i.to : pathname === i.to || pathname.startsWith(`${i.to}/`)))
  if (direct) return direct.label
  for (const [prefix, label] of Object.entries(routeLabels)) {
    if (pathname === prefix || pathname.startsWith(`${prefix}/`)) return label
  }
  return 'Painel'
}

function FourPointStar({ className = 'h-3 w-3' }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" className={className}>
      <path d="M12 1.2C12.7 8.1 15.9 11.3 22.8 12C15.9 12.7 12.7 15.9 12 22.8C11.3 15.9 8.1 12.7 1.2 12C8.1 11.3 11.3 8.1 12 1.2Z" />
    </svg>
  )
}

function SectionNotchLine() {
  return (
    <svg
      viewBox="0 0 120 12"
      preserveAspectRatio="none"
      aria-hidden="true"
      className="h-3 min-w-4 flex-1 text-primary-container/75"
    >
      <path
        d="M 0 1.5 L 7 8.5 L 120 8.5"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.15"
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  )
}

function TopCornerFiligree({ flip = false }: { flip?: boolean }) {
  return (
    <svg
      viewBox="0 0 64 96"
      fill="none"
      aria-hidden="true"
      className={`pointer-events-none absolute top-0 h-full w-14 text-primary-container/85 ${
        flip ? 'right-0 -scale-x-100' : 'left-0'
      }`}
    >
      <path
        d="M 8 2 C 4 8, 4 16, 4 24 L 4 72 C 4 82, 8 88, 16 92"
        stroke="currentColor"
        strokeWidth="1.2"
        opacity="0.7"
      />
      <path
        d="M 10 6 C 18 6, 22 14, 16 24 C 12 31, 14 42, 22 46 C 14 50, 11 62, 16 74 C 19 81, 28 84, 40 84"
        stroke="currentColor"
        strokeWidth="1.15"
        opacity="0.8"
      />
      <path
        d="M 16 14 C 24 12, 30 18, 26 28 C 22 36, 26 42, 34 45"
        stroke="currentColor"
        strokeWidth="0.95"
        opacity="0.5"
      />
      <path
        d="M 10 46 L 44 46"
        stroke="currentColor"
        strokeWidth="1"
        opacity="0.65"
      />
      <path
        d="M 12 20 L 13.4 24.4 L 17.8 25.8 L 13.4 27.2 L 12 31.6 L 10.6 27.2 L 6.2 25.8 L 10.6 24.4 Z"
        fill="currentColor"
      />
      <path
        d="M 12 67 L 13.4 71.4 L 17.8 72.8 L 13.4 74.2 L 12 78.6 L 10.6 74.2 L 6.2 72.8 L 10.6 71.4 Z"
        fill="currentColor"
      />
    </svg>
  )
}

function BottomGothicOrnament() {
  return (
    <div className="pointer-events-none relative px-2 pt-1 pb-2" aria-hidden="true">
      <svg viewBox="0 0 260 36" fill="none" className="h-7 w-full text-primary-container/90">
        <path
          d="M 6 6 C 10 20, 22 28, 42 29 C 62 30, 88 26, 114 26 L 122 26"
          stroke="currentColor"
          strokeWidth="1.25"
          opacity="0.85"
        />
        <path
          d="M 14 28 C 20 20, 30 17, 42 21 C 32 23, 24 27, 18 32"
          stroke="currentColor"
          strokeWidth="1"
          opacity="0.6"
        />
        <path
          d="M 254 6 C 250 20, 238 28, 218 29 C 198 30, 172 26, 146 26 L 138 26"
          stroke="currentColor"
          strokeWidth="1.25"
          opacity="0.85"
        />
        <path
          d="M 246 28 C 240 20, 230 17, 218 21 C 228 23, 236 27, 242 32"
          stroke="currentColor"
          strokeWidth="1"
          opacity="0.6"
        />
        <path
          d="M 130 7 C 131.1 17.4, 134.8 21.1, 145 22.2 C 134.8 23.3, 131.1 27, 130 35 C 128.9 27, 125.2 23.3, 115 22.2 C 125.2 21.1, 128.9 17.4, 130 7 Z"
          fill="var(--color-inverse-primary)"
        />
      </svg>
    </div>
  )
}

export function AppSidebarShell({
  context,
  sectionLabel = 'Navegação',
  navItems = [],
  navGroups,
  breadcrumbRoot,
  routeLabels,
  headerRight,
}: Props) {
  const [drawerOpenPath, setDrawerOpenPath] = useState<string | null>(null)
  const [offline, setOffline] = useState(!navigator.onLine)
  const location = useLocation()
  const drawerOpen = drawerOpenPath === location.pathname
  const setDrawerOpen = (open: boolean) => setDrawerOpenPath(open ? location.pathname : null)
  const navigate = useNavigate()
  const session = useAuthStore((s) => s.session)
  const logout = useAuthStore((s) => s.logout)
  const { data: profile } = useQuery({
    queryKey: ['me-profile'],
    queryFn: () => api.getMeProfile(),
    enabled: !!session,
  })

  useEffect(() => {
    const markOffline = () => setOffline(true)
    const markOnline = () => setOffline(false)
    window.addEventListener('offline', markOffline)
    window.addEventListener('online', markOnline)
    return () => {
      window.removeEventListener('offline', markOffline)
      window.removeEventListener('online', markOnline)
    }
  }, [])

  useEffect(() => {
    if (!drawerOpen) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setDrawerOpenPath(null)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [drawerOpen])

  const resolvedGroups: readonly SidebarNavGroup[] =
    navGroups && navGroups.length > 0 ? navGroups : [{ label: sectionLabel, items: navItems }]
  const flatItems = resolvedGroups.flatMap((g) => g.items)
  const currentLabel = resolveBreadcrumb(location.pathname, flatItems, routeLabels)
  const canSwitchToAdmin = session?.role === 'narrator' || session?.role === 'admin'
  const homePath = context === 'admin' ? '/admin' : '/user'
  const profilePath = context === 'admin' ? '/admin/profile' : '/user/profile'
  const displayName = profile?.displayName ?? session?.displayName ?? 'Conta'
  const roleLabel = context === 'admin' ? 'Mestre de Mesa' : 'Jogador da Corte'

  const sidebarContent = (
    <div className="flex h-full min-h-0 flex-col bg-transparent p-2">
      <div className="relative flex h-full min-h-0 flex-col overflow-hidden rounded-2xl border border-primary-container/80 bg-transparent shadow-[inset_0_0_0_1px_rgba(158,27,45,0.22)]">
        {/* Cabeçalho gótico de perfil sem fundo */}
        <div className="relative px-3 pt-3 pb-2.5">
          <Link
            to={profilePath}
            className="group relative block overflow-hidden rounded-xl border border-primary-container/70 bg-transparent px-3 pt-3.5 pb-3 text-center transition hover:border-inverse-primary"
          >
            <TopCornerFiligree />
            <TopCornerFiligree flip />

            <div className="relative z-10 flex items-center justify-center gap-2.5">
              <span className="flex flex-1 items-center justify-end gap-1.5" aria-hidden>
                <span className="h-px flex-1 bg-gradient-to-l from-primary-container/80 to-transparent" />
                <FourPointStar className="h-3 w-3 shrink-0 text-inverse-primary drop-shadow-[0_0_6px_rgba(177,42,57,0.75)]" />
              </span>

              <div className="relative flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-full border-2 border-inverse-primary bg-transparent shadow-[0_0_16px_rgba(177,42,57,0.45)] transition group-hover:shadow-[0_0_20px_rgba(177,42,57,0.7)]">
                {profile?.avatarUrl ? (
                  <img src={profile.avatarUrl} alt={displayName} className="h-full w-full object-cover" />
                ) : (
                  <span className="material-symbols-outlined text-[32px] text-on-surface-variant">person</span>
                )}
              </div>

              <span className="flex flex-1 items-center justify-start gap-1.5" aria-hidden>
                <FourPointStar className="h-3 w-3 shrink-0 text-inverse-primary drop-shadow-[0_0_6px_rgba(177,42,57,0.75)]" />
                <span className="h-px flex-1 bg-gradient-to-r from-primary-container/80 to-transparent" />
              </span>
            </div>

            <p className="relative z-10 mt-2 truncate text-base font-semibold tracking-tight text-on-surface">
              {displayName}
            </p>
            <div className="relative z-10 mt-0.5 flex items-center justify-center gap-2">
              <span className="h-px w-4 bg-primary-container/65" aria-hidden />
              <p className="truncate font-label-sm text-[10px] font-medium tracking-[0.16em] text-outline uppercase">
                {roleLabel}
              </p>
              <span className="h-px w-4 bg-primary-container/65" aria-hidden />
            </div>
          </Link>
        </div>

        {/* Seções de navegação */}
        <nav
          className="min-h-0 flex-1 overflow-y-auto px-3 py-1"
          aria-label={`Navegação ${breadcrumbRoot}`}
        >
          {resolvedGroups.map((group, groupIndex) => (
            <div key={group.label} className={groupIndex > 0 ? 'mt-2.5' : ''}>
              {groupIndex > 0 ? (
                <div
                  className="mb-2.5 h-px w-full bg-gradient-to-r from-primary-container/20 via-primary-container/60 to-primary-container/20"
                  aria-hidden
                />
              ) : null}

              <div className="mb-1.5 flex items-center gap-1.5 px-1">
                <FourPointStar className="h-3 w-3 shrink-0 text-inverse-primary drop-shadow-[0_0_5px_rgba(177,42,57,0.75)]" />
                <p className="shrink-0 font-label-sm text-[10px] font-semibold tracking-[0.16em] text-outline uppercase">
                  {group.label}
                </p>
                <SectionNotchLine />
              </div>

              <ul className="space-y-0.5">
                {group.items.map((item) => (
                  <li key={item.to}>
                    <NavLink
                      to={item.to}
                      end={item.end}
                      className={({ isActive }) =>
                        [
                          'group relative flex items-center gap-3 overflow-hidden rounded-lg border px-3 py-1.5 text-[13px] transition',
                          isActive
                            ? 'border-inverse-primary/85 bg-gradient-to-r from-primary-container/45 via-primary-container/20 to-transparent font-medium text-on-surface shadow-[0_0_14px_-6px_rgba(177,42,57,0.65)]'
                            : 'border-transparent bg-transparent text-on-surface-variant hover:border-primary-container/40 hover:bg-primary-container/10 hover:text-on-surface',
                        ].join(' ')
                      }
                    >
                      {({ isActive }) => (
                        <>
                          {isActive ? (
                            <span
                              aria-hidden
                              className="absolute inset-y-0 left-0 w-1.5 rounded-l-lg bg-inverse-primary shadow-[0_0_10px_rgba(177,42,57,0.9)]"
                            />
                          ) : null}
                          <span
                            className={`material-symbols-outlined text-[19px] transition ${
                              isActive
                                ? 'text-on-surface'
                                : 'text-on-surface-variant/85 group-hover:text-on-surface'
                            }`}
                            aria-hidden
                          >
                            {item.icon}
                          </span>
                          <span className="truncate">{item.label}</span>
                        </>
                      )}
                    </NavLink>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </nav>

        {/* Rodapé de suporte / sair + ornamento inferior */}
        <div className="px-3 pt-2">
          <div
            className="mb-2 h-px w-full bg-gradient-to-r from-primary-container/20 via-primary-container/60 to-primary-container/20"
            aria-hidden
          />
          <div className="space-y-0.5 text-[13px]">
            {context === 'player' && canSwitchToAdmin ? (
              <Link
                to="/admin"
                className="flex items-center gap-3 rounded-lg border border-transparent px-3 py-1.5 text-secondary transition hover:border-secondary/35 hover:bg-secondary/10"
              >
                <span className="material-symbols-outlined text-[19px]">shield_person</span>
                <span className="truncate">Painel do narrador</span>
              </Link>
            ) : null}
            <Link
              to="/ajuda/codice"
              className="flex items-center gap-3 rounded-lg border border-transparent px-3 py-1.5 text-on-surface-variant transition hover:border-primary-container/40 hover:bg-primary-container/10 hover:text-on-surface"
            >
              <span className="material-symbols-outlined text-[19px] text-on-surface-variant/85">help</span>
              <span>Ajuda &amp; Suporte</span>
            </Link>
            <button
              type="button"
              onClick={() => {
                logout()
                navigate('/auth/login')
              }}
              className="flex w-full items-center gap-3 rounded-lg border border-transparent px-3 py-1.5 text-left text-on-surface-variant transition hover:border-primary-container/40 hover:bg-primary-container/10 hover:text-primary"
            >
              <span className="material-symbols-outlined text-[19px] text-on-surface-variant/85">logout</span>
              <span>Sair</span>
            </button>
          </div>
        </div>

        <BottomGothicOrnament />
      </div>
    </div>
  )

  return (
    <div className="flex min-h-svh min-h-dvh w-full min-w-0 bg-background text-on-surface">
      <aside className="sticky top-0 hidden h-dvh w-60 shrink-0 bg-transparent lg:block xl:w-64">
        {sidebarContent}
      </aside>

      {drawerOpen ? (
        <div className="fixed inset-0 z-50 flex lg:hidden" role="dialog" aria-modal="true" aria-label="Menu lateral">
          <button
            type="button"
            aria-label="Fechar menu"
            className="fixed inset-0 bg-black/70 backdrop-blur-xs"
            onClick={() => setDrawerOpen(false)}
          />
          <aside className="relative z-10 h-full w-68 max-w-[85vw] bg-background/95 backdrop-blur-md shadow-2xl">
            {sidebarContent}
          </aside>
        </div>
      ) : null}

      <div className="flex min-h-0 min-w-0 flex-1 flex-col bg-transparent">
        {offline ? (
          <p role="status" className="bg-primary px-4 py-2 text-center text-sm text-on-primary">
            Sem conexão. Uma ação só vale depois que o servidor confirmar.
          </p>
        ) : null}

        <header className="sticky top-0 z-30 border-b border-outline-variant/30 bg-background/85 backdrop-blur-md">
          <div className="safe-px flex h-12 items-center justify-between gap-3">
            <div className="flex min-w-0 items-center gap-2.5">
              <button
                type="button"
                className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-outline-variant/40 text-on-surface-variant hover:border-secondary/50 hover:text-on-surface lg:hidden"
                onClick={() => setDrawerOpen(true)}
                aria-label="Abrir navegação"
              >
                <span className="material-symbols-outlined text-xl">menu</span>
              </button>
              <nav aria-label="Localização atual" className="flex min-w-0 items-center gap-2 text-xs text-on-surface-variant">
                <Link to={homePath} className="hover:text-secondary">
                  {breadcrumbRoot}
                </Link>
                <span aria-hidden className="text-outline">
                  ›
                </span>
                <span className="truncate font-medium text-on-surface">{currentLabel}</span>
              </nav>
            </div>

            {headerRight ? <div className="flex shrink-0 items-center gap-2 sm:gap-3">{headerRight}</div> : null}
          </div>
        </header>

        <main className="safe-px mx-auto w-full min-h-0 min-w-0 max-w-[74rem] flex-1 py-4 sm:py-5">
          <Outlet />
        </main>

        <footer className="safe-px safe-pb mt-auto border-t border-outline-variant/25 py-2 text-[11px] text-outline">
          <div className="mx-auto flex max-w-[74rem] flex-wrap items-center justify-between gap-2">
            <span>As Crônicas de Beladona</span>
            <span className="italic">Uma história que continua.</span>
          </div>
        </footer>
      </div>
    </div>
  )
}
