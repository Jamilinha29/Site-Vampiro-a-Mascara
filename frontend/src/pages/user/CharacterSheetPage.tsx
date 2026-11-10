import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { DotRating } from '../../components/domain/DotRating'
import { StatBar } from '../../components/domain/StatBar'
import { SelectableBlock } from '../../components/ui/SelectableBlock'

const SECTIONS = [
  { id: 'vitals', title: 'Vitalidade & reservas', icon: 'favorite' },
  { id: 'attributes', title: 'Atributos', icon: 'psychology' },
  { id: 'disciplines', title: 'Disciplinas', icon: 'bolt' },
  { id: 'background', title: 'Antecedentes', icon: 'history_edu' },
]

export default function CharacterSheetPage() {
  const { characterId } = useParams()
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const selected = SECTIONS.find((s) => s.id === selectedId)

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="font-headline-lg text-2xl text-on-surface">Ficha digital</h1>
          <p className="mt-1 text-sm text-on-surface-variant">
            Personagem <span className="font-mono text-secondary">{characterId ?? '—'}</span> — selecione um bloco da ficha.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link to={`/user/characters/${characterId}/inventory`} className="btn-secondary text-xs">
            Inventário
          </Link>
          <Link to="/user/profile" className="btn-secondary text-xs">
            Meu perfil
          </Link>
        </div>
      </header>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {SECTIONS.map((sec) => (
          <SelectableBlock
            key={sec.id}
            icon={sec.icon}
            title={sec.title}
            selected={selectedId === sec.id}
            onClick={() => setSelectedId(selectedId === sec.id ? null : sec.id)}
          />
        ))}
      </div>

      {selected ? (
        <section className="card-surface p-6">
          {selected.id === 'vitals' ? (
            <div className="grid gap-4 sm:grid-cols-2">
              <StatBar label="Vitalidade" current={0} max={10} />
              <StatBar label="Vontade" current={0} max={8} variant="will" />
              <p className="sm:col-span-2 text-xs text-on-surface-variant">
                Valores reais carregados quando a ficha estiver sincronizada com a campanha.
              </p>
            </div>
          ) : null}
          {selected.id === 'attributes' ? (
            <div>
              <p className="mb-2 text-xs uppercase text-on-surface-variant">Exemplo de pontos</p>
              <DotRating value={0} readOnly />
            </div>
          ) : null}
          {selected.id === 'disciplines' ? (
            <p className="text-sm text-on-surface-variant">Nenhuma disciplina registrada nesta ficha ainda.</p>
          ) : null}
          {selected.id === 'background' ? (
            <p className="text-sm text-on-surface-variant">Antecedentes e notas do narrador aparecerão aqui.</p>
          ) : null}
        </section>
      ) : null}
    </div>
  )
}
