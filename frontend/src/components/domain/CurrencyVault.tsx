import { useQuery } from '@tanstack/react-query'
import { api } from '../../services/api'

type Props = {
  variant?: 'default' | 'header' | 'panel'
}

export function CurrencyVault({ variant = 'default' }: Props) {
  const { data, isLoading } = useQuery({
    queryKey: ['wallet', 'active'],
    queryFn: () => api.getActiveWallet(),
  })

  const gold = data?.gold ?? 0
  const silver = data?.silver ?? 0
  const copper = data?.copper ?? 0
  const display = (n: number) => (isLoading ? '—' : n)

  if (variant === 'header') {
    return (
      <button
        type="button"
        className="hidden items-center gap-2 rounded border border-outline-variant/80 bg-surface-container-low px-2 py-1 text-[11px] transition hover:border-secondary/50 md:flex"
        aria-label={`Carteira: ${display(gold)} ouro, ${display(silver)} prata, ${display(copper)} cobre`}
      >
        <span className="flex items-center gap-0.5 text-secondary">
          <span className="material-symbols-outlined text-[15px]" style={{ fontVariationSettings: "'FILL' 1" }}>
            monetization_on
          </span>
          <span className="font-numeric-stat text-xs font-bold leading-none">{display(gold)}</span>
        </span>
        <span className="h-2.5 w-px bg-outline-variant/60" aria-hidden />
        <span className="flex items-center gap-0.5 text-on-surface">
          <span className="material-symbols-outlined text-[15px]">circle</span>
          <span className="font-numeric-stat text-xs font-bold leading-none">{display(silver)}</span>
        </span>
        <span className="h-2.5 w-px bg-outline-variant/60" aria-hidden />
        <span className="flex items-center gap-0.5 text-[#c87d55]">
          <span className="material-symbols-outlined text-[15px]">radio_button_checked</span>
          <span className="font-numeric-stat text-xs font-bold leading-none">{display(copper)}</span>
        </span>
      </button>
    )
  }

  if (variant === 'panel') {
    return (
      <div className="flex flex-wrap gap-4" aria-label="Carteira do personagem ativo">
        <Coin label="Ouro imperial" value={display(gold)} tone="gold" />
        <Coin label="Prata" value={display(silver)} tone="silver" />
        <Coin label="Cobre" value={display(copper)} tone="copper" />
      </div>
    )
  }

  return (
    <div
      className="hidden items-center gap-3 rounded border border-outline-variant/40 bg-surface-container px-3 py-1.5 md:flex"
      aria-label="Carteira do personagem ativo"
    >
      <Coin label="Ouro" value={display(gold)} tone="gold" />
      <Coin label="Prata" value={display(silver)} tone="silver" />
      <Coin label="Cobre" value={display(copper)} tone="copper" />
    </div>
  )
}

function Coin({
  label,
  value,
  tone,
}: {
  label: string
  value: number | string
  tone: 'gold' | 'silver' | 'copper'
}) {
  const color =
    tone === 'gold' ? 'text-secondary' : tone === 'silver' ? 'text-on-surface' : 'text-[#a65b32]'
  const icon =
    tone === 'gold' ? 'monetization_on' : tone === 'silver' ? 'circle' : 'radio_button_checked'
  return (
    <div className="flex items-center gap-1">
      <span className={`material-symbols-outlined text-sm ${color}`} aria-hidden>
        {icon}
      </span>
      <span className="font-numeric-stat text-sm font-bold text-on-surface">{value}</span>
      <span className="sr-only">{label}</span>
    </div>
  )
}
