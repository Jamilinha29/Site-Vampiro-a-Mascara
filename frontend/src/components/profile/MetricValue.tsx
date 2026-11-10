import type { ReactNode } from 'react'

export function MetricValue({ value, suffix }: { value: number | null | undefined; suffix?: string }) {
  if (value === null || value === undefined) {
    return <span className="font-numeric-stat text-2xl text-on-surface-variant">—</span>
  }
  return (
    <span className="font-numeric-stat text-2xl text-on-surface">
      {value.toLocaleString('pt-BR')}
      {suffix ? <span className="text-xs font-normal text-on-surface-variant"> {suffix}</span> : null}
    </span>
  )
}

export function EmptyBlock({ children }: { children: ReactNode }) {
  return (
    <p className="rounded border border-dashed border-outline-variant/50 bg-surface-container-lowest/50 px-4 py-6 text-center text-sm text-on-surface-variant">
      {children}
    </p>
  )
}
