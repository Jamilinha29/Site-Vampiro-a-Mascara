import { useEffect, useState, type ReactNode } from 'react'
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { BrandLogo } from '../brand/BrandLogo'
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
  const settingsPath = context === 'admin' ? '/admin/settings' : '/user/settings'
  const displayName = profile?.displayName ?? session?.displayName ?? 'Conta'
  const roleLabel = context === 'admin' ? 'Mestre de Mesa' : 'Jogador da Corte'

  const sidebarContent = (
    <div className="flex h-full min-h-0 flex-col bg-surface-container-lowest">
      <div className="flex h-12 shrink-0 items-center border-b border-outline-variant/30 px-3">
        <Link to={homePath} className="flex min-w-0 items-center gap-2 transition hover:opacity-90">
          <BrandLogo size="xs" withGlow className="h-7 w-7 shrink-0" />
          <div className="min-w-0 leading-tight">
            <p className="truncate font-label-sm text-[9px] font-semibold tracking-[0.16em] text-secondary uppercase">
              As Crônicas de
            </p>
            <p className="truncate font-serif text-sm font-semibold text-on-surface">Beladona</p>
          </div>
        </Link>
      </div>

      {/* Cartão compacto de perfil (banner de fundo, foto e nome) alinhado com a navegação */}
      <div className="border-b border-outline-variant/25 px-2 py-1.5">
        <Link
          to={profilePath}
          className="group relative flex min-h-[3.1rem] items-center gap-2.5 overflow-hidden rounded-md border border-outline-variant/35 bg-surface-container-low/85 px-2.5 py-1.5 transition hover:border-secondary/50"
        >
          {profile?.bannerUrl ? (
            <img
              src={profile.bannerUrl}
              alt=""
              className="pointer-events-none absolute inset-0 h-full w-full object-cover opacity-45 transition duration-300 group-hover:scale-105"
            />
          ) : (
            <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-primary-container/35 via-[#1f1318] to-surface-container-lowest" />
          )}
          <div className="pointer-events-none absolute inset-0 bg-gradient-to-r from-surface-container-lowest/90 via-surface-container-lowest/70 to-surface-container-lowest/45" />

          <div className="relative z-10 h-8 w-8 shrink-0">
            <div className="flex h-full w-full items-center justify-center overflow-hidden rounded-full border border-secondary/75 bg-surface-container-high shadow-sm">
              {profile?.avatarUrl ? (
                <img src={profile.avatarUrl} alt={displayName} className="h-full w-full object-cover" />
              ) : (
                <span className="material-symbols-outlined text-base text-secondary">person</span>
              )}
            </div>
            <span
              className="absolute right-0 bottom-0 h-2 w-2 rounded-full bg-emerald-500 ring-2 ring-surface-container-low"
              title="Online"
            />
          </div>

          <div className="relative z-10 min-w-0 flex-1 text-left">
            <p className="truncate text-xs font-semibold leading-tight text-on-surface">{displayName}</p>
            <p className="mt-0.5 truncate font-label-sm text-[8.5px] leading-tight tracking-[0.12em] text-secondary uppercase">
              {roleLabel}
            </p>
          </div>
        </Link>
      </div>

      {/* Navegação organizada por seções nas cores originais */}
      <nav className="min-h-0 flex-1 overflow-y-auto px-2 py-1.5" aria-label={`Navegação ${breadcrumbRoot}`}>
        {resolvedGroups.map((group, groupIndex) => (
          <div
            key={group.label}
            className={groupIndex > 0 ? 'mt-1.5 border-t border-outline-variant/25 pt-1.5' : ''}
          >
            <p className="mb-0.5 px-2 font-label-sm text-[8.5px] font-semibold tracking-[0.14em] text-outline uppercase">
              {group.label}
            </p>
            <ul className="space-y-0.5">
              {group.items.map((item) => (
                <li key={item.to}>
                  <NavLink
                    to={item.to}
                    end={item.end}
                    className={({ isActive }) =>
                      [
                        'flex items-center gap-2 rounded-md border px-2 py-1 text-[11.5px] leading-tight transition',
                        isActive
                          ? 'border-primary-container/50 bg-primary-container/20 font-medium text-on-surface shadow-[inset_0_0_0_1px_rgba(255,179,179,0.08)]'
                          : 'border-transparent text-on-surface-variant hover:bg-surface-container-low/80 hover:text-on-surface',
                      ].join(' ')
                    }
                  >
                    {({ isActive }) => (
                      <>
                        <span
                          className={`material-symbols-outlined text-[16px] ${isActive ? 'text-primary' : 'text-outline'}`}
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

      <div className="space-y-0.5 border-t border-outline-variant/25 px-2 py-1.5 text-[11.5px]">
        {context === 'player' && canSwitchToAdmin ? (
          <Link
            to="/admin"
            className="flex items-center gap-2 rounded-md px-2 py-1 text-secondary transition hover:bg-surface-container-low"
          >
            <span className="material-symbols-outlined text-[16px]">shield_person</span>
            <span className="truncate">Painel do narrador</span>
          </Link>
        ) : null}
        <Link
          to="/ajuda/codice"
          className="flex items-center gap-2 rounded-md px-2 py-1 text-on-surface-variant transition hover:bg-surface-container-low hover:text-on-surface"
        >
          <span className="material-symbols-outlined text-[16px] text-outline">help</span>
          <span>Ajuda &amp; Suporte</span>
        </Link>
        <NavLink
          to={settingsPath}
          className={({ isActive }) =>
            [
              'flex items-center gap-2 rounded-md border px-2 py-1 transition',
              isActive
                ? 'border-primary-container/50 bg-primary-container/20 font-medium text-on-surface shadow-[inset_0_0_0_1px_rgba(255,179,179,0.08)]'
                : 'border-transparent text-on-surface-variant hover:bg-surface-container-low/80 hover:text-on-surface',
            ].join(' ')
          }
        >
          {({ isActive }) => (
            <>
              <span
                className={`material-symbols-outlined text-[16px] ${isActive ? 'text-primary' : 'text-outline'}`}
                aria-hidden
              >
                tune
              </span>
              <span className="truncate">Configurações</span>
            </>
          )}
        </NavLink>
        <button
          type="button"
          onClick={() => {
            logout()
            navigate('/auth/login')
          }}
          className="flex w-full items-center gap-2 rounded-md px-2 py-1 text-left text-on-surface-variant transition hover:bg-surface-container-low hover:text-primary"
        >
          <span className="material-symbols-outlined text-[16px] text-outline">logout</span>
          <span>Sair</span>
        </button>
      </div>
    </div>
  )

  return (
    <div className="flex min-h-svh min-h-dvh w-full min-w-0 bg-surface-container-lowest text-on-surface">
      <aside className="sticky top-0 hidden h-dvh w-56 shrink-0 border-r border-outline-variant/30 lg:block xl:w-60">
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
          <aside className="relative z-10 h-full w-64 max-w-[82vw] border-r border-outline-variant/40 bg-surface-container-lowest shadow-2xl">
            {sidebarContent}
          </aside>
        </div>
      ) : null}

      <div className="flex min-h-0 min-w-0 flex-1 flex-col bg-background">
        {offline ? (
          <p role="status" className="bg-primary px-4 py-2 text-center text-sm text-on-primary">
            Sem conexão. Uma ação só vale depois que o servidor confirmar.
          </p>
        ) : null}

        <header className="sticky top-0 z-30 border-b border-outline-variant/30 bg-surface-container-lowest/90 backdrop-blur-md">
          <div className="flex h-12 w-full items-center justify-between gap-3 px-[clamp(1rem,2.5vw,2.5rem)]">
            <div className="flex min-w-0 items-center gap-3">
              <button
                type="button"
                className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-outline-variant/40 text-on-surface-variant hover:border-secondary/50 hover:text-on-surface lg:hidden"
                onClick={() => setDrawerOpen(true)}
                aria-label="Abrir navegação"
              >
                <span className="material-symbols-outlined text-xl">menu</span>
              </button>
              <nav aria-label="Localização atual" className="flex min-w-0 items-center gap-2 text-xs text-on-surface-variant sm:text-sm">
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

        <main className="w-full min-h-0 min-w-0 flex-1 px-[clamp(1rem,2.5vw,2.5rem)] py-5 sm:py-6">
          <Outlet />
        </main>

        <footer className="safe-pb mt-auto border-t border-outline-variant/25 px-[clamp(1rem,2.5vw,2.5rem)] py-3 text-xs text-outline">
          <div className="flex w-full flex-wrap items-center justify-between gap-2">
            <span>As Crônicas de Beladona</span>
            <span className="italic">Uma história que continua.</span>
          </div>
        </footer>
      </div>
    </div>
  )
}
