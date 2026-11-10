import { Link } from 'react-router-dom'
import { AdminEntityPanel } from '../../components/admin/AdminEntityPanel'
import { MONSTER_CREATURE_TYPES, NPC_CREATURE_TYPES } from '../../lib/characterOptions'

export default function AdminCharactersNewPage() {
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
        showStats
        showCreatureType
        creatureTypeOptions={[...NPC_CREATURE_TYPES]}
      />
      <AdminEntityPanel
        kind="monster"
        registryVariant="monster"
        syncGlossary
        title="Monstro"
        description="Vampiros hostis, lobisomens, ghosts e demais ameaças do bestiário."
        showStats
        showCreatureType
        creatureTypeOptions={[...MONSTER_CREATURE_TYPES]}
        showBestiaryTier
        defaultBestiaryTier="classified"
      />
      </div>
    </div>
  )
}
