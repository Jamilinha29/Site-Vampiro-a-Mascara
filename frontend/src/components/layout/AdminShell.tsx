import { AppSidebarShell, type SidebarNavGroup } from './AppSidebarShell'

const ADMIN_NAV_GROUPS: readonly SidebarNavGroup[] = [
  {
    label: 'Painel principal',
    items: [{ to: '/admin', label: 'Início', icon: 'home', end: true }],
  },
  {
    label: 'Gestão da crônica',
    items: [
      { to: '/admin/campaign', label: 'Campanhas', icon: 'flag' },
      { to: '/admin/characters', label: 'Personagens', icon: 'groups' },
      { to: '/admin/sessions', label: 'Sessões', icon: 'calendar_month' },
      { to: '/admin/mesa', label: 'Mesa ao Vivo', icon: 'sensors' },
    ],
  },
  {
    label: 'Biblioteca',
    items: [
      { to: '/admin/reference', label: 'Catálogos', icon: 'library_books' },
      { to: '/admin/catalog', label: 'Glossário', icon: 'menu_book' },
      { to: '/admin/downloads', label: 'Arquivos', icon: 'inventory_2' },
    ],
  },
  {
    label: 'Comunidade',
    items: [
      { to: '/admin/users', label: 'Amigos e jogadores', icon: 'diversity_3' },
      { to: '/admin/rewards', label: 'Recompensas', icon: 'emoji_events' },
    ],
  },
  {
    label: 'Recursos',
    items: [
      { to: '/admin/shop', label: 'Mercado', icon: 'storefront' },
      { to: '/admin/settings', label: 'Configurações', icon: 'settings' },
    ],
  },
]

export function AdminShell() {
  return (
    <AppSidebarShell
      context="admin"
      navGroups={ADMIN_NAV_GROUPS}
      breadcrumbRoot="Narrador"
      routeLabels={{
        '/admin/achievements': 'Conquistas',
        '/admin/mesa': 'Mesa ao Vivo',
        '/admin/profile': 'Meu perfil',
      }}
    />
  )
}
