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

type Props = {
  context: 'player' | 'admin'
  sectionLabel: string
  navItems: readonly SidebarNavItem[]
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
  sectionLabel,
  navItems,
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

  const currentLabel = resolveBreadcrumb(location.pathname, navItems, routeLabels)
  const canSwitchToAdmin = session?.role === 'narrator' || session?.role === 'admin'
  const homePath = context === 'admin' ? '/admin' : '/user'
  const profilePath = context === 'admin' ? '/admin/profile' : '/user/profile'

  const sidebarContent = (
    <div className="flex h-full min-h-0 flex-col bg-surface-container-lowest">
      <div className="border-b border-outline-variant/30 px-3.5 py-2.5">
        <Link to={homePath} className="flex items-center gap-2 transition hover:opacity-90">
          <BrandLogo size="xs" withGlow className="h-8 w-8 shrink-0" />
          <div className="min-w-0 leading-tight">
            <p className="truncate font-label-sm text-[9px] font-semibold tracking-[0.16em] text-secondary uppercase">
              As Crônicas de
            </p>
            <p className="truncate font-serif text-sm font-semibold text-on-surface">Beladona</p>
          </div>
        </Link>
      </div>

      <div className="border-b border-outline-variant/25 px-2.5 py-2">
        <Link
          to={profilePath}
          className="group relative flex items-center gap-2.5 overflow-hidden rounded-lg border border-outline-variant/35 bg-surface-container-low/80 p-2 text-left transition hover:border-secondary/50"
        >
          <div className="pointer-events-none absolute inset-0 overflow-hidden opacity-45">
            {profile?.bannerUrl ? (
              <img src={profile.bannerUrl} alt="" className="h-full w-full object-cover transition group-hover:scale-105" />
            ) : (
              <div className="h-full w-full bg-gradient-to-br from-primary-container/40 via-[#1f1318] to-surface-container-lowest" />
            )}
            <div className="absolute inset-0 bg-gradient-to-r from-surface-container-low/95 via-surface-container-low/80 to-surface-container-low/65" />
          </div>
          <div className="relative z-10 flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-full border-2 border-secondary/75 bg-surface-container-high shadow-md">
            {profile?.avatarUrl ? (
              <img src={profile.avatarUrl} alt="" className="h-full w-full object-cover" />
            ) : (
              <span className="material-symbols-outlined text-lg text-secondary">person</span>
            )}
            <span
              className="absolute right-0 bottom-0 h-2.5 w-2.5 rounded-full bg-emerald-500 ring-2 ring-surface-container-low"
              title="Online"
            />
          </div>
          <div className="relative z-10 min-w-0 flex-1">
            <p className="truncate text-xs font-semibold text-on-surface">
              {profile?.displayName ?? session?.displayName ?? 'Conta'}
            </p>
            <p className="truncate font-label-sm text-[9px] tracking-[0.12em] text-secondary uppercase">
              {context === 'admin' ? 'Mestre de Mesa' : 'Jogador da Corte'}
            </p>
          </div>
        </Link>
      </div>

      <nav className="min-h-0 flex-1 overflow-y-auto px-2.5 py-2" aria-label={`Navegação ${breadcrumbRoot}`}>
        <p className="mb-1 px-2 font-label-sm text-[9px] font-semibold tracking-[0.16em] text-outline uppercase">
          {sectionLabel}
        </p>
        <ul className="space-y-0.5">
          {navItems.map((item) => (
            <li key={item.to}>
              <NavLink
                to={item.to}
                end={item.end}
                className={({ isActive }) =>
                  [
                    'flex items-center gap-2 rounded-md border px-2 py-1.5 text-xs transition',
                    isActive
                      ? 'border-primary-container/50 bg-primary-container/20 font-medium text-on-surface shadow-[inset_0_0_0_1px_rgba(255,179,179,0.08)]'
                      : 'border-transparent text-on-surface-variant hover:bg-surface-container-low/80 hover:text-on-surface',
                  ].join(' ')
                }
              >
                {({ isActive }) => (
                  <>
                    <span
                      className={`material-symbols-outlined text-[17px] ${isActive ? 'text-primary' : 'text-outline'}`}
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
      </nav>

      <div className="space-y-0.5 border-t border-outline-variant/25 px-2.5 py-2 text-xs">
        {context === 'player' && canSwitchToAdmin ? (
          <Link
            to="/admin"
            className="flex items-center gap-2 rounded-md px-2 py-1.5 text-secondary transition hover:bg-surface-container-low"
          >
            <span className="material-symbols-outlined text-[17px]">shield_person</span>
            <span className="truncate">Painel do narrador</span>
          </Link>
        ) : null}
        <Link
          to="/ajuda/codice"
          className="flex items-center gap-2 rounded-md px-2 py-1.5 text-on-surface-variant transition hover:bg-surface-container-low hover:text-on-surface"
        >
          <span className="material-symbols-outlined text-[17px] text-outline">help</span>
          <span>Ajuda &amp; códice</span>
        </Link>
        <button
          type="button"
          onClick={() => {
            logout()
            navigate('/auth/login')
          }}
          className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-on-surface-variant transition hover:bg-surface-container-low hover:text-primary"
        >
          <span className="material-symbols-outlined text-[17px] text-outline">logout</span>
          <span>Sair</span>
        </button>
      </div>
    </div>
  )

  return (
    <div className="flex min-h-svh min-h-dvh w-full min-w-0 bg-surface-container-lowest text-on-surface">
      <aside className="sticky top-0 hidden h-dvh w-52 shrink-0 border-r border-outline-variant/30 lg:block xl:w-56">
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
