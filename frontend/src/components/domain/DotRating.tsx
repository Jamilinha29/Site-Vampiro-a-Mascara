type DotRatingProps = {
  value: number
  max?: number
  min?: number
  onChange?: (value: number) => void
  readOnly?: boolean
  tone?: 'blood' | 'gold'
}

export function DotRating({ value, max = 5, min = 0, onChange, readOnly, tone = 'blood' }: DotRatingProps) {
  const filledClass =
    tone === 'gold'
      ? 'border-secondary bg-secondary shadow-[0_0_6px_rgba(233,193,118,0.45)]'
      : 'border-primary-container bg-primary-container shadow-[0_0_6px_rgba(158,27,45,0.5)]'

  return (
    <div className="flex gap-1.5" role="group" aria-label="Classificação por pontos">
      {Array.from({ length: max }, (_, i) => {
        const level = i + 1
        const filled = i < value
        return (
          <button
            key={i}
            type="button"
            disabled={readOnly || !onChange}
            onClick={() => {
              if (!onChange) return
              if (level === value) onChange(Math.max(min, value - 1))
              else onChange(Math.max(min, Math.min(max, level)))
            }}
            className={`h-3.5 w-3.5 rounded-full border transition ${
              filled ? filledClass : 'border-outline-variant/60 bg-surface-container-lowest'
            } ${readOnly ? 'cursor-default' : 'hover:border-secondary'}`}
            aria-label={`${level} de ${max}`}
          />
        )
      })}
    </div>
  )
}
