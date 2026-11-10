import { Navigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { api } from '../../services/api'
import { adminQueryKeys } from '../../lib/queryKeys'
import { findTodayMesaSession } from '../../lib/mesaSession'

/** Recompensas ficam só na Mesa; rota legada redireciona. */
export default function AdminRewardsPage() {
  const { data: scheduled = [] } = useQuery({
    queryKey: adminQueryKeys.scheduledSessions,
    queryFn: () => api.adminListScheduledSessions(),
  })
  const today = findTodayMesaSession(scheduled)
  if (today) return <Navigate to={`/admin/mesa/${today.id}`} replace />
  return <Navigate to="/admin/mesa" replace />
}
