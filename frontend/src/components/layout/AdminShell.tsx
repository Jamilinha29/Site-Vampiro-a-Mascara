import { useQuery } from '@tanstack/react-query'
import { Link, NavLink, Outlet, useLocation } from 'react-router-dom'
import { BrandLogo } from '../brand/BrandLogo'
import { UserProfileMenu } from '../domain/UserProfileMenu'
import { api } from '../../services/api'
import { adminQueryKeys } from '../../lib/queryKeys'
import { findTodayMesaSession } from '../../lib/mesaSession'

const adminNavBase = [
  { to: '/admin', label: 'Início', end: true },
  { to: '/admin/characters', label: 'Personagens' },
  { to: '/admin/sessions', label: 'Sessões' },
  { to: '/admin/shop', label: 'Loja' },
  { to: '/admin/catalog', label: 'Glossário' },
  { to: '/admin/reference', label: 'Catálogos' },
  { to: '/admin/downloads', label: 'Downloads' },
] as const

const adminNavClass = ({ isActive }: { isActive: boolean }) =>
  [
    'inline-flex shrink-0 items-center self-stretch border-b-2 text-sm whitespace-nowrap transition-colors duration-200',
    isActive
      ? 'border-primary font-bold text-primary'
      : 'border-transparent text-on-surface-variant hover:text-primary',
  ].join(' ')

export function AdminShell() {
  const location = useLocation()
  const isMesaRoute = location.pathname.startsWith('/admin/mesa')
  const { data: scheduled = [] } = useQuery({
    queryKey: adminQueryKeys.scheduledSessions,
    queryFn: () => api.adminListScheduledSessions(),
  })
  const todayMesa = findTodayMesaSession(scheduled)
  const adminNav = todayMesa
    ? [
        adminNavBase[0],
        adminNavBase[1],
        adminNavBase[2],
        { to: `/admin/mesa/${todayMesa.id}`, label: 'Mesa' as const, end: false },
        ...adminNavBase.slice(3),
      ]
    : [...adminNavBase]

  return (
    <div className="app-shell bg-background">
      <header className="sticky top-0 z-50 border-b border-outline-variant bg-surface/95 shadow-md backdrop-blur-md">
        <div className="app-shell-header-bar">
          <div className="flex min-w-0 flex-1 flex-wrap items-stretch gap-x-4 gap-y-1 lg:gap-x-6">
            <Link to="/admin" className="flex shrink-0 items-center self-center focus:outline-none">
              <BrandLogo size="xs" className="h-9 w-9" />
            </Link>

            <nav className="hidden min-w-0 flex-1 flex-wrap items-stretch gap-x-5 gap-y-1 lg:flex xl:gap-x-6">
              {adminNav.map((item) => (
                <NavLink key={item.to} to={item.to} end={'end' in item ? item.end : false} className={adminNavClass}>
                  {item.label}
                </NavLink>
              ))}
            </nav>
          </div>

          <div className="flex min-w-0 items-center self-center">
            <UserProfileMenu context="admin" />
          </div>
        </div>

        <nav className="app-shell-nav-mobile" aria-label="Navegação do mestre">
          {adminNav.map((item) => (
            <NavLink key={item.to} to={item.to} end={'end' in item ? item.end : false} className={adminNavClass}>
              {item.label}
            </NavLink>
          ))}
        </nav>
      </header>

      <main className={`app-shell-main ${isMesaRoute ? 'app-shell-main--wide' : 'max-w-7xl'}`}>
        <Outlet />
      </main>
    </div>
  )
}
