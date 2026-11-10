import { Link, useParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { AdminMesaWorkbench } from '../../components/admin/AdminMesaWorkbench'
import { api } from '../../services/api'
import { adminQueryKeys } from '../../lib/queryKeys'
import { findTodayMesaSession, mesaDisplayName } from '../../lib/mesaSession'

export default function AdminMesaPage() {
  const { sessionId } = useParams()
  const { data: scheduled = [], isLoading } = useQuery({
    queryKey: adminQueryKeys.scheduledSessions,
    queryFn: () => api.adminListScheduledSessions(),
  })
  const { data: handouts = [] } = useQuery({
    queryKey: adminQueryKeys.handouts,
    queryFn: () => api.adminListHandouts(),
  })

  const session = sessionId ? scheduled.find((s) => s.id === sessionId) : findTodayMesaSession(scheduled)

  const actNumber = (() => {
    if (!session) return 1
    const key = mesaDisplayName(session).trim().toLowerCase()
    const sameChronicle = handouts.filter(
      (h) => (h.chronicleName ?? h.title).trim().toLowerCase() === key,
    )
    return Math.max(1, sameChronicle.length)
  })()

  if (isLoading) {
    return <p className="text-sm text-on-surface-variant">Abrindo a mesa…</p>
  }

  if (!session) {
    return (
      <div className="card-surface space-y-4 p-8 text-center">
        <h1 className="font-headline-lg text-2xl text-on-surface">Mesa</h1>
        <p className="text-sm text-on-surface-variant">
          Nenhuma mesa aberta para hoje. Em <strong className="text-on-surface">Início</strong>, informe o nome da crônica e
          use <strong className="text-on-surface">Criar mesa do dia</strong>.
        </p>
        <Link to="/admin" className="btn-primary inline-flex text-sm">
          Voltar ao início
        </Link>
      </div>
    )
  }

  return <AdminMesaWorkbench session={session} actNumber={actNumber} />
}
