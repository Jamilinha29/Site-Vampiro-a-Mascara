import type { ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import { SelectableBlock } from '../ui/SelectableBlock'

export type ScreenBlock = {
  id: string
  title: string
  description?: string
  icon?: string
  /** Se definido, um clique no bloco navega direto para a rota. */
  to?: string
}

type Props = {
  title: string
  description: string
  blocks: ScreenBlock[]
  selectedId: string | null
  onSelect: (id: string | null) => void
  renderDetail: (block: ScreenBlock) => ReactNode
  headerExtra?: ReactNode
}

export function ScreenBlockLayout({
  title,
  description,
  blocks,
  selectedId,
  onSelect,
  renderDetail,
  headerExtra,
}: Props) {
  const navigate = useNavigate()
  const selected = blocks.find((b) => b.id === selectedId)

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="font-headline-lg text-2xl text-on-surface">{title}</h1>
          <p className="mt-2 max-w-3xl text-sm text-on-surface-variant">{description}</p>
        </div>
        {headerExtra}
      </header>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {blocks.map((block) => (
          <SelectableBlock
            key={block.id}
            title={block.title}
            description={block.description}
            icon={block.icon}
            selected={selectedId === block.id}
            onClick={() => {
              if (block.to) {
                navigate(block.to)
                return
              }
              onSelect(selectedId === block.id ? null : block.id)
            }}
          />
        ))}
      </div>

      {selected && !selected.to ? (
        <section className="card-surface space-y-4 p-6">
          <h2 className="font-label-sm text-xs text-secondary uppercase">Painel — {selected.title}</h2>
          {renderDetail(selected)}
        </section>
      ) : null}
    </div>
  )
}
