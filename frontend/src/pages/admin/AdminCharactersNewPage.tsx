import { Link, useSearchParams } from 'react-router-dom'
import { AdminEntityPanel } from '../../components/admin/AdminEntityPanel'
import { MONSTER_CREATURE_TYPES, NPC_CREATURE_TYPES } from '../../lib/characterOptions'
import { useReferenceNames } from '../../hooks/useReferenceNames'

export default function AdminCharactersNewPage() {
  const monsterTypes = useReferenceNames('monster_type', MONSTER_CREATURE_TYPES)
  const [params] = useSearchParams()
  const editKind = params.get('kind')
  const editId = params.get('id')
  return (
    <div className="space-y-4">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-headline-lg text-2xl text-on-surface">Criar monstros & NPCs</h1>
          <p className="mt-1 text-sm text-on-surface-variant">
            Cadastro do mestre — fichas de ameaça e elenco, distintas das fichas de jogador.
          </p>
        </div>
        <Link to="/admin/characters" className="btn-secondary text-xs">
          Ver lista
        </Link>
      </header>
      <div className="grid items-start gap-4 xl:grid-cols-2">
      <AdminEntityPanel
        kind="npc"
        registryVariant="npc"
        syncGlossary
        title="NPC"
        description="Mortais, vampiros, anões, fantasmas e outros tipos de elenco narrativo."
        showCreatureType
        creatureTypeOptions={[...NPC_CREATURE_TYPES]}
        editId={editKind === 'npc' ? editId : null}
      />
      <AdminEntityPanel
        kind="monster"
        registryVariant="monster"
        syncGlossary
        title="Monstro"
        description="Vampiros hostis, lobisomens, ghosts e demais ameaças do bestiário."
        showCreatureType
        creatureTypeOptions={monsterTypes}
        showBestiaryTier
        defaultBestiaryTier="classified"
        editId={editKind === 'monster' ? editId : null}
      />
      </div>
    </div>
  )
}
