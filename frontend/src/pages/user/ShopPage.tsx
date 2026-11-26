import { useEffect, useMemo, useRef, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { CurrencyVault } from '../../components/domain/CurrencyVault'
import { api } from '../../services/api'
import type { ChronicleEntity } from '../../types/chronicle'
import { playerQueryKeys } from '../../lib/queryKeys'
import { useToast } from '../../components/ui/ToastProvider'

const PAGE_SIZE = 6

const CATEGORIES = [
  { id: 'gear' as const, label: 'Equipamentos' },
  { id: 'consumables' as const, label: 'Consumíveis' },
  { id: 'services' as const, label: 'Serviços' },
]

const rarityLabel: Record<string, string> = {
  ancestral: 'Ancestral',
  raro: 'Raro',
  proibido: 'Proibido',
  incomum: 'Incomum',
  comum: 'Comum',
}

export default function ShopPage() {
  const [category, setCategory] = useState<(typeof CATEGORIES)[number]['id']>('gear')
  const [query, setQuery] = useState('')
  const [page, setPage] = useState(1)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const filtersReady = useRef(false)
  const qc = useQueryClient()
  const { push } = useToast()

  useEffect(() => {
    void api.getSavedFilters().then((saved) => {
      if (saved.shopCategory) setCategory(saved.shopCategory)
      if (typeof saved.shopQuery === 'string') setQuery(saved.shopQuery)
      filtersReady.current = true
    })
  }, [])

  useEffect(() => {
    if (!filtersReady.current) return
    const timer = window.setTimeout(() => {
      void api.saveFilters({ shopCategory: category, shopQuery: query })
    }, 400)
    return () => window.clearTimeout(timer)
  }, [category, query])

  const { data: items = [], isLoading } = useQuery({
    queryKey: ['content-shop', category],
    queryFn: () => api.getShopContent(category),
  })
  const { data: wallet } = useQuery({
    queryKey: ['wallet', 'active'],
    queryFn: () => api.getActiveWallet(),
  })
  const { data: profile } = useQuery({
    queryKey: playerQueryKeys.profile,
    queryFn: () => api.getMeProfile(),
  })

  const primary =
    profile?.characters.find((c) => c.isPrimary) ?? profile?.characters[0] ?? null

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return items
    return items.filter(
      (i) => i.name.toLowerCase().includes(q) || i.description.toLowerCase().includes(q),
    )
  }, [items, query])

  useEffect(() => {
    setPage(1)
  }, [category, query])

  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const safePage = Math.min(page, pageCount)
  const pageItems = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE)

  const selected = selectedId ? (filtered.find((i) => i.id === selectedId) ?? null) : null

  const { data: stock } = useQuery({
    queryKey: ['shop-stock', selected?.id],
    queryFn: () => api.getShopStock(selected!.id),
    enabled: !!selected,
  })

  const opRef = useRef<{ entityId: string; operationId: string } | null>(null)

  const buy = useMutation({
    mutationFn: () => {
      if (!opRef.current || opRef.current.entityId !== selected!.id) {
        opRef.current = { entityId: selected!.id, operationId: crypto.randomUUID() }
      }
      return api.buyShopItem({
        entityId: selected!.id,
        quantity: 1,
        operationId: opRef.current.operationId,
      })
    },
    onSuccess: (res) => {
      opRef.current = null
      push(`${res.itemName} entrou no inventário.`, 'success')
      void qc.invalidateQueries({ queryKey: playerQueryKeys.profile })
      void qc.invalidateQueries({ queryKey: ['shop-stock'] })
      void qc.invalidateQueries({ queryKey: ['wallet', 'active'] })
    },
    onError: (e: Error) => push(e.message, 'error'),
  })

  const costCopper = (selected?.priceGold ?? 0) * 100 + (selected?.priceSilver ?? 0) * 10 + (selected?.priceCopper ?? 0)
  const balanceCopper = (wallet?.gold ?? 0) * 100 + (wallet?.silver ?? 0) * 10 + (wallet?.copper ?? 0)
  const costSilver = Math.ceil(costCopper / 10)
  const remaining = Math.floor((balanceCopper - costCopper) / 10)
  const soldOut =
    (stock?.remaining != null && stock.remaining <= 0) ||
    (selected != null &&
      stock?.remaining == null &&
      selected.stockTotal != null &&
      selected.stockTotal <= 0)

  return (
    <div className="space-y-4">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="font-headline-lg text-2xl text-on-surface">Loja da sessão</h1>
          <p className="mt-1 max-w-3xl text-sm text-on-surface-variant">
            Vitrine feudal publicada pelo mestre. A compra entra no inventário do personagem ativo.
          </p>
        </div>
        <CurrencyVault variant="header" />
      </header>

      <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
        <div className="relative min-w-0">
          <span className="material-symbols-outlined pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-base text-on-surface-variant">
            search
          </span>
          <input
            className="input-feudal w-full pl-10"
            placeholder="Buscar item…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
        <div className="flex flex-wrap gap-2">
          {CATEGORIES.map((c) => (
            <button
              key={c.id}
              type="button"
              className={`rounded px-3.5 py-1.5 text-xs font-semibold tracking-wider uppercase ${
                category === c.id ? 'bg-primary-container text-white' : 'border border-outline-variant/40 text-on-surface-variant hover:border-secondary/50'
              }`}
              onClick={() => {
                setCategory(c.id)
                setSelectedId(null)
              }}
            >
              {c.label}
            </button>
          ))}
        </div>
      </div>

      {isLoading ? <p className="text-sm text-on-surface-variant">Carregando vitrine…</p> : null}

      <div className={`grid items-start gap-4 ${selected ? 'lg:grid-cols-12' : ''}`}>
        <div className={`grid auto-rows-fr gap-3.5 sm:grid-cols-2 ${selected ? 'lg:col-span-7' : 'lg:grid-cols-3'}`}>
          {pageItems.map((item) => (
            <ShopCard
              key={item.id}
              item={item}
              active={selected?.id === item.id}
              onOpen={() => setSelectedId(item.id)}
            />
          ))}
          {!isLoading && filtered.length === 0 ? (
            <p className="text-sm text-on-surface-variant sm:col-span-2">Nenhum item publicado nesta vitrine.</p>
          ) : null}
        </div>

        {selected ? (
          <aside className="self-start lg:col-span-5">
            <PurchasePanel
              item={selected}
              category={category}
              primaryName={primary ? `${primary.name}${primary.clan ? ` [${primary.clan}]` : ''}` : null}
              walletGold={wallet?.gold ?? 0}
              walletSilver={wallet?.silver ?? 0}
              costSilver={costSilver}
              remaining={remaining}
              stockRemaining={stock?.remaining}
              owned={stock?.ownedByYou ?? 0}
              soldOut={soldOut}
              pending={buy.isPending}
              canBuy={!!primary && remaining >= 0 && !soldOut && !buy.isPending}
              onBuy={() => buy.mutate()}
              onClose={() => setSelectedId(null)}
            />
          </aside>
        ) : null}
      </div>

      {filtered.length > 0 ? (
        <nav className="flex flex-wrap items-center justify-center gap-2 pt-2" aria-label="Paginação da loja">
          <button
            type="button"
            className="btn-secondary text-xs"
            disabled={safePage <= 1}
            onClick={() => setPage(Math.max(1, safePage - 1))}
          >
            Página anterior
          </button>
          {visiblePageNumbers(safePage, pageCount).map((n) => (
            <button
              key={n}
              type="button"
              className={`min-w-8 rounded border px-2 py-1 text-xs font-semibold ${
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
            className="btn-secondary text-xs"
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

function visiblePageNumbers(page: number, pageCount: number) {
  if (pageCount <= 3) return Array.from({ length: pageCount }, (_, i) => i + 1)
  const steps = page <= 3 ? 0 : Math.ceil((page - 3) / 2)
  let start = 1 + steps * 2
  let end = Math.min(pageCount, start + 2)
  if (end - start < 2) start = Math.max(1, end - 2)
  return Array.from({ length: end - start + 1 }, (_, i) => start + i)
}

function ShopCard({
  item,
  active,
  onOpen,
}: {
  item: ChronicleEntity
  active: boolean
  onOpen: () => void
}) {
  const rarity = rarityLabel[item.rarity ?? 'comum'] ?? 'Comum'
  const available = item.stockTotal == null || item.stockTotal > 0
  return (
    <article
      className={`flex h-full flex-col overflow-hidden rounded-xl border bg-[#141414] transition ${
        active ? 'border-secondary/70' : 'border-white/10 hover:border-white/25'
      }`}
    >
      <div className="relative aspect-[16/9] max-h-40 w-full shrink-0 overflow-hidden bg-black">
        {item.imageUrl ? (
          <img src={item.imageUrl} alt="" className="h-full w-full object-cover" />
        ) : (
          <div className="flex h-full items-center justify-center bg-[radial-gradient(circle_at_center,#2a1014,#090909)]">
            <span className="material-symbols-outlined text-3xl text-white/25">swords</span>
          </div>
        )}
        <span className="absolute top-2.5 left-2.5 rounded border border-white/20 bg-black/60 px-1.5 py-0.5 text-[10px] font-bold tracking-wide text-white/85 uppercase">
          {rarity}
        </span>
      </div>
      <div className="flex flex-1 flex-col px-4 pt-3.5 pb-3.5">
        <h2 className="font-serif text-base font-semibold text-white">{item.name}</h2>
        <p className="mt-1 flex items-center gap-1 text-xs text-[#d6b25e]">
          <span className="material-symbols-outlined text-sm">payments</span>
          {priceShort(item)}
        </p>
        <p className="mt-2 line-clamp-2 text-xs leading-relaxed text-white/60">
          {item.description || 'Sem descrição pública.'}
        </p>
        <div className="mt-auto flex items-center justify-between gap-2 pt-3">
          <span className={`text-xs uppercase ${available ? 'text-emerald-400' : 'text-primary'}`}>
            {available ? 'Disponível' : 'Esgotado'}
          </span>
          <button
            type="button"
            className="inline-flex items-center gap-1 text-xs font-medium text-white/80 hover:text-secondary"
            onClick={onOpen}
          >
            <span className="material-symbols-outlined text-base">visibility</span>
            Ver detalhes
          </button>
        </div>
      </div>
    </article>
  )
}

function PurchasePanel({
  item,
  category,
  primaryName,
  walletGold,
  walletSilver,
  costSilver,
  remaining,
  stockRemaining,
  owned,
  soldOut,
  pending,
  canBuy,
  onBuy,
  onClose,
}: {
  item: ChronicleEntity
  category: (typeof CATEGORIES)[number]['id']
  primaryName: string | null
  walletGold: number
  walletSilver: number
  costSilver: number
  remaining: number
  stockRemaining: number | null | undefined
  owned: number
  soldOut: boolean
  pending: boolean
  canBuy: boolean
  onBuy: () => void
  onClose: () => void
}) {
  const rarity = rarityLabel[item.rarity ?? 'comum'] ?? 'Comum'
  const kind = categoryLabel(item.shopCategory ?? category)
  const type = item.equipmentType || item.serviceType || item.relicAmuletType || kind
  const requirement = item.attributeMods?.map((m) => `${m.attr} ${m.value}`).join(', ') || null
  const shownStock = stockRemaining ?? item.stockTotal

  return (
    <div className="overflow-hidden rounded-2xl border border-white/10 bg-[#121212] text-white">
      <div className="flex items-center justify-between gap-3 border-b border-white/10 px-4 py-2">
        <p className="text-xs font-semibold tracking-wider text-secondary uppercase">
          {kind} · {type}
        </p>
        <button
          type="button"
          className="flex h-8 w-8 items-center justify-center rounded-full text-white/70 hover:bg-white/10 hover:text-white"
          aria-label="Fechar detalhes"
          onClick={onClose}
        >
          <span className="material-symbols-outlined text-lg">close</span>
        </button>
      </div>
      <div className="relative">
        <div className="flex h-48 items-center justify-center bg-black">
          {item.imageUrl ? (
            <img src={item.imageUrl} alt="" className="h-full w-full object-cover" />
          ) : (
            <span className="material-symbols-outlined text-5xl text-white/25">swords</span>
          )}
        </div>
        <span className="absolute top-3 right-3 rounded border border-white/20 bg-black/60 px-2 py-0.5 text-xs font-bold tracking-wide text-white uppercase">
          {rarity}
        </span>
      </div>
      <div className="space-y-4 px-4 py-4">
        <div>
          <h2 className="font-serif text-2xl">{item.name}</h2>
          <p className="mt-1 text-sm text-white/60 italic">
            {item.description || 'O narrador ainda não descreveu este item.'}
          </p>
        </div>

        <div className="grid grid-cols-3 gap-2 text-center">
          <DetailStat icon="payments" label="Preço" value={priceLong(item)} />
          <DetailStat icon="weight" label="Peso" value={item.weightKg != null ? `${item.weightKg} kg` : '—'} />
          <DetailStat
            icon="inventory_2"
            label="Estoque"
            value={shownStock == null ? 'Ilimitado' : String(shownStock)}
          />
        </div>

        <div className="rounded-lg border border-white/10 bg-black/30 p-3 text-xs text-white/70">
          <p className="text-xs font-semibold tracking-wider text-secondary uppercase">Compra</p>
          <p className="mt-2">
            Entra no personagem sentado na mesa aberta
            {primaryName ? ` (${primaryName} é o ativo nesta conta)` : ''}.
          </p>
          <p className="mt-1">
            Saldo: {walletSilver} prata · {walletGold} ouro
          </p>
          <p className="mt-1">
            Débito: −{costSilver} prata · Previsto:{' '}
            <span className={remaining >= 0 ? 'text-emerald-300' : 'text-primary'}>{remaining} prata</span>
          </p>
          <p className="mt-1">Já possui: {owned}</p>
          {requirement ? <p className="mt-1">Requisito: {requirement}</p> : null}
        </div>

        <button type="button" className="btn-primary w-full text-xs" disabled={!canBuy} onClick={onBuy}>
          <span className="material-symbols-outlined text-sm">shopping_cart</span>
          {pending ? 'Comprando…' : soldOut ? 'Esgotado' : 'Confirmar compra'}
        </button>
        {!canBuy && !pending ? (
          <p className="text-xs text-primary">Compra bloqueada. Confira o saldo, o estoque e se há uma mesa aberta com você sentado.</p>
        ) : null}
      </div>
    </div>
  )
}

function DetailStat({ icon, label, value }: { icon: string; label: string; value: string }) {
  return (
    <div className="rounded-lg border border-white/10 bg-black/25 px-2 py-2">
      <span className="material-symbols-outlined text-base text-secondary">{icon}</span>
      <p className="mt-1 text-xs tracking-wider text-white/45 uppercase">{label}</p>
      <p className="mt-0.5 text-[11px] text-white/90">{value}</p>
    </div>
  )
}

function priceShort(item: ChronicleEntity) {
  if ((item.priceGold ?? 0) > 0) return `${item.priceGold} PO`
  if ((item.priceSilver ?? 0) > 0) return `${item.priceSilver} prata`
  if ((item.priceCopper ?? 0) > 0) return `${item.priceCopper} bronze`
  return 'A combinar'
}

function priceLong(item: ChronicleEntity) {
  if ((item.priceGold ?? 0) > 0) {
    const extra = (item.priceSilver ?? 0) > 0 ? ` · ${item.priceSilver} prata` : ''
    return `${item.priceGold} moedas de ouro${extra}`
  }
  if ((item.priceSilver ?? 0) > 0) return `${item.priceSilver} moedas de prata`
  if ((item.priceCopper ?? 0) > 0) return `${item.priceCopper} moedas de bronze`
  return 'Preço a combinar'
}

function categoryLabel(cat?: string) {
  if (cat === 'consumables') return 'Consumível'
  if (cat === 'services') return 'Serviço'
  return 'Equipamento'
}
