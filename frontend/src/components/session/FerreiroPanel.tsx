import { useRef, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api, type CoinCode } from '../../services/api'
import { playerQueryKeys } from '../../lib/queryKeys'
import { useToast } from '../ui/ToastProvider'

type Props = {
  sessionId: string
  characterId?: string
  characterLevel: number
  isLive?: boolean
}

const coinLabel: Record<CoinCode, string> = { gold: 'ouro', silver: 'prata', copper: 'bronze' }

function priceOf(item: { priceGold: number; priceSilver: number; priceCopper: number }) {
  const parts = [
    item.priceGold > 0 ? { coin: 'gold' as const, amount: item.priceGold, label: `${item.priceGold} ouro` } : null,
    item.priceSilver > 0 ? { coin: 'silver' as const, amount: item.priceSilver, label: `${item.priceSilver} prata` } : null,
    item.priceCopper > 0 ? { coin: 'copper' as const, amount: item.priceCopper, label: `${item.priceCopper} bronze` } : null,
  ].filter((part) => part !== null)
  if (parts.length === 0) return { coin: 'silver' as const, amount: 0, label: 'grátis' }
  return { coin: parts[0].coin, amount: parts[0].amount, label: parts.map((part) => part.label).join(' + ') }
}

export function FerreiroPanel({ sessionId, characterId, characterLevel, isLive = true }: Props) {
  const [tab, setTab] = useState<'comercio' | 'leilao'>('comercio')
  const [bidAmount, setBidAmount] = useState(1)
  const [bidCoin, setBidCoin] = useState<CoinCode>('silver')
  const qc = useQueryClient()
  const { push } = useToast()
  const { data, isLoading } = useQuery({
    queryKey: ['ferreiro', sessionId, characterId],
    queryFn: () => api.getFerreiro(sessionId, characterId),
    refetchInterval: !isLive ? false : tab === 'leilao' ? 10_000 : 60_000,
    refetchIntervalInBackground: false,
  })
  const { data: wallet } = useQuery({
    queryKey: ['wallet', 'active'],
    queryFn: () => api.getActiveWallet(),
  })

  const buyOpRef = useRef<{ entityId: string; operationId: string } | null>(null)

  const buy = useMutation({
    mutationFn: (entityId: string) => {
      if (!buyOpRef.current || buyOpRef.current.entityId !== entityId) {
        buyOpRef.current = { entityId, operationId: crypto.randomUUID() }
      }
      return api.buyShopItem({
        entityId,
        characterId,
        sessionId,
        quantity: 1,
        operationId: buyOpRef.current.operationId,
      })
    },
    onSuccess: (res) => {
      buyOpRef.current = null
      push(`${res.itemName} comprado no ferreiro.`, 'success')
      void qc.invalidateQueries({ queryKey: ['wallet', 'active'] })
      void qc.invalidateQueries({ queryKey: playerQueryKeys.profile })
      void qc.invalidateQueries({ queryKey: ['ferreiro', sessionId] })
    },
    onError: (e: Error) => push(e.message, 'error'),
  })

  const bid = useMutation({
    mutationFn: (auctionId: string) => api.bidAuction(auctionId, { amount: bidAmount, coin: bidCoin, characterId }),
    onSuccess: () => {
      push('Lance registrado.', 'success')
      void qc.invalidateQueries({ queryKey: ['ferreiro', sessionId] })
      void qc.invalidateQueries({ queryKey: ['wallet', 'active'] })
    },
    onError: (e: Error) => push(e.message, 'error'),
  })

  const withdraw = useMutation({
    mutationFn: (auctionId: string) => api.withdrawAuction(auctionId),
    onSuccess: () => {
      push('Você desistiu do lance.', 'success')
      void qc.invalidateQueries({ queryKey: ['ferreiro', sessionId] })
      void qc.invalidateQueries({ queryKey: ['wallet', 'active'] })
    },
    onError: (e: Error) => push(e.message, 'error'),
  })

  const level = data?.level ?? characterLevel

  return (
    <section className="mesa-panel max-w-xl p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="font-label-sm text-xs text-secondary uppercase">Ferreiro</h2>
        <p className="text-[11px] text-on-surface-variant">
          Nível {level} · {wallet?.gold ?? 0} ouro · {wallet?.silver ?? 0} prata · {wallet?.copper ?? 0} bronze
        </p>
      </div>
      <div className="mt-3 flex gap-2">
        <button type="button" className={tab === 'comercio' ? 'btn-primary text-xs' : 'btn-secondary text-xs'} onClick={() => setTab('comercio')}>
          Comércio
        </button>
        <button type="button" className={tab === 'leilao' ? 'btn-primary text-xs' : 'btn-secondary text-xs'} onClick={() => setTab('leilao')}>
          Leilão
        </button>
      </div>
      {isLoading ? <p className="mt-3 text-sm text-on-surface-variant">O ferreiro abre a banca…</p> : null}

      {tab === 'comercio' ? (
        <ul className="mt-3 max-h-64 space-y-2 overflow-y-auto">
          {(data?.commerce ?? []).length === 0 ? (
            <li className="text-sm text-on-surface-variant">Nenhum equipamento publicado.</li>
          ) : null}
          {(data?.commerce ?? []).map((item) => {
            const price = priceOf(item)
            const locked = level < item.requiredLevel
            const afford =
              (item.priceGold ?? 0) <= (wallet?.gold ?? 0) &&
              (item.priceSilver ?? 0) <= (wallet?.silver ?? 0) &&
              (item.priceCopper ?? 0) <= (wallet?.copper ?? 0)
            return (
              <li key={item.id} className="flex items-center justify-between gap-2 rounded border border-outline-variant/30 px-2 py-2 text-sm">
                <div className="min-w-0">
                  <p className="truncate font-serif text-on-surface">{item.name}</p>
                  <p className="text-[11px] text-on-surface-variant">
                    {price.label} · nível {item.requiredLevel}
                    {locked ? ' · acima do seu nível' : ''}
                  </p>
                </div>
                <button
                  type="button"
                  className="btn-secondary shrink-0 text-[10px]"
                  disabled={locked || buy.isPending || !afford}
                  onClick={() => buy.mutate(item.id)}
                >
                  Comprar
                </button>
              </li>
            )
          })}
        </ul>
      ) : (
        <ul className="mt-3 max-h-72 space-y-3 overflow-y-auto">
          {(data?.auctions ?? []).length === 0 ? (
            <li className="text-sm text-on-surface-variant">O mestre ainda não abriu um leilão.</li>
          ) : null}
          {(data?.auctions ?? []).map((auction) => {
            const locked = level < auction.requiredLevel
            return (
              <li key={auction.id} className="rounded border border-outline-variant/30 p-2 text-sm">
                <p className="font-serif text-on-surface">{auction.itemName}</p>
                <p className="text-[11px] text-on-surface-variant">
                  Nível {auction.requiredLevel}
                  {auction.status === 'open'
                    ? ` · encerra ${new Date(auction.endsAt).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`
                    : auction.winnerLabel
                      ? ` · ${auction.winnerLabel}`
                      : ' · encerrado'}
                  {auction.leading ? ` · maior: ${auction.leading.amount} ${coinLabel[auction.leading.coin]} (${auction.leading.displayName})` : ''}
                </p>
                {auction.status === 'open' ? (
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    <input
                      type="number"
                      min={1}
                      className="input-feudal w-20 py-1 pl-2 text-xs normal-case"
                      value={bidAmount}
                      onChange={(e) => setBidAmount(Number(e.target.value) || 1)}
                      disabled={locked}
                    />
                    <select
                      className="input-feudal py-1 pl-2 text-xs normal-case"
                      value={bidCoin}
                      onChange={(e) => setBidCoin(e.target.value as CoinCode)}
                      disabled={locked}
                    >
                      <option value="gold">Ouro</option>
                      <option value="silver">Prata</option>
                      <option value="copper">Bronze</option>
                    </select>
                    <button type="button" className="btn-primary text-[10px]" disabled={locked || bid.isPending} onClick={() => bid.mutate(auction.id)}>
                      Lance
                    </button>
                    <button type="button" className="btn-secondary text-[10px]" onClick={() => withdraw.mutate(auction.id)}>
                      Desistir
                    </button>
                  </div>
                ) : null}
              </li>
            )
          })}
        </ul>
      )}
    </section>
  )
}
