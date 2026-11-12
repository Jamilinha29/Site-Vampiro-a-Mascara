import { BrandLogo } from '../brand/BrandLogo'
import { Link, NavLink, Outlet } from 'react-router-dom'
import { NotificationBell } from '../domain/NotificationBell'
import { UserProfileMenu } from '../domain/UserProfileMenu'

const playerNavClass = ({ isActive }: { isActive: boolean }) =>
  [
    'inline-flex items-center self-stretch border-b-2 text-sm whitespace-nowrap transition-colors duration-200',
    isActive
      ? 'border-primary font-bold text-primary'
      : 'border-transparent text-on-surface-variant hover:text-primary',
  ].join(' ')

export function PlayerShell() {
  return (
    <div className="app-shell bg-background">
      <header className="sticky top-0 z-50 border-b border-outline-variant bg-surface/95 shadow-md backdrop-blur-md">
        <div className="app-shell-header-bar">
          <div className="flex min-w-0 flex-1 flex-wrap items-stretch gap-x-4 gap-y-1 lg:gap-x-6">
            <Link to="/user" className="flex shrink-0 items-center self-center focus:outline-none">
              <BrandLogo size="xs" className="h-9 w-9" />
            </Link>

            <nav className="hidden min-w-0 flex-1 flex-wrap items-stretch gap-x-5 gap-y-1 lg:flex xl:gap-x-6">
              <NavLink to="/user" end className={playerNavClass}>
                Início
              </NavLink>
              <NavLink to="/user/characters" className={playerNavClass}>
                Personagens
              </NavLink>
              <NavLink to="/user/sessions" className={playerNavClass}>
                Sessões
              </NavLink>
              <NavLink to="/user/shop" className={playerNavClass}>
                Loja
              </NavLink>
              <NavLink to="/user/archive" className={playerNavClass}>
                Glossário
              </NavLink>
              <NavLink to="/user/downloads" className={playerNavClass}>
                Downloads
              </NavLink>
            </nav>
          </div>

          <div className="flex min-w-0 items-center gap-2 self-center sm:gap-3">
            <NotificationBell />
            <UserProfileMenu context="player" />
          </div>
        </div>

        <nav className="app-shell-nav-mobile" aria-label="Navegação do jogador">
          <NavLink to="/user" end className={playerNavClass}>
            Início
          </NavLink>
          <NavLink to="/user/characters" className={playerNavClass}>
            Personagens
          </NavLink>
          <NavLink to="/user/sessions" className={playerNavClass}>
            Sessões
          </NavLink>
          <NavLink to="/user/shop" className={playerNavClass}>
            Loja
          </NavLink>
          <NavLink to="/user/archive" className={playerNavClass}>
            Glossário
          </NavLink>
          <NavLink to="/user/downloads" className={playerNavClass}>
            Downloads
          </NavLink>
        </nav>
      </header>

      <main className="app-shell-main max-w-7xl">
        <Outlet />
      </main>
    </div>
  )
}
