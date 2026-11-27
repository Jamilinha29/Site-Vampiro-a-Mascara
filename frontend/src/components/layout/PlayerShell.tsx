import { NotificationBell } from '../domain/NotificationBell'
import { AppSidebarShell, type SidebarNavGroup } from './AppSidebarShell'

const PLAYER_NAV_GROUPS: readonly SidebarNavGroup[] = [
  {
    label: 'Painel principal',
    items: [{ to: '/user', label: 'Início', icon: 'home', end: true }],
  },
  {
    label: 'Sua jornada',
    items: [
      { to: '/user/characters', label: 'Personagens', icon: 'badge' },
      { to: '/user/sessions', label: 'Sessões', icon: 'calendar_month' },
    ],
  },
  {
    label: 'Biblioteca',
    items: [
      { to: '/user/archive', label: 'Glossário', icon: 'menu_book' },
      { to: '/user/downloads', label: 'Arquivos', icon: 'folder' },
    ],
  },
  {
    label: 'Comunidade',
    items: [{ to: '/user/friends', label: 'Alianças', icon: 'group' }],
  },
  {
    label: 'Recursos',
    items: [
      { to: '/user/shop', label: 'Mercado', icon: 'storefront' },
      { to: '/user/settings', label: 'Configurações', icon: 'tune' },
    ],
  },
]

const PLAYER_LABELS: Record<string, string> = {
  '/user/profile': 'Meu perfil',
  '/user/users': 'Perfil do jogador',
}

export function PlayerShell() {
  return (
    <AppSidebarShell
      context="player"
      navGroups={PLAYER_NAV_GROUPS}
      breadcrumbRoot="Jogador"
      routeLabels={PLAYER_LABELS}
      headerRight={<NotificationBell />}
    />
  )
}
