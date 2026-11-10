import { useQuery } from '@tanstack/react-query'
import { api } from '../../services/api'

type Props = {
  sessionId: string
  mode: 'summary' | 'canon'
}

export function SessionActInlinePanel({ sessionId, mode }: Props) {
  const summaryQuery = useQuery({
    queryKey: ['session-act-summary', sessionId],
    queryFn: () => api.getSessionActSummary(sessionId),
    enabled: mode === 'summary',
    retry: false,
  })
  const canonQuery = useQuery({
    queryKey: ['session-act-canon', sessionId],
    queryFn: () => api.getSessionActCanon(sessionId),
    enabled: mode === 'canon',
    retry: false,
  })

  const loading = mode === 'summary' ? summaryQuery.isLoading : canonQuery.isLoading
  const error = mode === 'summary' ? summaryQuery.error : canonQuery.error

  if (loading) {
    return <p className="mt-3 text-sm text-on-surface-variant">Carregando…</p>
  }

  if (error) {
    return (
      <p className="mt-3 rounded border border-outline-variant/40 bg-surface-container-low/50 px-3 py-2 text-sm text-on-surface-variant">
        {(error as Error).message}
      </p>
    )
  }

  if (mode === 'summary' && summaryQuery.data) {
    return (
      <div className="mt-3 rounded border border-secondary/30 bg-secondary/5 p-4">
        <p className="text-xs uppercase text-secondary">Resumo do ato</p>
        <p className="mt-2 whitespace-pre-wrap font-serif text-sm leading-relaxed text-on-surface">
          {summaryQuery.data.narrativeSummary.trim() || 'Sem texto registrado.'}
        </p>
      </div>
    )
  }

  if (mode === 'canon' && canonQuery.data) {
    const c = canonQuery.data
    return (
      <div className="mt-3 space-y-3 rounded border border-secondary/30 bg-secondary/5 p-4">
        <p className="text-xs uppercase text-secondary">Crônica canônica · {c.chronicleName}</p>
        <p className="whitespace-pre-wrap font-serif text-sm leading-relaxed text-on-surface">
          {c.narrativeSummary.trim() || 'Sem registro canônico.'}
        </p>
        {c.missions.length > 0 ? (
          <div>
            <p className="text-[10px] uppercase text-on-surface-variant">Missões</p>
            <ul className="mt-1 text-sm text-on-surface-variant">
              {c.missions.map((m) => (
                <li key={m.title}>
                  {m.title}{' '}
                  <span className="text-xs uppercase text-secondary">{m.priority}</span>
                </li>
              ))}
            </ul>
          </div>
        ) : null}
        {c.monstersSlain.length > 0 ? (
          <p className="text-sm text-on-surface-variant">
            <span className="text-[10px] uppercase text-secondary">Bestiário do ato · </span>
            {c.monstersSlain.map((m) => m.name).join(', ')}
          </p>
        ) : null}
        {c.participants.length > 0 ? (
          <ul className="text-xs text-on-surface-variant">
            {c.participants.map((p) => (
              <li key={`${p.displayName}-${p.characterName}`}>
                {p.characterName} ({p.displayName})
              </li>
            ))}
          </ul>
        ) : null}
      </div>
    )
  }

  return null
}
