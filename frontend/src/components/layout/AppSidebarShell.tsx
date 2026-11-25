import { useEffect, useState, type ReactNode } from 'react'
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom'
import { BrandLogo } from '../brand/BrandLogo'
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
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [offline, setOffline] = useState(!navigator.onLine)
  const location = useLocation()
  const navigate = useNavigate()
  const session = useAuthStore((s) => s.session)
  const logout = useAuthStore((s) => s.logout)

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
    setDrawerOpen(false)
  }, [location.pathname])

  useEffect(() => {
    if (!drawerOpen) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setDrawerOpen(false)
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
      <div className="border-b border-outline-variant/30 px-4 py-4">
        <Link to={homePath} className="flex items-center gap-2.5 transition hover:opacity-90">
          <BrandLogo size="xs" withGlow className="h-9 w-9 shrink-0" />
          <div className="min-w-0 leading-tight">
            <p className="truncate font-label-sm text-[10px] font-semibold tracking-[0.16em] text-secondary uppercase">
              As Crônicas de
            </p>
            <p className="truncate font-serif text-base font-semibold text-on-surface">Beladona</p>
          </div>
        </Link>
      </div>

      <div className="border-b border-outline-variant/25 px-4 py-3">
        <Link
          to={profilePath}
          className="flex items-center gap-2.5 rounded-md px-1.5 py-1 text-sm text-on-surface-variant transition hover:bg-surface-container-low hover:text-on-surface"
        >
          <span className="material-symbols-outlined text-lg text-secondary">person</span>
          <span className="truncate font-medium text-on-surface">{session?.displayName ?? 'Conta'}</span>
        </Link>
      </div>

      <nav className="min-h-0 flex-1 overflow-y-auto px-3 py-4" aria-label={`Navegação ${breadcrumbRoot}`}>
        <p className="mb-2 px-2.5 font-label-sm text-[10px] font-semibold tracking-[0.16em] text-outline uppercase">
          {sectionLabel}
        </p>
        <ul className="space-y-1">
          {navItems.map((item) => (
            <li key={item.to}>
              <NavLink
                to={item.to}
                end={item.end}
                className={({ isActive }) =>
                  [
                    'flex items-center gap-2.5 rounded-md border px-2.5 py-2 text-sm transition',
                    isActive
                      ? 'border-primary-container/50 bg-primary-container/20 font-medium text-on-surface shadow-[inset_0_0_0_1px_rgba(255,179,179,0.08)]'
                      : 'border-transparent text-on-surface-variant hover:bg-surface-container-low/80 hover:text-on-surface',
                  ].join(' ')
                }
              >
                {({ isActive }) => (
                  <>
                    <span
                      className={`material-symbols-outlined text-[18px] ${isActive ? 'text-primary' : 'text-outline'}`}
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

      <div className="space-y-1 border-t border-outline-variant/25 px-3 py-3 text-sm">
        {canSwitchToAdmin ? (
          <Link
            to={context === 'player' ? '/admin' : '/user'}
            className="flex items-center gap-2.5 rounded-md px-2.5 py-2 text-secondary transition hover:bg-surface-container-low"
          >
            <span className="material-symbols-outlined text-[18px]">
              {context === 'player' ? 'shield_person' : 'stadia_controller'}
            </span>
            <span className="truncate">{context === 'player' ? 'Painel do narrador' : 'Área do jogador'}</span>
          </Link>
        ) : null}
        <Link
          to="/ajuda/codice"
          className="flex items-center gap-2.5 rounded-md px-2.5 py-2 text-on-surface-variant transition hover:bg-surface-container-low hover:text-on-surface"
        >
          <span className="material-symbols-outlined text-[18px] text-outline">help</span>
          <span>Ajuda &amp; códice</span>
        </Link>
        <button
          type="button"
          onClick={() => {
            logout()
            navigate('/auth/login')
          }}
          className="flex w-full items-center gap-2.5 rounded-md px-2.5 py-2 text-left text-on-surface-variant transition hover:bg-surface-container-low hover:text-primary"
        >
          <span className="material-symbols-outlined text-[18px] text-outline">logout</span>
          <span>Sair</span>
        </button>
      </div>
    </div>
  )

  return (
    <div className="flex min-h-svh min-h-dvh w-full min-w-0 bg-surface-container-lowest text-on-surface">
      <aside className="sticky top-0 hidden h-dvh w-60 shrink-0 border-r border-outline-variant/30 lg:block">
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
          <div className="safe-px flex h-14 items-center justify-between gap-3">
            <div className="flex min-w-0 items-center gap-2.5">
              <button
                type="button"
                className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-outline-variant/40 text-on-surface-variant hover:border-secondary/50 hover:text-on-surface lg:hidden"
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

        <main className="safe-px mx-auto w-full min-h-0 min-w-0 max-w-7xl flex-1 py-6">
          <Outlet />
        </main>

        <footer className="safe-px safe-pb mt-auto border-t border-outline-variant/25 py-3 text-xs text-outline">
          <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-2">
            <span>As Crônicas de Beladona</span>
            <span className="italic">Uma história que continua.</span>
          </div>
        </footer>
      </div>
    </div>
  )
}
