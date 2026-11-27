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
      { to: '/admin/characters', label: 'Personagens', icon: 'badge' },
      { to: '/admin/sessions', label: 'Sessões', icon: 'calendar_month' },
      { to: '/admin/mesa', label: 'Mesa ao Vivo', icon: 'casino' },
    ],
  },
  {
    label: 'Biblioteca',
    items: [
      { to: '/admin/reference', label: 'Compêndio', icon: 'category' },
      { to: '/admin/catalog', label: 'Glossário', icon: 'menu_book' },
      { to: '/admin/downloads', label: 'Arquivos', icon: 'folder' },
    ],
  },
  {
    label: 'Comunidade',
    items: [
      { to: '/admin/users', label: 'Alianças', icon: 'group' },
      { to: '/admin/rewards', label: 'Conquistas e Recompensas', icon: 'workspace_premium' },
    ],
  },
  {
    label: 'Recursos',
    items: [
      { to: '/admin/shop', label: 'Mercado', icon: 'storefront' },
      { to: '/admin/settings', label: 'Configurações', icon: 'tune' },
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
        '/admin/achievements': 'Conquistas e Recompensas',
        '/admin/mesa': 'Mesa ao Vivo',
        '/admin/profile': 'Meu perfil',
      }}
    />
  )
}
