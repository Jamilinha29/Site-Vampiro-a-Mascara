import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { api } from '../../services/api'
import type { ChronicleEntity } from '../../types/chronicle'

function EntityRow({ item }: { item: ChronicleEntity }) {
  return (
    <li className="flex flex-wrap items-center justify-between gap-2 rounded border border-outline-variant/40 px-3 py-2 text-sm">
      <div>
        <span className="font-serif text-on-surface">{item.name}</span>
        <span className="ml-2 text-xs text-on-surface-variant">
          {item.kind === 'npc' ? 'NPC' : 'Monstro'}
          {item.creatureType ? ` · ${item.creatureType}` : ''} ·{' '}
          {item.visibility === 'published' ? 'Publicado' : 'Rascunho'}
        </span>
      </div>
    </li>
  )
}

export default function AdminCharactersPage() {
  const { data: npcs = [], isLoading: loadingNpc } = useQuery({
    queryKey: ['admin-entities', 'npc'],
    queryFn: () => api.adminListEntities('npc'),
  })
  const { data: monsters = [], isLoading: loadingMon } = useQuery({
    queryKey: ['admin-entities', 'monster'],
    queryFn: () => api.adminListEntities('monster'),
  })

  const all = [...npcs, ...monsters].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
  const loading = loadingNpc || loadingMon

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="font-headline-lg text-2xl text-on-surface">Monstros & NPCs</h1>
          <p className="mt-2 max-w-3xl text-sm text-on-surface-variant">
            Ameaças e elenco do narrador (não são fichas de jogador). Cadastre novos em{' '}
            <strong className="text-on-surface">Criar monstros & NPCs</strong>.
          </p>
        </div>
        <Link to="/admin/characters/new" className="btn-primary text-xs">
          Criar monstros & NPCs
        </Link>
      </header>

      <section className="card-surface p-6">
        {loading ? <p className="text-sm text-on-surface-variant">Carregando…</p> : null}
        <ul className="space-y-2">
          {all.map((item) => (
            <EntityRow key={item.id} item={item} />
          ))}
          {!loading && all.length === 0 ? (
            <li className="text-sm text-on-surface-variant">Nenhum personagem cadastrado ainda.</li>
          ) : null}
        </ul>
      </section>
    </div>
  )
}
