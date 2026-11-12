import { useEffect, useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useSearchParams } from 'react-router-dom'
import { PlayerBestiaryExplorer } from '../../components/content/PlayerBestiaryExplorer'
import { ATTR_KEYS } from '../../lib/glossaryCatalog'
import { playerQueryKeys } from '../../lib/queryKeys'
import { api } from '../../services/api'
import type { ChronicleEntity } from '../../types/chronicle'

const TABS = [
  { id: 'all', label: 'Todos os tomos' },
  { id: 'rituals', label: 'Grimório' },
  { id: 'charms', label: 'Amuletos e relíquias' },
  { id: 'bestiary', label: 'Bestiário' },
  { id: 'others', label: 'Outros' },
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
    else if (section === 'rituals') setTab('rituals')
    else if (section === 'relics' || section === 'amulets' || section === 'charms') setTab('charms')
    else if (section === 'chronicles' || section === 'others') setTab('others')
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
    const charms = [...amulets, ...relicOnly].filter(
      (item, idx, arr) => arr.findIndex((x) => x.id === item.id) === idx,
    )
    const others = chronicles.filter((i) => i.classification !== 'amulet')
    const all = [...ritualOnly, ...charms, ...others].filter(
      (item, idx, arr) => arr.findIndex((x) => x.id === item.id) === idx,
    )
    return { all, rituals: ritualOnly, charms, others }
  }, [chronicles, relics, rituals])

  const counts = {
    all: pools.all.length,
    rituals: pools.rituals.length,
    charms: pools.charms.length,
    bestiary: bestiaryKnown.length,
    others: pools.others.length,
  }

  const items = useMemo(() => {
    if (tab === 'bestiary') return [] as ChronicleEntity[]
    const pool =
      tab === 'all'
        ? pools.all
        : tab === 'rituals'
          ? pools.rituals
          : tab === 'charms'
            ? pools.charms
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
  const selected = selectedId ? (items.find((i) => i.id === selectedId) ?? null) : null
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
            className={`min-h-9 rounded-md border px-4 py-2 text-[11px] font-semibold tracking-wider uppercase ${
              tab === t.id
                ? 'border-secondary bg-secondary text-surface-container-lowest'
                : 'border-secondary/70 bg-transparent text-secondary hover:bg-secondary/10'
            }`}
            onClick={() => setTab(t.id)}
          >
            {t.label} ({counts[t.id]})
          </button>
        ))}
      </div>

      {tab === 'bestiary' ? (
        <PlayerBestiaryExplorer query={query} />
      ) : (
        <>
          <div className={`grid items-start gap-4 ${selected ? 'lg:grid-cols-12' : ''}`}>
            <div className={`grid content-start gap-3 sm:grid-cols-2 ${selected ? 'lg:col-span-7' : 'xl:grid-cols-3'}`}>
              {pageItems.map((item) => {
                const active = selected?.id === item.id
                const rarityKey = item.rarity ?? 'comum'
                return (
                  <article
                    key={item.id}
                    className={`flex flex-col overflow-hidden rounded-2xl border bg-[#141414] ${
                      active ? 'border-secondary/70' : 'border-white/10'
                    }`}
                  >
                    <div className="relative h-36 bg-black">
                      {item.imageUrl ? (
                        <img src={item.imageUrl} alt="" className="h-full w-full object-cover" />
                      ) : (
                        <div className="flex h-full items-center justify-center bg-[radial-gradient(circle_at_center,#2a1810,#090909)]">
                          <span className="material-symbols-outlined text-4xl text-white/25">auto_stories</span>
                        </div>
                      )}
                      <span
                        className={`absolute top-2 left-2 rounded border px-1.5 py-0.5 text-[9px] font-bold tracking-wide uppercase ${rarityClass[rarityKey]}`}
                      >
                        {rarityKey}
                      </span>
                    </div>
                    <div className="flex flex-1 flex-col px-4 pt-3 pb-3">
                      <h2 className="font-serif text-lg text-white">{item.name}</h2>
                      <p className="mt-1 flex items-center gap-1 text-[11px] text-secondary">
                        <span className="material-symbols-outlined text-sm">auto_awesome</span>
                        {classificationSubtitle(item)}
                      </p>
                      <p className="mt-2 line-clamp-2 text-xs text-white/55">
                        {item.description || 'Sem descrição pública.'}
                      </p>
                      <button
                        type="button"
                        className="mt-3 ml-auto inline-flex items-center gap-1 text-xs text-white/80 hover:text-white"
                        onClick={() => setSelectedId(item.id)}
                      >
                        <span className="material-symbols-outlined text-base">visibility</span>
                        Ver detalhes
                      </button>
                    </div>
                  </article>
                )
              })}
              {pageItems.length === 0 ? (
                <p className="text-sm text-on-surface-variant sm:col-span-2">
                  Nenhum registro publicado nesta categoria.
                </p>
              ) : null}
            </div>

            {selected ? (
              <aside className="self-start overflow-hidden rounded-2xl border border-white/10 bg-[#121212] text-white lg:col-span-5">
                <div className="flex items-center justify-between gap-3 border-b border-white/10 px-4 py-2">
                  <p className="text-[10px] font-semibold tracking-wider text-secondary uppercase">
                    {tomeCode(selected, selectedIndex >= 0 ? selectedIndex : 0)}
                  </p>
                  <button
                    type="button"
                    className="flex h-8 w-8 items-center justify-center rounded-full text-white/70 hover:bg-white/10 hover:text-white"
                    aria-label="Fechar detalhe"
                    onClick={() => setSelectedId(null)}
                  >
                    <span className="material-symbols-outlined text-lg">close</span>
                  </button>
                </div>
                <div className="relative">
                  <div className="flex h-48 items-center justify-center bg-black">
                    {selected.imageUrl ? (
                      <img src={selected.imageUrl} alt="" className="h-full w-full object-cover" />
                    ) : (
                      <span className="material-symbols-outlined text-5xl text-white/25">auto_stories</span>
                    )}
                  </div>
                  <span
                    className={`absolute top-3 right-3 rounded border px-2 py-0.5 text-[10px] font-bold tracking-wide uppercase ${rarityClass[selected.rarity ?? 'comum']}`}
                  >
                    {selected.rarity ?? 'comum'}
                  </span>
                </div>
                <div className="space-y-4 px-4 py-4">
                  <div>
                    <h2 className="font-serif text-2xl">{selected.name}</h2>
                    <p className="mt-1 text-sm text-white/60 italic">
                      {selected.description || 'Lore ainda não catalogado pelo narrador.'}
                    </p>
                  </div>

                  <div className="grid grid-cols-3 gap-2 text-center">
                    <DetailStat
                      icon="military_tech"
                      label="Requisito"
                      value={
                        selected.attributeMods?.length
                          ? selected.attributeMods
                              .map((m) => `${attrLabel(m.attr)} ${m.value > 0 ? '+' : ''}${m.value}`)
                              .join(', ')
                          : (selected.magicType ?? selected.relicAmuletType ?? '—')
                      }
                    />
                    <DetailStat
                      icon="weight"
                      label="Peso real"
                      value={selected.weightKg != null ? `${selected.weightKg} kg` : '—'}
                    />
                    <DetailStat
                      icon="hourglass_empty"
                      label="Custo / recarga"
                      value={
                        selected.cooldownText ??
                        (selected.priceGold || selected.priceSilver
                          ? `${selected.priceGold ?? 0} ouro · ${selected.priceSilver ?? 0} prata`
                          : '—')
                      }
                    />
                  </div>

                  <div className="rounded-lg border border-white/10 bg-black/30 p-3">
                    <p className="text-[10px] font-semibold tracking-wider text-secondary uppercase">
                      Mecânica de jogo
                    </p>
                    <p className="mt-2 text-sm leading-relaxed text-white/70">
                      {selected.statsText?.trim() ||
                        'Efeitos táticos sincronizam com a mesa quando o narrador libera este tomo.'}
                    </p>
                  </div>

                  <div className="flex flex-col gap-2 sm:flex-row">
                    <button type="button" className="btn-primary flex-1 text-[10px]" disabled={!primary}>
                      <span className="material-symbols-outlined text-sm">menu_book</span>
                      Vincular à ficha
                    </button>
                    <button type="button" className="btn-secondary flex-1 text-[10px]" disabled>
                      <span className="material-symbols-outlined text-sm">bookmark</span>
                      Salvar no grimório
                    </button>
                  </div>
                </div>
              </aside>
            ) : null}
          </div>

          {items.length > 0 ? (
            <GlossaryPager page={safePage} pageCount={pageCount} onPage={setPage} />
          ) : null}
        </>
      )}
    </div>
  )
}

function GlossaryPager({
  page,
  pageCount,
  onPage,
}: {
  page: number
  pageCount: number
  onPage: (page: number) => void
}) {
  return (
    <nav className="flex flex-wrap items-center justify-center gap-2 pt-2" aria-label="Paginação do glossário">
      <button
        type="button"
        className="btn-secondary text-[10px]"
        disabled={page <= 1}
        onClick={() => onPage(Math.max(1, page - 1))}
      >
        Página anterior
      </button>
      {Array.from({ length: pageCount }, (_, i) => i + 1).map((n) => (
        <button
          key={n}
          type="button"
          className={`min-w-8 rounded border px-2 py-1 text-[10px] font-semibold ${
            n === page
              ? 'border-secondary bg-secondary/25 text-secondary'
              : 'border-secondary/40 text-secondary/80 hover:border-secondary'
          }`}
          onClick={() => onPage(n)}
        >
          {n}
        </button>
      ))}
      <button
        type="button"
        className="btn-secondary text-[10px]"
        disabled={page >= pageCount}
        onClick={() => onPage(Math.min(pageCount, page + 1))}
      >
        Próxima página
      </button>
    </nav>
  )
}

function DetailStat({ icon, label, value }: { icon: string; label: string; value: string }) {
  return (
    <div className="rounded-lg border border-white/10 bg-black/25 px-2 py-2">
      <span className="material-symbols-outlined text-base text-secondary">{icon}</span>
      <p className="mt-1 text-[9px] tracking-wider text-white/45 uppercase">{label}</p>
      <p className="mt-0.5 text-[11px] text-white/90">{value}</p>
    </div>
  )
}
