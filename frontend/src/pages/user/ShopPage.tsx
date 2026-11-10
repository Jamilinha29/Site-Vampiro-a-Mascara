import { useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { CurrencyVault } from '../../components/domain/CurrencyVault'
import { api } from '../../services/api'
import type { ChronicleEntity } from '../../types/chronicle'
import { playerQueryKeys } from '../../lib/queryKeys'
import { useToast } from '../../components/ui/ToastProvider'

const CATEGORIES = [
  { id: 'gear' as const, label: 'Equipamentos' },
  { id: 'consumables' as const, label: 'Consumíveis' },
  { id: 'services' as const, label: 'Serviços' },
]

export default function ShopPage() {
  const [category, setCategory] = useState<(typeof CATEGORIES)[number]['id']>('gear')
  const [query, setQuery] = useState('')
  const [buying, setBuying] = useState<ChronicleEntity | null>(null)
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
  const { data: stock } = useQuery({
    queryKey: ['shop-stock', buying?.id],
    queryFn: () => api.getShopStock(buying!.id),
    enabled: !!buying,
  })

  const buy = useMutation({
    mutationFn: () =>
      api.buyShopItem({
        entityId: buying!.id,
        characterId: primary?.id,
        quantity: 1,
      }),
    onSuccess: (res) => {
      push(`${res.itemName} entrou no inventário.`, 'success')
      setBuying(null)
      void qc.invalidateQueries({ queryKey: playerQueryKeys.profile })
      void qc.invalidateQueries({ queryKey: ['shop-stock'] })
    },
    onError: (e: Error) => push(e.message, 'error'),
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

  const costSilver = (buying?.priceSilver ?? 0) + (buying?.priceGold ?? 0) * 10
  const balanceSilver = (wallet?.silver ?? 0) + (wallet?.gold ?? 0) * 10
  const remaining = balanceSilver - costSilver

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
          className="input-feudal min-w-[14rem] flex-1 pl-4"
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
              onClick={() => setCategory(c.id)}
            >
              {c.label}
            </button>
          ))}
        </div>
      </div>

      {isLoading ? <p className="text-sm text-on-surface-variant">Carregando vitrine…</p> : null}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {filtered.map((item) => (
          <article key={item.id} className="mesa-panel flex flex-col p-4">
            <div className="flex h-28 items-center justify-center rounded border border-outline-variant/30 bg-surface-container-high">
              <span className="material-symbols-outlined text-4xl text-outline-variant">storefront</span>
            </div>
            <p className="mt-3 font-serif text-lg text-on-surface">{item.name}</p>
            <p className="mt-1 line-clamp-3 text-xs text-on-surface-variant">{item.description || 'Sem descrição.'}</p>
            <p className="mt-3 text-xs text-secondary">
              {(item.priceGold ?? 0) > 0 ? `${item.priceGold} ouro` : ''}
              {(item.priceGold ?? 0) > 0 && ((item.priceSilver ?? 0) > 0 || (item.priceCopper ?? 0) > 0) ? ' · ' : ''}
              {(item.priceSilver ?? 0) > 0 ? `${item.priceSilver} prata` : ''}
              {(item.priceSilver ?? 0) > 0 && (item.priceCopper ?? 0) > 0 ? ' · ' : ''}
              {(item.priceCopper ?? 0) > 0 ? `${item.priceCopper} bronze` : ''}
              {!item.priceGold && !item.priceSilver && !item.priceCopper ? 'Preço a combinar' : ''}
              {item.stockTotal != null ? ` · estoque ${item.stockTotal}` : ''}
            </p>
            <button type="button" className="btn-primary mt-auto pt-3 text-xs" onClick={() => setBuying(item)}>
              Comprar
            </button>
          </article>
        ))}
        {!isLoading && filtered.length === 0 ? (
          <p className="text-sm text-on-surface-variant sm:col-span-2">Nenhum item publicado nesta vitrine.</p>
        ) : null}
      </div>

      {buying ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm" role="dialog">
          <div className="card-surface w-full max-w-lg space-y-4 border-secondary/40 p-6">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="flex items-center gap-2 font-serif text-xl text-on-surface">
                  <span className="material-symbols-outlined text-secondary">shopping_cart</span>
                  Confirmar compra
                </p>
                <p className="mt-1 text-[10px] tracking-wider text-on-surface-variant uppercase">
                  Transação feudal imediata
                </p>
              </div>
              <button type="button" className="text-on-surface-variant" onClick={() => setBuying(null)} aria-label="Fechar">
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>

            <div className="rounded border border-outline-variant/40 bg-surface-container-lowest/50 p-3">
              <p className="text-[10px] uppercase text-on-surface-variant">{categoryLabel(buying.shopCategory)}</p>
              <p className="font-serif text-lg text-on-surface">{buying.name}</p>
              <p className="mt-1 text-xs text-secondary">
                Custo:{' '}
                {(buying.priceGold ?? 0) > 0 ? `${buying.priceGold} ouro` : ''}
                {(buying.priceGold ?? 0) > 0 && (buying.priceSilver ?? 0) > 0 ? ' · ' : ''}
                {(buying.priceSilver ?? 0) > 0 ? `${buying.priceSilver} prata` : '—'}
              </p>
            </div>

            <div className="space-y-2 text-sm">
              <p className="text-on-surface-variant">
                Personagem comprador:{' '}
                <strong className="text-on-surface">
                  {primary ? `${primary.name}${primary.clan ? ` [${primary.clan}]` : ''}` : 'Nenhum personagem ativo'}
                </strong>
              </p>
              <p className="text-on-surface-variant">
                Saldo atual: <strong className="text-on-surface">{wallet?.silver ?? 0} prata · {wallet?.gold ?? 0} ouro</strong>
              </p>
              <p className="text-on-surface-variant">
                Débito: <strong className="text-primary">−{costSilver} prata (equiv.)</strong>
              </p>
              <p className={remaining >= 0 ? 'text-success' : 'text-primary'}>
                Saldo previsto: <strong>{remaining} prata (equiv.)</strong>
              </p>
              <p className="text-on-surface-variant">
                Estoque restante:{' '}
                <strong className="text-on-surface">
                  {stock?.remaining == null ? 'ilimitado' : stock.remaining}
                </strong>
                {' · '}Já possui: <strong className="text-on-surface">{stock?.ownedByYou ?? 0}</strong>
              </p>
            </div>

            <p className="text-[11px] text-on-surface-variant">
              A aquisição adiciona peso ao inventário do personagem. Alimentos/consumíveis somem ao usar.
            </p>

            <div className="flex justify-end gap-2">
              <button type="button" className="btn-secondary text-xs" onClick={() => setBuying(null)}>
                Cancelar
              </button>
              <button
                type="button"
                className="btn-primary text-xs"
                disabled={!primary || remaining < 0 || buy.isPending || (stock?.remaining != null && stock.remaining <= 0)}
                onClick={() => buy.mutate()}
              >
                {buy.isPending ? 'Comprando…' : 'Confirmar compra'}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}

function categoryLabel(cat?: string) {
  if (cat === 'consumables') return 'Consumível'
  if (cat === 'services') return 'Serviço'
  return 'Equipamento'
}
