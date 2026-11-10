import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { useAuthStore } from '../stores/authStore'

export function RequireAuth() {
  const session = useAuthStore((s) => s.session)
  const location = useLocation()

  if (!session) {
    return <Navigate to="/auth/login" replace state={{ from: location.pathname }} />
  }

  return <Outlet />
}

/** Área /user — apenas jogadores. Narrador e admin usam /admin. */
export function RequirePlayer() {
  const session = useAuthStore((s) => s.session)
  const role = session?.role

  if (role === 'narrator' || role === 'admin') {
    return <Navigate to="/admin" replace />
  }

  return <Outlet />
}
