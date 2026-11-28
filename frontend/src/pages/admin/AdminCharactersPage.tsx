import { useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { CreatureCombatSheetModal } from '../../components/admin/CreatureCombatSheetModal'
import { StatBar } from '../../components/domain/StatBar'
import { THREAT_LEVELS } from '../../lib/glossaryCatalog'
import { invalidatePlayerPublishedContent } from '../../lib/queryKeys'
import { api } from '../../services/api'
import type { ChronicleEntity } from '../../types/chronicle'
import { useToast } from '../../components/ui/useToast'

const PAGE_SIZE = 6

type FilterId = 'all' | 'alive' | 'dead' | 'npc' | 'monster'

function resolveClassification(item: ChronicleEntity) {
  if (item.threatLevel) {
    return THREAT_LEVELS.find((t) => t.id === item.threatLevel)?.label ?? item.threatLevel
  }
  if (item.rarity) {
    return item.rarity.charAt(0).toUpperCase() + item.rarity.slice(1)
  }
  return 'Comum'
}

function resolveAbilities(item: ChronicleEntity): string[] {
  if (item.abilities?.length) return item.abilities
  const derived: string[] = []
  if (item.primaryAttackName?.trim()) derived.push(item.primaryAttackName.trim())
  if (item.secondaryAttackName?.trim()) derived.push(item.secondaryAttackName.trim())
  if (item.passiveTraits?.length) derived.push(...item.passiveTraits)
  return derived
}

function resolveDefense(item: ChronicleEntity): number {
  if (typeof item.defense === 'number') return item.defense
  const defMod = item.attributeMods?.find((m) => m.attr === 'defesa')
  if (defMod) return Math.max(0, defMod.value)
  const noteNum = item.defenseNote?.match(/\d+/)
  if (noteNum) return Number(noteNum[0])
  return 0
}

function CharacterCard({
  item,
  inActiveSession,
  busy,
  onToggleLife,
  onPublish,
  onOpenSheet,
}: {
  item: ChronicleEntity
  inActiveSession: boolean
  busy: boolean
  onToggleLife: () => void
  onPublish: () => void
  onOpenSheet: () => void
}) {
  const isDead = item.lifeStatus === 'dead'
  const draft = item.visibility !== 'published'
  const hp = item.hpMax ?? 0
  const mana = item.manaMax ?? 0
  const defense = resolveDefense(item)
  const classification = resolveClassification(item)

  return (
    <article
      className={`mesa-panel flex h-full flex-col justify-between p-4 transition ${
        isDead ? 'border-primary/40 opacity-85' : inActiveSession ? 'border-secondary/55 ring-1 ring-secondary/20' : ''
      }`}
    >
      <div className="flex gap-3">
        <div className="flex h-20 w-16 shrink-0 items-center justify-center overflow-hidden rounded border border-outline-variant/50 bg-surface-container-high">
          {item.imageUrl ? (
            <img src={item.imageUrl} alt={item.name} className={`h-full w-full object-cover ${isDead ? 'grayscale' : ''}`} />
          ) : (
            <span className="material-symbols-outlined text-2xl text-outline">
              {item.kind === 'npc' ? 'person' : 'pest_control'}
            </span>
          )}
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-start justify-between gap-1.5">
            <p className="font-serif text-lg uppercase tracking-wide text-on-surface">{item.name}</p>
            <span
              className={`shrink-0 rounded-full border px-2 py-0.5 text-[9px] font-semibold uppercase ${
                isDead
                  ? 'border-primary/50 bg-primary/15 text-primary'
                  : inActiveSession
                    ? 'border-secondary/50 bg-secondary/15 text-secondary'
                    : 'border-emerald-500/40 bg-emerald-500/10 text-emerald-300'
              }`}
            >
              {isDead ? 'Morto' : inActiveSession ? 'Vivo · em sessão' : 'Vivo · aguardando sessão'}
            </span>
          </div>

          <p className="mt-0.5 text-xs text-on-surface-variant">
            {item.kind === 'npc' ? 'NPC' : 'Monstro'}
            {item.creatureType ? ` · ${item.creatureType}` : ''}
          </p>

          <p className="mt-1 text-[10px] font-semibold tracking-wider text-secondary uppercase">
            Classificação: {classification} · {draft ? 'Rascunho' : 'Publicado'}
          </p>

          {item.location ? (
            <p className="mt-0.5 truncate text-[11px] text-on-surface-variant">Local: {item.location}</p>
          ) : null}
        </div>
      </div>

      <div className="mt-3 space-y-2">
        <StatBar label="HP" current={isDead ? 0 : hp} max={Math.max(hp, 1)} variant="health" />
        <StatBar label="Mana" current={mana} max={Math.max(mana, 1)} variant="mana" />
        <StatBar label="Defesa" current={defense} max={Math.max(defense, 20)} variant="defense" />
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <button type="button" className="btn-secondary text-[10px]" disabled={busy} onClick={onToggleLife}>
          {isDead ? 'Marcar vivo' : 'Marcar morto'}
        </button>
        {draft ? (
          <button type="button" className="btn-secondary text-[10px]" disabled={busy} onClick={onPublish}>
            Publicar
          </button>
        ) : null}
        <button type="button" className="btn-secondary text-[10px]" onClick={onOpenSheet}>
          Ficha de dados
        </button>
        <Link to={`/admin/characters/new?kind=${item.kind}&id=${item.id}`} className="btn-primary ml-auto text-[10px]">
          Editar
        </Link>
      </div>
    </article>
  )
}

export default function AdminCharactersPage() {
  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState<FilterId>('all')
  const [page, setPage] = useState(1)
  const [inspectEntity, setInspectEntity] = useState<ChronicleEntity | null>(null)
  const qc = useQueryClient()
  const { push } = useToast()

  const { data: npcs = [], isLoading: loadingNpc } = useQuery({
    queryKey: ['admin-entities', 'npc'],
    queryFn: () => api.adminListEntities('npc'),
  })
  const { data: monsters = [], isLoading: loadingMon } = useQuery({
    queryKey: ['admin-entities', 'monster'],
    queryFn: () => api.adminListEntities('monster'),
  })
  const { data: handouts = [] } = useQuery({
    queryKey: ['admin-handouts'],
    queryFn: () => api.adminListHandouts(),
  })

  const activeSessionEntityIds = useMemo(() => {
    const ids = new Set<string>()
    for (const h of handouts) {
      if (h.status === 'closed') continue
      for (const n of h.sceneNpcs ?? []) ids.add(n.entityId)
      for (const t of h.sceneThreats ?? []) ids.add(t.entityId)
    }
    return ids
  }, [handouts])

  const toggleLife = useMutation({
    mutationFn: ({ id, lifeStatus }: { id: string; lifeStatus: 'alive' | 'dead' }) =>
      api.adminUpdateEntity(id, { lifeStatus }),
    onSuccess: (saved) => {
      void qc.invalidateQueries({ queryKey: ['admin-entities', saved.kind] })
      invalidatePlayerPublishedContent(qc)
      push(saved.lifeStatus === 'dead' ? `${saved.name} marcado como morto.` : `${saved.name} marcado como vivo.`, 'info')
    },
    onError: (err: Error) => push(err.message || 'Falha ao atualizar estado.', 'error'),
  })

  const publish = useMutation({
    mutationFn: (id: string) => api.adminPublishEntity(id),
    onSuccess: (saved) => {
      void qc.invalidateQueries({ queryKey: ['admin-entities', saved.kind] })
      invalidatePlayerPublishedContent(qc)
      push(`${saved.name} publicado.`, 'success')
    },
    onError: (err: Error) => push(err.message || 'Falha ao publicar.', 'error'),
  })

  const loading = loadingNpc || loadingMon
  const combined = useMemo(
    () => [...npcs, ...monsters].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)),
    [monsters, npcs],
  )

  const counts = useMemo(
    () => ({
      all: combined.length,
      alive: combined.filter((i) => i.lifeStatus !== 'dead').length,
      dead: combined.filter((i) => i.lifeStatus === 'dead').length,
      npc: npcs.length,
      monster: monsters.length,
    }),
    [combined, npcs.length, monsters.length],
  )

  const all = useMemo(() => {
    const q = query.trim().toLowerCase()
    return combined.filter((item) => {
      if (filter === 'alive' && item.lifeStatus === 'dead') return false
      if (filter === 'dead' && item.lifeStatus !== 'dead') return false
      if (filter === 'npc' && item.kind !== 'npc') return false
      if (filter === 'monster' && item.kind !== 'monster') return false
      if (!q) return true
      return (
        item.name.toLowerCase().includes(q) ||
        (item.description ?? '').toLowerCase().includes(q) ||
        (item.creatureType ?? '').toLowerCase().includes(q) ||
        resolveAbilities(item).some((a) => a.toLowerCase().includes(q))
      )
    })
  }, [combined, filter, query])

  const filters: { id: FilterId; label: string; count: number }[] = [
    { id: 'all', label: 'Todos', count: counts.all },
    { id: 'alive', label: 'Vivos', count: counts.alive },
    { id: 'dead', label: 'Mortos', count: counts.dead },
    { id: 'npc', label: 'NPCs', count: counts.npc },
    { id: 'monster', label: 'Monstros', count: counts.monster },
  ]

  const pageCount = Math.max(1, Math.ceil(all.length / PAGE_SIZE))
  const safePage = Math.min(page, pageCount)
  const pageItems = all.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE)

  return (
    <div className="space-y-4">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="font-headline-lg text-2xl tracking-wide text-on-surface uppercase">
            Monstros &amp; NPCs · {counts.all}
          </h1>
          <p className="mt-1 max-w-3xl text-sm text-on-surface-variant">
            Cadastros do mestre com vida, mana, defesa, classificação, estado na crônica e ficha flutuante de dados.
          </p>
        </div>
        <Link to="/admin/characters/new" className="btn-primary text-xs">
          Criar monstros &amp; NPCs
        </Link>
      </header>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-2">
          {filters.map((f) => (
            <button
              key={f.id}
              type="button"
              className={`rounded px-3 py-1.5 text-xs font-semibold tracking-wider uppercase ${
                filter === f.id
                  ? 'border border-secondary bg-secondary/15 text-secondary'
                  : 'border border-outline-variant/40 text-on-surface-variant'
              }`}
              onClick={() => {
                setFilter(f.id)
                setPage(1)
              }}
            >
              {f.label} · {f.count}
            </button>
          ))}
        </div>

        <div className="relative w-full max-w-xs">
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
      </div>

      {loading ? <p className="text-sm text-on-surface-variant">Carregando…</p> : null}
      <div className="grid auto-rows-fr gap-3.5 sm:grid-cols-2 lg:grid-cols-3">
        {pageItems.map((item) => (
          <CharacterCard
            key={item.id}
            item={item}
            inActiveSession={activeSessionEntityIds.has(item.id)}
            busy={toggleLife.isPending || publish.isPending}
            onToggleLife={() =>
              toggleLife.mutate({ id: item.id, lifeStatus: item.lifeStatus === 'dead' ? 'alive' : 'dead' })
            }
            onPublish={() => publish.mutate(item.id)}
            onOpenSheet={() => setInspectEntity(item)}
          />
        ))}
      </div>
      <CreatureCombatSheetModal entity={inspectEntity} onClose={() => setInspectEntity(null)} />
      {!loading && all.length === 0 ? (
        <p className="text-sm text-on-surface-variant">Nenhum personagem cadastrado neste filtro.</p>
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
