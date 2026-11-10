import { useQuery } from '@tanstack/react-query'
import { api } from '../../services/api'

export function WalletLedgerPanel() {
  const { data: wallet } = useQuery({
    queryKey: ['wallet', 'active'],
    queryFn: () => api.getActiveWallet(),
  })
  const { data: ledger = [], isLoading } = useQuery({
    queryKey: ['wallet', 'ledger'],
    queryFn: () => api.getWalletLedger(),
  })

  return (
    <div className="space-y-3">
      <p className="text-xs text-on-surface-variant">
        Saldo:{' '}
        <span className="text-secondary">{wallet?.gold ?? 0} ouro</span>
        {' · '}
        <span className="text-on-surface">{wallet?.silver ?? 0} prata</span>
        {' · '}
        <span className="text-[#c87d55]">{wallet?.copper ?? 0} bronze</span>
      </p>
      <ul className="max-h-48 space-y-2 overflow-y-auto rounded border border-outline-variant/35 bg-surface-container-lowest/40 p-2">
        {isLoading ? (
          <li className="text-xs text-on-surface-variant">Carregando registros…</li>
        ) : ledger.length === 0 ? (
          <li className="text-xs text-on-surface-variant">Nenhum movimento registrado ainda.</li>
        ) : (
          ledger.map((row) => (
            <li
              key={row.id}
              className="flex items-start justify-between gap-2 border-b border-outline-variant/20 pb-2 text-xs last:border-0 last:pb-0"
            >
              <div className="min-w-0">
                <p className="font-medium text-on-surface">{row.label}</p>
                <p className="text-[10px] text-on-surface-variant">
                  {new Date(row.at).toLocaleString('pt-BR', {
                    day: '2-digit',
                    month: 'short',
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </p>
              </div>
              <span
                className={`shrink-0 font-numeric-stat font-semibold ${
                  row.kind === 'credit' ? 'text-emerald-400' : 'text-primary'
                }`}
              >
                {row.amount}
              </span>
            </li>
          ))
        )}
      </ul>
    </div>
  )
}
