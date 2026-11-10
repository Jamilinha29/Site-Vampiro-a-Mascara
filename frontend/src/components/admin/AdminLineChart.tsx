import { adminChartShellClass } from './adminChartShell'

type Point = { label: string; count: number }

export function AdminLineChart({ series }: { series: Point[] }) {
  const max = Math.max(1, ...series.map((p) => p.count))
  const w = 280
  const h = 168
  const pad = 20
  const innerW = w - pad * 2
  const innerH = h - pad * 2

  const points = series.map((p, i) => {
    const x = pad + (series.length <= 1 ? innerW / 2 : (i / (series.length - 1)) * innerW)
    const y = pad + innerH - (p.count / max) * innerH
    return `${x},${y}`
  })

  return (
    <div className={adminChartShellClass}>
      <p className="text-sm font-semibold tracking-tight text-on-surface">Atividade (8 semanas)</p>
      <svg className="mt-2 w-full flex-1" viewBox={`0 0 ${w} ${h}`} role="img" aria-label="Gráfico de sessões por semana">
        <title>Sessões por semana</title>
        {[0, 0.5, 1].map((t) => {
          const y = pad + innerH * (1 - t)
          return (
            <line key={t} x1={pad} y1={y} x2={w - pad} y2={y} stroke="currentColor" className="text-outline-variant/40" strokeDasharray="2 2" />
          )
        })}
        {series.length > 0 ? (
          <polyline fill="none" stroke="currentColor" className="text-primary" strokeWidth={2} points={points.join(' ')} />
        ) : null}
        {series.map((p, i) => {
          const x = pad + (series.length <= 1 ? innerW / 2 : (i / (series.length - 1)) * innerW)
          const y = pad + innerH - (p.count / max) * innerH
          return <circle key={p.label} cx={x} cy={y} r={3} className="fill-secondary" />
        })}
      </svg>
      <div className="mt-2 grid grid-cols-2 gap-x-2 gap-y-0.5 text-[9px] leading-tight text-on-surface-variant">
        {series.map((p) => (
          <span key={p.label} className="truncate">
            {p.label}: <span className="font-medium text-on-surface">{p.count}</span>
          </span>
        ))}
      </div>
      {series.length === 0 ? (
        <p className="mt-2 border-t border-outline-variant/30 pt-2 text-[10px] text-on-surface-variant">Sem dados ainda.</p>
      ) : null}
    </div>
  )
}
