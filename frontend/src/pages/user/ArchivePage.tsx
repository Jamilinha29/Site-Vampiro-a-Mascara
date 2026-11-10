import { useEffect, useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useSearchParams } from 'react-router-dom'
import { PlayerBestiaryExplorer } from '../../components/content/PlayerBestiaryExplorer'
import { ATTR_KEYS } from '../../lib/glossaryCatalog'
import { playerQueryKeys } from '../../lib/queryKeys'
import { api } from '../../services/api'
import type { AttributeMod, ChronicleEntity } from '../../types/chronicle'

const TABS = [
  { id: 'all', label: 'Todos os tomos' },
  { id: 'rituals', label: 'Grimórios taumatúrgicos' },
  { id: 'amulets', label: 'Amuletos' },
  { id: 'relics', label: 'Relíquias' },
  { id: 'others', label: 'Outros' },
  { id: 'bestiary', label: 'Bestiário documentado' },
] as const

type TabId = (typeof TABS)[number]['id']

const PAGE_SIZE = 6

const rarityClass: Record<string, string> = {
  ancestral: 'border-primary/60 bg-primary/15 text-primary',
  raro: 'border-secondary/50 bg-secondary/10 text-secondary',
  proibido: 'border-primary bg-primary/25 text-primary',
  incomum: 'border-outline-variant/50 text-on-surface-variant',
  comum: 'border-outline-variant/40 text-on-surface-variant',
}

const attrLabel = (id: string) => ATTR_KEYS.find((a) => a.id === id)?.label ?? id

function classificationSubtitle(item: ChronicleEntity) {
  if (item.classification === 'grimoire') {
    return item.magicType ? `${item.magicType}` : 'Grimório taumatúrgico'
  }
  if (item.classification === 'amulet') return item.relicAmuletType ?? 'Amuleto'
  if (item.classification === 'relic') return item.relicAmuletType ?? 'Relíquia'
  if (item.creatureType) return item.creatureType
  return item.archiveCategory ?? 'Tomo'
}

function tomeCode(item: ChronicleEntity, index: number) {
  const n = String(index + 1).padStart(3, '0')
  const kind =
    item.classification === 'grimoire'
      ? 'TAUMATURGIA'
      : item.classification === 'amulet'
        ? 'AMULETO'
        : item.classification === 'relic'
          ? 'RELÍQUIA'
          : 'TOMO'
  return `TOMO Nº ${n} — ${kind}`
}

export default function ArchivePage() {
  const [searchParams] = useSearchParams()
  const [tab, setTab] = useState<TabId>('rituals')
  const [query, setQuery] = useState('')
  const [rarity, setRarity] = useState('all')
  const [sort, setSort] = useState<'recent' | 'name' | 'rarity'>('recent')
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [page, setPage] = useState(1)

  useEffect(() => {
    const section = searchParams.get('section')
    if (section === 'bestiary') setTab('bestiary')
    else if (section === 'rituals' || section === 'relics' || section === 'amulets') setTab(section)
    else if (section === 'chronicles') setTab('others')
  }, [searchParams])

  const { data: chronicles = [] } = useQuery({
    queryKey: ['content-archive', 'chronicles'],
    queryFn: () => api.getArchiveContent('chronicles'),
    enabled: tab !== 'bestiary',
  })
  const { data: relics = [] } = useQuery({
    queryKey: ['content-archive', 'relics'],
    queryFn: () => api.getArchiveContent('relics'),
    enabled: tab !== 'bestiary',
  })
  const { data: rituals = [] } = useQuery({
    queryKey: ['content-archive', 'rituals'],
    queryFn: () => api.getArchiveContent('rituals'),
    enabled: tab !== 'bestiary',
  })
  const { data: bestiaryKnown = [] } = useQuery({
    queryKey: playerQueryKeys.bestiary('known'),
    queryFn: () => api.getBestiaryContent('known'),
  })
  const { data: profile } = useQuery({
    queryKey: playerQueryKeys.profile,
    queryFn: () => api.getMeProfile(),
  })

  const primary =
    profile?.characters.find((c) => c.isPrimary) ?? profile?.characters[0] ?? null

  const pools = useMemo(() => {
    const amulets = [...relics, ...chronicles].filter((i) => i.classification === 'amulet')
    const relicOnly = relics.filter((i) => !i.classification || i.classification === 'relic')
    const ritualOnly = rituals.filter((i) => !i.classification || i.classification === 'grimoire')
    const others = chronicles.filter((i) => i.classification !== 'amulet')
    const all = [...ritualOnly, ...amulets, ...relicOnly, ...others].filter(
      (item, idx, arr) => arr.findIndex((x) => x.id === item.id) === idx,
    )
    return { all, rituals: ritualOnly, amulets, relics: relicOnly, others }
  }, [chronicles, relics, rituals])

  const counts = {
    all: pools.all.length,
    rituals: pools.rituals.length,
    amulets: pools.amulets.length,
    relics: pools.relics.length,
    others: pools.others.length,
    bestiary: bestiaryKnown.length,
  }

  const items = useMemo(() => {
    if (tab === 'bestiary') return [] as ChronicleEntity[]
    const pool =
      tab === 'all'
        ? pools.all
        : tab === 'rituals'
          ? pools.rituals
          : tab === 'amulets'
            ? pools.amulets
            : tab === 'relics'
              ? pools.relics
              : pools.others

    const q = query.trim().toLowerCase()
    const rarityRank = { proibido: 0, ancestral: 1, raro: 2, incomum: 3, comum: 4 } as const
    let list = pool.filter((item) => {
      if (rarity !== 'all' && (item.rarity ?? 'comum') !== rarity) return false
      if (!q) return true
      return (
        item.name.toLowerCase().includes(q) ||
        item.description.toLowerCase().includes(q) ||
        (item.magicType ?? '').toLowerCase().includes(q) ||
        (item.relicAmuletType ?? '').toLowerCase().includes(q)
      )
    })
    list = [...list].sort((a, b) => {
      if (sort === 'name') return a.name.localeCompare(b.name)
      if (sort === 'rarity') {
        return rarityRank[a.rarity ?? 'comum'] - rarityRank[b.rarity ?? 'comum']
      }
      return b.updatedAt.localeCompare(a.updatedAt)
    })
    return list
  }, [tab, pools, query, rarity, sort])

  const pageCount = Math.max(1, Math.ceil(items.length / PAGE_SIZE))
  const safePage = Math.min(page, pageCount)
  const pageItems = items.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE)
  const selected = items.find((i) => i.id === selectedId) ?? pageItems[0] ?? null
  const selectedIndex = selected ? items.findIndex((i) => i.id === selected.id) : -1

  useEffect(() => {
    setPage(1)
    setSelectedId(null)
  }, [tab, query, rarity, sort])

  return (
    <div className="space-y-5">
      <header>
        <h1 className="font-headline-lg text-2xl text-on-surface">Glossário</h1>
        <p className="mt-2 max-w-3xl text-sm text-on-surface-variant">
          Relíquias, grimórios, amuletos e bestiário publicados pelo narrador — consulta em estilo de tomo feudal.
        </p>
      </header>

      <div className="grid grid-cols-1 gap-2 sm:grid-cols-[minmax(0,1fr)_minmax(9rem,auto)_minmax(9rem,auto)] sm:items-center">
        <div className="relative min-w-0">
          <span className="material-symbols-outlined pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-base text-on-surface-variant">
            search
          </span>
          <input
            className="input-feudal w-full pl-10"
            placeholder="Buscar tomo, relíquia, ritual…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
        <select className="input-feudal w-full pl-4 sm:w-auto" value={rarity} onChange={(e) => setRarity(e.target.value)}>
          <option value="all">Raridade: todas</option>
          <option value="ancestral">Raridade: Ancestral</option>
          <option value="raro">Raridade: Raro</option>
          <option value="incomum">Raridade: Incomum</option>
          <option value="comum">Raridade: Comum</option>
          <option value="proibido">Raridade: Proibido</option>
        </select>
        <select
          className="input-feudal w-full pl-4 sm:w-auto"
          value={sort}
          onChange={(e) => setSort(e.target.value as typeof sort)}
        >
          <option value="recent">Mais recentes</option>
          <option value="name">Nome A–Z</option>
          <option value="rarity">Por raridade</option>
        </select>
      </div>

      <div className="flex flex-wrap gap-2">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            className={`rounded px-3 py-1.5 text-[10px] font-semibold tracking-wider uppercase ${
              tab === t.id
                ? 'border border-secondary bg-secondary/15 text-secondary'
                : 'border border-outline-variant/40 text-on-surface-variant'
            }`}
            onClick={() => setTab(t.id)}
          >
            {t.label} ({counts[t.id]})
          </button>
        ))}
      </div>

      {tab === 'bestiary' ? (
        <PlayerBestiaryExplorer />
      ) : (
        <>
          <div className="grid gap-4 lg:grid-cols-12">
            <div className="grid gap-3 sm:grid-cols-2 lg:col-span-7">
              {pageItems.map((item) => {
                const active = selected?.id === item.id
                const rarityKey = item.rarity ?? 'comum'
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setSelectedId(item.id)}
                    className={`mesa-panel text-left p-4 transition ${
                      active ? 'border-primary/70 ring-1 ring-primary/40' : 'hover:border-outline-variant/60'
                    }`}
                  >
                    <div className="relative overflow-hidden rounded border border-outline-variant/30 bg-surface-container-high">
                      <div className="flex h-28 items-center justify-center">
                        {item.imageUrl ? (
                          <img src={item.imageUrl} alt="" className="h-full w-full object-cover" />
                        ) : (
                          <span className="material-symbols-outlined text-3xl text-outline-variant">auto_stories</span>
                        )}
                      </div>
                      <span
                        className={`absolute top-2 left-2 rounded border px-1.5 py-0.5 text-[9px] font-bold tracking-wide uppercase ${rarityClass[rarityKey]}`}
                      >
                        {rarityKey}
                      </span>
                    </div>
                    <p className="mt-3 font-serif text-base text-on-surface">{item.name}</p>
                    <p className="mt-1 text-[10px] font-semibold tracking-wider text-secondary uppercase">
                      {classificationSubtitle(item)}
                    </p>
                    <p className="mt-1 line-clamp-2 text-xs text-on-surface-variant">
                      {item.description || 'Sem descrição pública.'}
                    </p>
                    <div className="mt-3 flex flex-wrap items-center gap-3 text-[10px] text-on-surface-variant">
                      <span className="inline-flex items-center gap-1">
                        <span className="material-symbols-outlined text-sm">weight</span>
                        {item.weightKg != null ? `${item.weightKg} kg` : '—'}
                      </span>
                      {item.attributeMods?.slice(0, 2).map((m) => (
                        <span key={`${m.attr}-${m.value}`} className="text-secondary">
                          {m.value > 0 ? '+' : ''}
                          {m.value} {attrLabel(m.attr)}
                        </span>
                      ))}
                      {item.magicType ? (
                        <span className="text-secondary">Recarga: {item.cooldownText ?? '—'}</span>
                      ) : null}
                    </div>
                  </button>
                )
              })}
              {pageItems.length === 0 ? (
                <p className="text-sm text-on-surface-variant sm:col-span-2">
                  Nenhum registro publicado nesta categoria.
                </p>
              ) : null}
            </div>

            <aside className="mesa-panel flex flex-col space-y-4 p-5 lg:col-span-5">
              {selected ? (
                <>
                  <div className="flex items-start justify-between gap-3">
                    <p className="text-[10px] font-semibold tracking-wider text-secondary uppercase">
                      {tomeCode(selected, selectedIndex >= 0 ? selectedIndex : 0)}
                    </p>
                    <button
                      type="button"
                      className="text-on-surface-variant hover:text-on-surface"
                      aria-label="Fechar detalhe"
                      onClick={() => setSelectedId(null)}
                    >
                      <span className="material-symbols-outlined text-lg">close</span>
                    </button>
                  </div>

                  <div className="overflow-hidden rounded border border-outline-variant/40 bg-surface-container-high">
                    <div className="flex aspect-[4/3] items-center justify-center">
                      {selected.imageUrl ? (
                        <img src={selected.imageUrl} alt="" className="h-full w-full object-cover" />
                      ) : (
                        <span className="material-symbols-outlined text-5xl text-outline-variant">auto_stories</span>
                      )}
                    </div>
                  </div>

                  <h2 className="font-serif text-2xl text-on-surface">{selected.name}</h2>

                  <div className="grid grid-cols-3 gap-2 text-center">
                    <div className="rounded border border-outline-variant/30 bg-surface-container-lowest/40 p-2">
                      <p className="text-[9px] tracking-wider text-on-surface-variant uppercase">Requisito</p>
                      <p className="mt-1 text-xs text-on-surface">
                        {selected.magicType ?? selected.relicAmuletType ?? classificationSubtitle(selected)}
                      </p>
                    </div>
                    <div className="rounded border border-outline-variant/30 bg-surface-container-lowest/40 p-2">
                      <p className="text-[9px] tracking-wider text-on-surface-variant uppercase">Peso real</p>
                      <p className="mt-1 text-xs text-on-surface">
                        {selected.weightKg != null ? `${selected.weightKg} kg` : '—'}
                      </p>
                    </div>
                    <div className="rounded border border-outline-variant/30 bg-surface-container-lowest/40 p-2">
                      <p className="text-[9px] tracking-wider text-on-surface-variant uppercase">Custo / recarga</p>
                      <p className="mt-1 text-xs text-on-surface">
                        {selected.cooldownText ??
                          (selected.priceGold || selected.priceSilver
                            ? `${selected.priceGold ?? 0} ouro · ${selected.priceSilver ?? 0} prata`
                            : '—')}
                      </p>
                    </div>
                  </div>

                  {selected.attributeMods?.length ? (
                    <div>
                      <p className="text-[10px] font-semibold tracking-wider text-secondary uppercase">
                        Pré-requisitos de atributo
                      </p>
                      <ul className="mt-2 space-y-2">
                        {selected.attributeMods.map((m) => (
                          <AttrDots key={`${m.attr}-${m.value}`} mod={m} />
                        ))}
                      </ul>
                    </div>
                  ) : null}

                  <div className="rounded border border-outline-variant/30 bg-surface-container-lowest/40 p-3">
                    <p className="text-[10px] font-semibold tracking-wider text-secondary uppercase">
                      Mecânica de jogo
                    </p>
                    {selected.statsText ? (
                      <pre className="mt-2 whitespace-pre-wrap text-xs text-on-surface-variant">{selected.statsText}</pre>
                    ) : (
                      <p className="mt-2 text-xs text-on-surface-variant">
                        Efeitos táticos sincronizam com a mesa quando o narrador libera este tomo.
                      </p>
                    )}
                  </div>

                  <div>
                    <p className="text-[10px] font-semibold tracking-wider text-secondary uppercase">
                      Origem histórica
                    </p>
                    <p className="mt-2 text-sm leading-relaxed text-on-surface-variant">
                      {selected.description || 'Lore ainda não catalogado pelo narrador.'}
                    </p>
                  </div>

                  <div className="mt-auto flex flex-col gap-2 pt-2 sm:flex-row">
                    <button type="button" className="btn-primary flex-1 text-[10px]" disabled={!primary}>
                      Vincular à ficha{primary ? ` do ${primary.name}` : ''}
                    </button>
                    <button type="button" className="btn-secondary flex-1 text-[10px]" disabled>
                      Salvar no grimório
                    </button>
                  </div>
                </>
              ) : (
                <p className="text-sm text-on-surface-variant">Selecione um tomo à esquerda para inspecionar.</p>
              )}
            </aside>
          </div>

          {items.length > PAGE_SIZE ? (
            <nav className="flex flex-wrap items-center justify-center gap-2 pt-2" aria-label="Paginação do glossário">
              <button
                type="button"
                className="btn-secondary text-[10px]"
                disabled={safePage <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
              >
                Página anterior
              </button>
              {Array.from({ length: pageCount }, (_, i) => i + 1).map((n) => (
                <button
                  key={n}
                  type="button"
                  className={`min-w-8 rounded px-2 py-1 text-[10px] font-semibold ${
                    n === safePage
                      ? 'bg-secondary/20 text-secondary'
                      : 'border border-outline-variant/40 text-on-surface-variant'
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
                onClick={() => setPage((p) => Math.min(pageCount, p + 1))}
              >
                Próxima página
              </button>
            </nav>
          ) : null}
        </>
      )}
    </div>
  )
}

function AttrDots({ mod }: { mod: AttributeMod }) {
  const filled = Math.min(5, Math.max(0, Math.abs(mod.value)))
  return (
    <li className="flex items-center justify-between gap-3 text-xs">
      <span className="text-on-surface-variant">{attrLabel(mod.attr)}</span>
      <span className="flex items-center gap-2">
        <span className="flex gap-1" aria-hidden>
          {Array.from({ length: 5 }, (_, i) => (
            <span
              key={i}
              className={`h-2 w-2 rounded-full ${i < filled ? 'bg-secondary' : 'bg-outline-variant/40'}`}
            />
          ))}
        </span>
        <span className="min-w-[2rem] text-right text-secondary">
          {mod.value > 0 ? '+' : ''}
          {mod.value}
        </span>
      </span>
    </li>
  )
}
