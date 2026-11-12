import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { api } from '../../services/api'
import type { ChronicleEntity } from '../../types/chronicle'

const PAGE_SIZE = 6

function CharacterCard({ item }: { item: ChronicleEntity }) {
  const draft = item.visibility !== 'published'
  return (
    <article className="flex flex-col overflow-hidden rounded-2xl border border-white/10 bg-[#141414]">
      <div className="relative h-36 bg-black">
        {item.imageUrl ? (
          <img src={item.imageUrl} alt="" className="h-full w-full object-cover" />
        ) : (
          <div className="flex h-full items-center justify-center bg-[radial-gradient(circle_at_center,#2a1810,#090909)]">
            <span className="material-symbols-outlined text-4xl text-white/25">
              {item.kind === 'npc' ? 'person' : 'pest_control'}
            </span>
          </div>
        )}
        <span className="absolute top-2 left-2 rounded border border-white/20 bg-black/60 px-1.5 py-0.5 text-[9px] font-bold tracking-wide text-white/85 uppercase">
          {draft ? 'Rascunho' : 'Publicado'}
        </span>
      </div>
      <div className="flex flex-1 flex-col px-4 pt-3 pb-3">
        <h2 className="font-serif text-lg text-white">{item.name}</h2>
        <p className="mt-1 text-[11px] tracking-wide text-secondary uppercase">
          {item.kind === 'npc' ? 'NPC' : 'Monstro'}
          {item.creatureType ? ` · ${item.creatureType}` : ''}
        </p>
        <p className="mt-1 text-[11px] text-white/45">
          HP {item.hpMax ?? '—'} · Mana {item.manaMax ?? '—'}
          {item.location ? ` · ${item.location}` : ''}
        </p>
        <p className="mt-2 line-clamp-2 text-xs text-white/55">
          {item.description || 'Sem descrição.'}
        </p>
        <Link
          to={`/admin/characters/new?kind=${item.kind}&id=${item.id}`}
          className="mt-3 ml-auto inline-flex items-center gap-1 text-xs text-white/80 hover:text-white"
        >
          <span className="material-symbols-outlined text-base">edit</span>
          Editar
        </Link>
      </div>
    </article>
  )
}

export default function AdminCharactersPage() {
  const [query, setQuery] = useState('')
  const [page, setPage] = useState(1)
  const { data: npcs = [], isLoading: loadingNpc } = useQuery({
    queryKey: ['admin-entities', 'npc'],
    queryFn: () => api.adminListEntities('npc'),
  })
  const { data: monsters = [], isLoading: loadingMon } = useQuery({
    queryKey: ['admin-entities', 'monster'],
    queryFn: () => api.adminListEntities('monster'),
  })

  const loading = loadingNpc || loadingMon
  const all = useMemo(() => {
    const q = query.trim().toLowerCase()
    return [...npcs, ...monsters]
      .filter((item) => {
        if (!q) return true
        return (
          item.name.toLowerCase().includes(q) ||
          (item.description ?? '').toLowerCase().includes(q) ||
          (item.creatureType ?? '').toLowerCase().includes(q)
        )
      })
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
  }, [monsters, npcs, query])
  const pageCount = Math.max(1, Math.ceil(all.length / PAGE_SIZE))
  const safePage = Math.min(page, pageCount)
  const pageItems = all.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE)

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="font-headline-lg text-2xl text-on-surface">Monstros & NPCs</h1>
          <p className="mt-2 max-w-3xl text-sm text-on-surface-variant">
            Cadastros do mestre. Rascunhos ficam só aqui até serem publicados; use Editar para completar a ficha.
          </p>
        </div>
        <Link to="/admin/characters/new" className="btn-primary text-xs">
          Criar monstros & NPCs
        </Link>
      </header>

      <div className="relative max-w-md">
        <span className="material-symbols-outlined pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-base text-on-surface-variant">
          search
        </span>
        <input
          className="input-feudal w-full pl-10"
          placeholder="Buscar cadastro…"
          value={query}
          onChange={(event) => {
            setQuery(event.target.value)
            setPage(1)
          }}
        />
      </div>

      {loading ? <p className="text-sm text-on-surface-variant">Carregando…</p> : null}
      <div className="grid content-start gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {pageItems.map((item) => (
          <CharacterCard key={item.id} item={item} />
        ))}
      </div>
      {!loading && all.length === 0 ? (
        <p className="text-sm text-on-surface-variant">Nenhum personagem cadastrado ainda.</p>
      ) : null}
      {!loading && all.length > 0 ? (
        <nav className="flex flex-wrap items-center justify-center gap-2 pt-2" aria-label="Paginação dos personagens">
          <button
            type="button"
            className="btn-secondary text-[10px]"
            disabled={safePage <= 1}
            onClick={() => setPage(Math.max(1, safePage - 1))}
          >
            Página anterior
          </button>
          {Array.from({ length: pageCount }, (_, i) => i + 1).map((n) => (
            <button
              key={n}
              type="button"
              className={`min-w-8 rounded border px-2 py-1 text-[10px] font-semibold ${
                n === safePage
                  ? 'border-secondary bg-secondary/25 text-secondary'
                  : 'border-secondary/40 text-secondary/80 hover:border-secondary'
              }`}
              onClick={() => setPage(n)}
            >
              {n}
            </button>
          ))}
          <button
            type="button"
            className="btn-secondary text-[10px]"
            disabled={safePage >= pageCount}
            onClick={() => setPage(Math.min(pageCount, safePage + 1))}
          >
            Próxima página
          </button>
        </nav>
      ) : null}
    </div>
  )
}
