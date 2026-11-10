import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { ScreenBlockLayout } from '../../components/layout/ScreenBlockLayout'

const BLOCKS = [
  { id: 'equipped', title: 'Equipado', description: 'Itens em uso no personagem.', icon: 'shield' },
  { id: 'bag', title: 'Bolsa', description: 'Inventário geral e carga.', icon: 'backpack' },
  { id: 'stash', title: 'Refúgio', description: 'Itens guardados fora da sessão.', icon: 'home_storage' },
]

export default function CharacterInventoryPage() {
  const { characterId } = useParams()
  const [selectedId, setSelectedId] = useState<string | null>(null)

  return (
    <ScreenBlockLayout
      title="Inventário & equipamentos"
      description="Equipar, usar, reparar e ofertar conforme política da mesa."
      blocks={BLOCKS}
      selectedId={selectedId}
      onSelect={setSelectedId}
      headerExtra={
        <Link to={`/user/characters/${characterId}`} className="btn-secondary text-xs">
          Voltar à ficha
        </Link>
      }
      renderDetail={(block) => (
        <p className="text-sm text-on-surface-variant">
          Nenhum item em <strong className="text-on-surface">{block.title}</strong>. Compras e loot aparecem quando a mesa
          registrar transações reais.
        </p>
      )}
    />
  )
}
