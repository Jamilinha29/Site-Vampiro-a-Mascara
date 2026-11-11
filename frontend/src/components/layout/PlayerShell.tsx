import { BrandLogo } from '../brand/BrandLogo'
import { Link, NavLink, Outlet } from 'react-router-dom'
import { NotificationBell } from '../domain/NotificationBell'
import { UserProfileMenu } from '../domain/UserProfileMenu'

const playerNavClass = ({ isActive }: { isActive: boolean }) =>
  [
    'inline-flex items-center py-1 text-sm whitespace-nowrap transition-colors duration-200',
    isActive
      ? 'border-b-2 border-primary font-bold text-primary'
      : 'text-on-surface-variant hover:text-primary',
  ].join(' ')

export function PlayerShell() {
  return (
    <div className="flex min-h-svh flex-col bg-background">
      <header className="sticky top-0 z-50 border-b border-outline-variant bg-surface/95 shadow-md backdrop-blur-md">
        <div className="mx-auto flex max-w-7xl min-w-0 items-center justify-between gap-2 px-4 py-2.5 sm:gap-4 sm:px-6 lg:gap-5">
          <div className="flex min-w-0 flex-1 items-center gap-3 lg:gap-6">
            <Link to="/user" className="shrink-0 focus:outline-none">
              <BrandLogo size="xs" className="h-9 w-9" />
            </Link>

            <nav className="hidden min-w-0 flex-1 items-center gap-4 overflow-x-auto lg:flex xl:gap-5">
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

          <div className="flex shrink-0 items-center gap-1.5 sm:gap-3">
            <NotificationBell />
            <UserProfileMenu context="player" />
          </div>
        </div>

        <nav className="flex items-center gap-4 overflow-x-auto border-t border-outline-variant/30 px-4 py-2 lg:hidden">
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

      <main className="mx-auto w-full min-h-0 max-w-7xl flex-1 px-4 py-4 lg:px-6 lg:py-5">
        <Outlet />
      </main>
    </div>
  )
}
