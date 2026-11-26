import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api, type CoinCode } from '../../services/api'
import { useToast } from '../ui/ToastProvider'

type Props = { sessionId: string; live: boolean }

const coinLabel: Record<CoinCode, string> = { gold: 'ouro', silver: 'prata', copper: 'bronze' }

export function MesaAuctionDesk({ sessionId, live }: Props) {
  const [entityId, setEntityId] = useState('')
  const [minutes, setMinutes] = useState(10)
  const [requiredLevel, setRequiredLevel] = useState(1)
  const [npcName, setNpcName] = useState('')
  const [npcAmount, setNpcAmount] = useState(5)
  const [npcCoin, setNpcCoin] = useState<CoinCode>('silver')
  const [extraNpcByAuction, setExtraNpcByAuction] = useState<Record<string, string>>({})
  const [extraAmountByAuction, setExtraAmountByAuction] = useState<Record<string, number>>({})
  const qc = useQueryClient()
  const { push } = useToast()

  const { data: gear = [] } = useQuery({
    queryKey: ['admin-entities', 'equipment'],
    queryFn: () => api.adminListEntities('equipment'),
  })
  const { data: auctions = [] } = useQuery({
    queryKey: ['mesa-auctions', sessionId],
    queryFn: () => api.adminListAuctions(sessionId),
    refetchInterval: (query) =>
      !live ? false : query.state.data?.some((a) => a.status === 'open') ? 8_000 : 60_000,
    refetchIntervalInBackground: false,
  })

  const published = gear.filter((item) => item.visibility === 'published')

  const release = useMutation({
    mutationFn: () =>
      api.adminReleaseAuction(sessionId, {
        entityId,
        requiredLevel,
        minutes,
        npcName: npcName.trim() || undefined,
        npcAmount: npcName.trim() ? npcAmount : undefined,
        npcCoin: npcName.trim() ? npcCoin : undefined,
      }),
    onSuccess: () => {
      push('Leilão aberto na mesa.', 'success')
      setNpcName('')
      void qc.invalidateQueries({ queryKey: ['mesa-auctions', sessionId] })
    },
    onError: (e: Error) => push(e.message, 'error'),
  })

  const npcBid = useMutation({
    mutationFn: (auctionId: string) =>
      api.adminNpcBid(auctionId, {
        displayName: (extraNpcByAuction[auctionId] ?? '').trim(),
        amount: extraAmountByAuction[auctionId] ?? 8,
        coin: npcCoin,
      }),
    onSuccess: (_data, auctionId) => {
      setExtraNpcByAuction((prev) => ({ ...prev, [auctionId]: '' }))
      void qc.invalidateQueries({ queryKey: ['mesa-auctions', sessionId] })
    },
    onError: (e: Error) => push(e.message, 'error'),
  })

  const close = useMutation({
    mutationFn: (auctionId: string) => api.adminCloseAuction(auctionId),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['mesa-auctions', sessionId] }),
    onError: (e: Error) => push(e.message, 'error'),
  })

  return (
    <section className="mesa-panel p-4 lg:col-span-12">
      <h2 className="font-label-sm text-xs text-secondary uppercase">Leilão da mesa</h2>
      <p className="mt-1 text-xs text-on-surface-variant">
        Libere um item com prazo. Vence o maior lance, ou quem restar se os outros desistirem. NPCs entram com o nome que você criar.
      </p>
      <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
        <label className="text-xs uppercase text-on-surface-variant">
          Item publicado
          <select
            className="input-feudal mt-1 w-full py-2 pl-3 text-sm normal-case"
            value={entityId}
            onChange={(e) => setEntityId(e.target.value)}
          >
            <option value="">Selecionar…</option>
            {published.map((item) => (
              <option key={item.id} value={item.id}>
                {item.name}
              </option>
            ))}
          </select>
        </label>
        <label className="text-xs uppercase text-on-surface-variant">
          Nível mínimo
          <input
            type="number"
            min={1}
            max={10}
            className="input-feudal mt-1 w-full py-2 pl-3 text-sm normal-case"
            value={requiredLevel}
            onChange={(e) => setRequiredLevel(Number(e.target.value) || 1)}
          />
        </label>
        <label className="text-xs uppercase text-on-surface-variant">
          Minutos até encerrar
          <input
            type="number"
            min={1}
            max={180}
            className="input-feudal mt-1 w-full py-2 pl-3 text-sm normal-case"
            value={minutes}
            onChange={(e) => setMinutes(Number(e.target.value) || 1)}
          />
        </label>
        <label className="text-xs uppercase text-on-surface-variant">
          NPC (opcional)
          <input
            className="input-feudal mt-1 w-full py-2 pl-3 text-sm normal-case"
            value={npcName}
            onChange={(e) => setNpcName(e.target.value)}
            placeholder="Nome do lance NPC"
          />
        </label>
      </div>
      <div className="mt-3 grid items-end gap-2 sm:grid-cols-3 md:max-w-lg">
        <label className="text-xs uppercase text-on-surface-variant">
          Lance do NPC
          <input
            type="number"
            min={1}
            className="input-feudal mt-1 py-2 pl-3 text-sm normal-case"
            value={npcAmount}
            onChange={(e) => setNpcAmount(Number(e.target.value) || 1)}
          />
        </label>
        <label className="text-xs uppercase text-on-surface-variant">
          Moeda
          <select
            className="input-feudal mt-1 py-2 pl-3 text-sm normal-case"
            value={npcCoin}
            onChange={(e) => setNpcCoin(e.target.value as CoinCode)}
            aria-label="Moeda do NPC"
          >
            <option value="gold">Ouro</option>
            <option value="silver">Prata</option>
            <option value="copper">Bronze</option>
          </select>
        </label>
        <button
          type="button"
          className="btn-primary h-[2.375rem] text-xs"
          disabled={!live || !entityId || release.isPending}
          onClick={() => release.mutate()}
        >
          Abrir leilão
        </button>
      </div>

      <ul className="mt-4 space-y-3">
        {auctions.length === 0 ? <li className="text-sm text-on-surface-variant">Nenhum leilão nesta mesa.</li> : null}
        {auctions.map((auction) => (
          <li key={auction.id} className="rounded border border-outline-variant/40 p-3 text-sm">
            <p className="font-serif text-on-surface">
              {auction.itemName}{' '}
              <span className="text-xs text-secondary">
                nível {auction.requiredLevel} · {auction.status === 'open' ? `até ${new Date(auction.endsAt).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}` : auction.status === 'awarded' ? `vencido por ${auction.winnerLabel ?? '—'}` : 'sem lances'}
              </span>
            </p>
            <ul className="mt-2 space-y-1 text-xs text-on-surface-variant">
              {auction.bids.filter((b) => !b.withdrawn).map((b) => (
                <li key={b.id}>
                  {b.displayName}
                  {b.npc ? ' (NPC)' : ''}: {b.amount} {coinLabel[b.coin]}
                </li>
              ))}
            </ul>
            {auction.status === 'open' ? (
              <div className="mt-2 flex flex-wrap items-end gap-2">
                <input
                  className="input-feudal w-36 py-1 pl-2 text-xs normal-case"
                  placeholder="Outro NPC"
                  value={extraNpcByAuction[auction.id] ?? ''}
                  onChange={(e) => setExtraNpcByAuction((prev) => ({ ...prev, [auction.id]: e.target.value }))}
                />
                <input
                  type="number"
                  min={1}
                  className="input-feudal w-20 py-1 pl-2 text-xs normal-case"
                  value={extraAmountByAuction[auction.id] ?? 8}
                  onChange={(e) =>
                    setExtraAmountByAuction((prev) => ({ ...prev, [auction.id]: Number(e.target.value) || 1 }))
                  }
                />
                <button
                  type="button"
                  className="btn-secondary text-[10px]"
                  disabled={!(extraNpcByAuction[auction.id] ?? '').trim()}
                  onClick={() => npcBid.mutate(auction.id)}
                >
                  Lance de NPC
                </button>
                <button type="button" className="btn-secondary text-[10px]" onClick={() => close.mutate(auction.id)}>
                  Encerrar agora
                </button>
              </div>
            ) : null}
          </li>
        ))}
      </ul>
    </section>
  )
}
