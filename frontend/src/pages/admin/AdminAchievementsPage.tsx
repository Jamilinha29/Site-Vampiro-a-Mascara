import { Navigate } from 'react-router-dom'

/** Conquistas ficam no perfil do mestre, ao lado dos avisos. */
export default function AdminAchievementsPage() {
  return <Navigate to="/admin/profile#conquistas" replace />
}
