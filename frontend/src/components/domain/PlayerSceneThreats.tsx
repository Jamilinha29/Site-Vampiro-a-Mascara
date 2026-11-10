import { useQuery } from '@tanstack/react-query'
import { StatBar } from '../domain/StatBar'
import { api } from '../../services/api'
import { playerQueryKeys } from '../../lib/queryKeys'

export function PlayerSceneThreats({ sessionId }: { sessionId: string }) {
  const { data: threats = [], isLoading } = useQuery({
    queryKey: playerQueryKeys.sceneThreats(sessionId),
    queryFn: () => api.getSessionSceneThreats(sessionId),
    refetchInterval: 4000,
  })

  return (
    <section className="mesa-panel p-5">
      <h2 className="font-label-sm text-xs text-secondary uppercase">Ameaças em cena</h2>
      <p className="mt-1 text-xs text-on-surface-variant">
        HP e mana atualizados pelo mestre conforme os ataques da mesa.
      </p>
      {isLoading ? <p className="mt-3 text-sm text-on-surface-variant">Sincronizando…</p> : null}
      {!isLoading && threats.length === 0 ? (
        <p className="mt-3 text-sm text-on-surface-variant">Nenhum monstro em cena no momento.</p>
      ) : (
        <ul className="mt-4 space-y-4">
          {threats.map((t) => (
            <li key={t.id}>
              <p className="font-serif text-lg text-on-surface">{t.name}</p>
              <StatBar label="Vitalidade" current={t.hpCurrent} max={t.hpMax} />
              <StatBar label="Mana" current={t.manaCurrent} max={Math.max(t.manaMax, 1)} variant="will" />
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
