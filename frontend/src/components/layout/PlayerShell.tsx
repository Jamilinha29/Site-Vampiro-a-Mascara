import { NotificationBell } from '../domain/NotificationBell'
import { UserProfileMenu } from '../domain/UserProfileMenu'
import { AppSidebarShell, type SidebarNavItem } from './AppSidebarShell'

const PLAYER_NAV: readonly SidebarNavItem[] = [
  { to: '/user', label: 'Início', icon: 'home', end: true },
  { to: '/user/characters', label: 'Personagens', icon: 'badge' },
  { to: '/user/sessions', label: 'Sessões', icon: 'calendar_month' },
  { to: '/user/friends', label: 'Amigos', icon: 'group' },
  { to: '/user/shop', label: 'Loja', icon: 'storefront' },
  { to: '/user/archive', label: 'Glossário', icon: 'menu_book' },
  { to: '/user/bestiary', label: 'Bestiário', icon: 'pets' },
  { to: '/user/downloads', label: 'Downloads', icon: 'folder' },
  { to: '/user/settings', label: 'Configurações', icon: 'tune' },
]

const PLAYER_LABELS: Record<string, string> = {
  '/user/profile': 'Meu perfil',
  '/user/users': 'Perfil do jogador',
}

export function PlayerShell() {
  return (
    <AppSidebarShell
      context="player"
      sectionLabel="Sua jornada"
      navItems={PLAYER_NAV}
      breadcrumbRoot="Jogador"
      routeLabels={PLAYER_LABELS}
      headerRight={
        <>
          <NotificationBell />
          <UserProfileMenu context="player" />
        </>
      }
    />
  )
}
