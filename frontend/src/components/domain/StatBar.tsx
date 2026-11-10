type StatBarProps = {
  label: string
  current: number
  max: number
  /** Bônus de equipamento exibido ao lado (ex.: +10). */
  bonus?: number
  variant?: 'health' | 'blood' | 'will' | 'xp' | 'faith' | 'mana' | 'defense'
}

const fills: Record<NonNullable<StatBarProps['variant']>, string> = {
  health: 'bg-primary-container',
  blood: 'bg-[#781321]',
  will: 'bg-tertiary-container',
  xp: 'bg-secondary',
  faith: 'bg-warning',
  mana: 'bg-[#3b6ea5]',
  defense: 'bg-[#6b7280]',
}

function formatBonus(n: number) {
  if (!n) return ''
  return n > 0 ? ` +${n}` : ` ${n}`
}

export function StatBar({ label, current, max, bonus = 0, variant = 'health' }: StatBarProps) {
  const pct = max > 0 ? Math.min(100, Math.round((current / max) * 100)) : 0
  return (
    <div>
      <div className="mb-1 flex items-center justify-between gap-2 text-xs">
        <span className="font-label-sm uppercase tracking-wider text-on-surface-variant">{label}</span>
        <span className="font-numeric-stat text-on-surface">
          {current}/{max}
          {bonus ? (
            <span className={bonus > 0 ? 'text-secondary' : 'text-primary'}>{formatBonus(bonus)}</span>
          ) : null}
        </span>
      </div>
      <div className="h-2.5 overflow-hidden rounded border border-outline-variant/40 bg-surface-container-lowest">
        <div
          className={`h-full transition-all ${fills[variant]}`}
          style={{ width: `${pct}%` }}
          role="progressbar"
          aria-valuenow={current}
          aria-valuemin={0}
          aria-valuemax={max}
          aria-label={label}
        />
      </div>
    </div>
  )
}
