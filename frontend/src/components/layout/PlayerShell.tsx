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
      { to: '/user/characters', label: 'Personagens', icon: 'groups' },
      { to: '/user/sessions', label: 'Sessões', icon: 'calendar_month' },
    ],
  },
  {
    label: 'Biblioteca',
    items: [
      { to: '/user/archive', label: 'Glossário', icon: 'menu_book' },
      { to: '/user/downloads', label: 'Arquivos', icon: 'inventory_2' },
    ],
  },
  {
    label: 'Comunidade',
    items: [{ to: '/user/friends', label: 'Amigos', icon: 'diversity_3' }],
  },
  {
    label: 'Recursos',
    items: [
      { to: '/user/shop', label: 'Mercado', icon: 'storefront' },
      { to: '/user/settings', label: 'Configurações', icon: 'settings' },
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
