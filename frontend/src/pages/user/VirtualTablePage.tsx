import { Link, useParams } from 'react-router-dom'
import { PlayerSessionWorkbench } from '../../components/session/PlayerSessionWorkbench'

export default function VirtualTablePage() {
  const { sessionId } = useParams()

  if (!sessionId) {
    return (
      <div className="card-surface p-8 text-center">
        <p className="text-on-surface-variant">Sala não informada.</p>
        <Link to="/user/sessions" className="btn-primary mt-4 inline-flex text-sm">
          Central de sessões
        </Link>
      </div>
    )
  }

  return <PlayerSessionWorkbench sessionId={sessionId} />
}
