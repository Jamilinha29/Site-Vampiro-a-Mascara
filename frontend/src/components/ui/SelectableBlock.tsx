import type { ReactNode } from 'react'

type Props = {
  selected?: boolean
  onClick?: () => void
  title: string
  description?: string
  icon?: string
  children?: ReactNode
  className?: string
  as?: 'button' | 'div'
}

export function SelectableBlock({
  selected,
  onClick,
  title,
  description,
  icon,
  children,
  className = '',
  as = 'button',
}: Props) {
  const base =
    'relative w-full rounded-lg border p-4 text-left transition focus:outline-none focus-visible:ring-2 focus-visible:ring-secondary'
  const state = selected
    ? 'border-secondary bg-secondary/15 shadow-[inset_0_0_0_1px_rgba(233,193,118,0.35)]'
    : 'border-outline-variant/50 bg-surface-container-low hover:border-outline-variant'

  const inner = (
    <>
      {selected ? (
        <span
          className="absolute top-2 right-2 inline-flex items-center gap-0.5 rounded bg-secondary/20 px-1.5 py-0.5 text-[10px] font-bold tracking-wide text-secondary uppercase"
          aria-hidden
        >
          <span className="material-symbols-outlined text-xs">check_circle</span>
          Selecionado
        </span>
      ) : null}
      {icon ? (
        <span className="material-symbols-outlined mb-2 block text-2xl text-secondary">{icon}</span>
      ) : null}
      <span className="font-serif text-base text-on-surface">{title}</span>
      {description ? <p className="mt-1 text-xs leading-relaxed text-on-surface-variant">{description}</p> : null}
      {children}
    </>
  )

  if (as === 'div') {
    return <div className={`${base} ${state} ${className}`}>{inner}</div>
  }

  return (
    <button
      type="button"
      aria-pressed={selected}
      onClick={onClick}
      className={`${base} ${state} ${className}`}
    >
      {inner}
    </button>
  )
}
