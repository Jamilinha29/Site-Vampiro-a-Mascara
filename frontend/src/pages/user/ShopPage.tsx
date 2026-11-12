import { useEffect, useMemo, useState } from 'react'
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
  const qc = useQueryClient()
  const { push } = useToast()

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

  const buy = useMutation({
    mutationFn: () =>
      api.buyShopItem({
        entityId: selected!.id,
        characterId: primary?.id,
        quantity: 1,
      }),
    onSuccess: (res) => {
      push(`${res.itemName} entrou no inventário.`, 'success')
      void qc.invalidateQueries({ queryKey: playerQueryKeys.profile })
      void qc.invalidateQueries({ queryKey: ['shop-stock'] })
      void qc.invalidateQueries({ queryKey: ['wallet', 'active'] })
    },
    onError: (e: Error) => push(e.message, 'error'),
  })

  const costSilver = (selected?.priceSilver ?? 0) + (selected?.priceGold ?? 0) * 10
  const balanceSilver = (wallet?.silver ?? 0) + (wallet?.gold ?? 0) * 10
  const remaining = balanceSilver - costSilver
  const soldOut =
    (stock?.remaining != null && stock.remaining <= 0) ||
    (selected != null &&
      stock?.remaining == null &&
      selected.stockTotal != null &&
      selected.stockTotal <= 0)

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="font-headline-lg text-2xl text-on-surface">Loja da sessão</h1>
          <p className="mt-2 max-w-3xl text-sm text-on-surface-variant">
            Vitrine feudal publicada pelo mestre. A compra entra no inventário do personagem ativo.
          </p>
        </div>
        <CurrencyVault variant="header" />
      </header>

      <div className="flex flex-wrap items-center gap-3">
        <input
          className="input-feudal min-w-0 flex-1 basis-full pl-4 sm:basis-auto"
          placeholder="Buscar item…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <div className="flex flex-wrap gap-2">
          {CATEGORIES.map((c) => (
            <button
              key={c.id}
              type="button"
              className={`rounded px-3 py-1.5 text-xs font-semibold tracking-wider uppercase ${
                category === c.id ? 'bg-primary-container text-white' : 'border border-outline-variant/40 text-on-surface-variant'
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
        <div className={`grid content-start gap-3 sm:grid-cols-2 ${selected ? 'lg:col-span-7' : 'xl:grid-cols-3'}`}>
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
            className="btn-secondary text-[10px]"
            disabled={safePage <= 1}
            onClick={() => setPage(Math.max(1, safePage - 1))}
          >
            Página anterior
          </button>
          {visiblePageNumbers(safePage, pageCount).map((n) => (
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
      className={`flex flex-col overflow-hidden rounded-2xl border bg-[#141414] ${
        active ? 'border-secondary/70' : 'border-white/10'
      }`}
    >
      <div className="relative h-36 bg-black">
        {item.imageUrl ? (
          <img src={item.imageUrl} alt="" className="h-full w-full object-cover" />
        ) : (
          <div className="flex h-full items-center justify-center bg-[radial-gradient(circle_at_center,#2a1014,#090909)]">
            <span className="material-symbols-outlined text-4xl text-white/25">swords</span>
          </div>
        )}
        <span className="absolute top-2 left-2 rounded border border-white/20 bg-black/60 px-1.5 py-0.5 text-[9px] font-bold tracking-wide text-white/85 uppercase">
          {rarity}
        </span>
      </div>
      <div className="flex flex-1 flex-col px-4 pt-3 pb-3">
        <h2 className="font-serif text-lg text-white">{item.name}</h2>
        <p className="mt-1 flex items-center gap-1 text-[11px] text-[#d6b25e]">
          <span className="material-symbols-outlined text-sm">payments</span>
          {priceShort(item)}
        </p>
        <p className="mt-2 line-clamp-2 text-xs text-white/55">
          {item.description || 'Sem descrição pública.'}
        </p>
        <div className="mt-3 flex items-center justify-between gap-2">
          <span className={`text-[10px] uppercase ${available ? 'text-emerald-400' : 'text-primary'}`}>
            {available ? 'Disponível' : 'Esgotado'}
          </span>
          <button
            type="button"
            className="inline-flex items-center gap-1 text-xs text-white/80 hover:text-white"
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
        <p className="text-[10px] font-semibold tracking-wider text-secondary uppercase">
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
        <span className="absolute top-3 right-3 rounded border border-white/20 bg-black/60 px-2 py-0.5 text-[10px] font-bold tracking-wide text-white uppercase">
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
          <p className="text-[10px] font-semibold tracking-wider text-secondary uppercase">Compra</p>
          <p className="mt-2">Personagem: {primaryName ?? 'Nenhum personagem ativo'}</p>
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

        <button type="button" className="btn-primary w-full text-[10px]" disabled={!canBuy} onClick={onBuy}>
          <span className="material-symbols-outlined text-sm">shopping_cart</span>
          {pending ? 'Comprando…' : soldOut ? 'Esgotado' : 'Confirmar compra'}
        </button>
      </div>
    </div>
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
