import { useQuery } from '@tanstack/react-query'
import { api } from '../../services/api'

export function AchievementMural() {
  const { data: items = [], isLoading } = useQuery({
    queryKey: ['achievement-mural'],
    queryFn: () => api.getAchievementMural(),
  })

  return (
    <section className="mesa-panel p-4">
      <h2 className="font-headline-sm text-lg text-on-surface">Mural de conquistas</h2>
      <p className="mt-1 text-xs text-on-surface-variant">
        O mestre define como cada feito é conquistado e marca quando você o cumpre.
      </p>
      {isLoading ? <p className="mt-3 text-sm text-on-surface-variant">Abrindo o mural…</p> : null}
      {!isLoading && items.length === 0 ? (
        <p className="mt-3 text-sm text-on-surface-variant">Nenhuma conquista publicada ainda.</p>
      ) : (
        <ul className="mt-4 grid auto-rows-fr gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {items.map((item) => (
            <li
              key={item.id}
              className={`flex h-full flex-col justify-between rounded border p-3.5 ${
                item.unlocked ? 'border-secondary/60 bg-secondary/10' : 'border-outline-variant/40 opacity-80'
              }`}
            >
              <p className="font-serif text-on-surface">{item.title}</p>
              {item.description ? <p className="mt-1 text-xs text-on-surface-variant">{item.description}</p> : null}
              <p className="mt-2 text-xs text-secondary">Como conquistar · {item.howToEarn}</p>
              <p className="mt-2 text-[10px] uppercase tracking-wide text-on-surface-variant">
                {item.unlocked ? 'Conquistada' : 'Ainda fechada'}
              </p>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
