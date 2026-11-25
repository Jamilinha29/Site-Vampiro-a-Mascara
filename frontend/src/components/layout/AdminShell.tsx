import { useQuery } from '@tanstack/react-query'
import { UserProfileMenu } from '../domain/UserProfileMenu'
import { api } from '../../services/api'
import { adminQueryKeys } from '../../lib/queryKeys'
import { findTodayMesaSession } from '../../lib/mesaSession'
import { AppSidebarShell, type SidebarNavItem } from './AppSidebarShell'

export function AdminShell() {
  const { data: scheduled = [] } = useQuery({
    queryKey: adminQueryKeys.scheduledSessions,
    queryFn: () => api.adminListScheduledSessions(),
  })
  const todayMesa = findTodayMesaSession(scheduled)

  const adminNav: SidebarNavItem[] = [
    { to: '/admin', label: 'Início', icon: 'home', end: true },
    { to: '/admin/characters', label: 'Personagens', icon: 'badge' },
    { to: '/admin/sessions', label: 'Sessões', icon: 'calendar_month' },
    { to: todayMesa ? `/admin/mesa/${todayMesa.id}` : '/admin/mesa', label: 'Mesa ao vivo', icon: 'casino' },
    { to: '/admin/campaign', label: 'Campanha', icon: 'flag' },
    { to: '/admin/shop', label: 'Loja', icon: 'storefront' },
    { to: '/admin/catalog', label: 'Glossário', icon: 'menu_book' },
    { to: '/admin/reference', label: 'Catálogos', icon: 'category' },
    { to: '/admin/bestiary', label: 'Bestiário', icon: 'pets' },
    { to: '/admin/downloads', label: 'Downloads', icon: 'folder' },
    { to: '/admin/users', label: 'Amigos e jogadores', icon: 'group' },
    { to: '/admin/rewards', label: 'Recompensas', icon: 'workspace_premium' },
    { to: '/admin/profile', label: 'Meu perfil', icon: 'account_circle' },
    { to: '/admin/settings', label: 'Configurações', icon: 'tune' },
  ]

  return (
    <AppSidebarShell
      context="admin"
      sectionLabel="Gestão da crônica"
      navItems={adminNav}
      breadcrumbRoot="Narrador"
      routeLabels={{
        '/admin/achievements': 'Conquistas',
        '/admin/mesa': 'Mesa ao vivo',
      }}
      headerRight={<UserProfileMenu context="admin" />}
    />
  )
}
