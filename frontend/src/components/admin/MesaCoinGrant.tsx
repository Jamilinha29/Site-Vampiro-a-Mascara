import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api, type CoinCode } from '../../services/api'
import { useToast } from '../ui/ToastProvider'

const COINS: { id: CoinCode; label: string }[] = [
  { id: 'gold', label: 'Ouro' },
  { id: 'silver', label: 'Prata' },
  { id: 'copper', label: 'Bronze' },
]

type Props = {
  sessionId: string
  participant: string
  live: boolean
}

export function MesaCoinGrant({ sessionId, participant, live }: Props) {
  const [coin, setCoin] = useState<CoinCode>('silver')
  const [amount, setAmount] = useState(5)
  const qc = useQueryClient()
  const { push } = useToast()
  const grant = useMutation({
    mutationFn: () =>
      api.adminGrantCoins({
        sessionId,
        participantDisplayName: participant,
        coin,
        amount: Math.max(1, Math.round(amount)),
      }),
    onSuccess: () => {
      push('Moedas enviadas ao jogador.', 'success')
      void qc.invalidateQueries({ queryKey: ['wallet', 'active'] })
    },
    onError: (e: Error) => push(e.message, 'error'),
  })

  return (
    <div className="mt-4 border-t border-outline-variant/30 pt-3">
      <p className="text-xs uppercase text-on-surface-variant">Moedas para este jogador</p>
      <div className="mt-2 flex flex-wrap items-end gap-2">
        <label className="text-xs uppercase text-on-surface-variant">
          Tipo
          <select
            className="input-feudal mt-1 block py-1 pl-2 text-sm normal-case"
            value={coin}
            onChange={(e) => setCoin(e.target.value as CoinCode)}
          >
            {COINS.map((c) => (
              <option key={c.id} value={c.id}>
                {c.label}
              </option>
            ))}
          </select>
        </label>
        <label className="text-xs uppercase text-on-surface-variant">
          Quantidade
          <input
            type="number"
            min={1}
            className="input-feudal mt-1 block w-24 py-1 pl-2 text-sm normal-case"
            value={amount}
            onChange={(e) => setAmount(Number(e.target.value) || 1)}
          />
        </label>
        <button
          type="button"
          className="btn-primary text-xs"
          disabled={!participant || !live || grant.isPending}
          onClick={() => grant.mutate()}
        >
          Enviar moedas
        </button>
      </div>
    </div>
  )
}
