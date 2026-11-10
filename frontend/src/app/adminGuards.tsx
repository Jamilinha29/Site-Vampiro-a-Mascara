import { Navigate, Outlet } from 'react-router-dom'
import { useAuthStore } from '../stores/authStore'

export function RequireNarrator() {
  const session = useAuthStore((s) => s.session)
  if (!session) {
    return <Navigate to="/auth/login" replace />
  }
  if (session.role !== 'narrator' && session.role !== 'admin') {
    return <Navigate to="/user" replace />
  }
  return <Outlet />
}
