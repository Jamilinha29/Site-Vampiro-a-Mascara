import type { ChronicleEntity, SessionHandout } from '../../types/chronicle'

export function PlayerPublishedList({
  items,
  handouts,
  empty,
}: {
  items: ChronicleEntity[]
  handouts?: SessionHandout[]
  empty: string
}) {
  if (items.length === 0 && (!handouts || handouts.length === 0)) {
    return <p className="text-sm text-on-surface-variant">{empty}</p>
  }

  return (
    <ul className="space-y-3">
      {items.map((item) => (
        <li key={item.id} className="rounded border border-outline-variant/30 bg-surface-container-lowest/30 p-3 text-sm">
          <p className="font-serif text-on-surface">{item.name}</p>
          {item.description ? <p className="mt-1 text-on-surface-variant">{item.description}</p> : null}
          {item.statsText ? (
            <pre className="mt-2 overflow-x-auto rounded bg-surface-container-high p-2 text-xs text-on-surface-variant whitespace-pre-wrap">
              {item.statsText}
            </pre>
          ) : null}
          {item.priceGold != null || item.priceSilver != null || item.priceCopper != null ? (
            <p className="mt-2 text-xs text-secondary">
              Preço:{' '}
              {(item.priceGold ?? 0) > 0 ? `${item.priceGold} ouro` : null}
              {(item.priceGold ?? 0) > 0 && (item.priceSilver ?? 0) > 0 ? ' · ' : null}
              {(item.priceSilver ?? 0) > 0 ? `${item.priceSilver} prata` : null}
              {((item.priceGold ?? 0) > 0 || (item.priceSilver ?? 0) > 0) && (item.priceCopper ?? 0) > 0 ? ' · ' : null}
              {(item.priceCopper ?? 0) > 0 ? `${item.priceCopper} bronze` : null}
            </p>
          ) : null}
          {item.fileUrl ? (
            <a href={item.fileUrl} download={item.fileName} className="btn-secondary mt-2 inline-flex text-xs">
              Baixar {item.fileName ?? 'arquivo'}
            </a>
          ) : null}
        </li>
      ))}
      {handouts?.map((h) => (
        <li key={h.id} className="rounded border border-secondary/30 bg-secondary/5 p-3 text-sm">
          <p className="font-serif text-on-surface">{h.title}</p>
          <p className="mt-1 text-on-surface-variant">{h.narrativeSummary}</p>
          {h.monstersSlain.length > 0 ? (
            <p className="mt-2 text-xs text-on-surface-variant">
              Monstros: {h.monstersSlain.map((m) => m.name).join(', ')}
            </p>
          ) : null}
          {h.missions.length > 0 ? (
            <ul className="mt-2 text-xs text-on-surface-variant">
              {h.missions.map((m) => (
                <li key={m.title}>
                  [{m.priority}] {m.title}
                </li>
              ))}
            </ul>
          ) : null}
        </li>
      ))}
    </ul>
  )
}
