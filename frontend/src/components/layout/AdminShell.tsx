import { AppSidebarShell, type SidebarNavItem } from './AppSidebarShell'

const ADMIN_NAV: readonly SidebarNavItem[] = [
  { to: '/admin', label: 'Início', icon: 'home', end: true },
  { to: '/admin/characters', label: 'Personagens', icon: 'badge' },
  { to: '/admin/sessions', label: 'Sessões', icon: 'calendar_month' },
  { to: '/admin/mesa', label: 'Mesa ao vivo', icon: 'casino' },
  { to: '/admin/campaign', label: 'Campanha', icon: 'flag' },
  { to: '/admin/shop', label: 'Loja', icon: 'storefront' },
  { to: '/admin/catalog', label: 'Glossário', icon: 'menu_book' },
  { to: '/admin/reference', label: 'Catálogos', icon: 'category' },
  { to: '/admin/downloads', label: 'Downloads', icon: 'folder' },
  { to: '/admin/users', label: 'Amigos e jogadores', icon: 'group' },
  { to: '/admin/rewards', label: 'Recompensas', icon: 'workspace_premium' },
  { to: '/admin/settings', label: 'Configurações', icon: 'tune' },
]

export function AdminShell() {
  return (
    <AppSidebarShell
      context="admin"
      sectionLabel="Gestão da crônica"
      navItems={ADMIN_NAV}
      breadcrumbRoot="Narrador"
      routeLabels={{
        '/admin/achievements': 'Conquistas',
        '/admin/mesa': 'Mesa ao vivo',
        '/admin/profile': 'Meu perfil',
      }}
    />
  )
}
