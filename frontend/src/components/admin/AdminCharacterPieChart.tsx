import { adminChartShellClass } from './adminChartShell'

type Slice = { label: string; count: number }

const SLICE_CLASSES = [
  'fill-primary',
  'fill-secondary',
  'fill-tertiary',
  'fill-success',
  'fill-primary-container',
  'fill-secondary-container',
  'fill-outline',
  'fill-on-surface-variant',
]

function polar(cx: number, cy: number, r: number, angleRad: number) {
  return { x: cx + r * Math.cos(angleRad), y: cy + r * Math.sin(angleRad) }
}

function slicePath(cx: number, cy: number, r: number, start: number, end: number) {
  const large = end - start > Math.PI ? 1 : 0
  const p0 = polar(cx, cy, r, start)
  const p1 = polar(cx, cy, r, end)
  return `M ${cx} ${cy} L ${p0.x} ${p0.y} A ${r} ${r} 0 ${large} 1 ${p1.x} ${p1.y} Z`
}

export function AdminCharacterPieChart({ series }: { series: Slice[] }) {
  const total = series.reduce((s, x) => s + x.count, 0)
  const cx = 90
  const cy = 88
  const r = 72
  let angle = -Math.PI / 2

  const arcs =
    total > 0
      ? series.map((slice, i) => {
          const sweep = (slice.count / total) * Math.PI * 2
          const start = angle
          angle += sweep
          return { slice, path: slicePath(cx, cy, r, start, angle), className: SLICE_CLASSES[i % SLICE_CLASSES.length] }
        })
      : []

  return (
    <div className={adminChartShellClass}>
      <p className="text-sm font-semibold tracking-tight text-on-surface">Personagens por jogador</p>
      <div className="mt-2 flex flex-1 flex-col items-center justify-center gap-2 sm:flex-row sm:items-start">
        <svg className="h-[11rem] w-[11rem] shrink-0" viewBox="0 0 180 176" role="img" aria-label="Gráfico de pizza de personagens por jogador">
          <title>Personagens criados por conta de jogador</title>
          {total === 0 ? (
            <circle cx={cx} cy={cy} r={r} className="fill-surface-container stroke-outline-variant/40" strokeWidth={1} />
          ) : (
            arcs.map(({ slice, path, className }) => (
              <path key={slice.label} d={path} className={className} stroke="currentColor" strokeWidth={0.5} />
            ))
          )}
        </svg>
        <ul className="max-h-[9.5rem] w-full flex-1 space-y-0.5 overflow-y-auto text-[9px] leading-tight text-on-surface-variant">
          {series.map((s, i) => (
            <li key={s.label} className="flex items-center gap-1.5 truncate">
              <span className={`inline-block h-2 w-2 shrink-0 rounded-full ${SLICE_CLASSES[i % SLICE_CLASSES.length].replace('fill-', 'bg-')}`} aria-hidden />
              <span className="truncate">
                {s.label}: <span className="font-medium text-on-surface">{s.count}</span>
              </span>
            </li>
          ))}
        </ul>
      </div>
      {series.length === 0 ? (
        <p className="mt-2 border-t border-outline-variant/30 pt-2 text-[10px] text-on-surface-variant">Nenhum personagem criado por jogadores ainda.</p>
      ) : (
        <p className="mt-auto border-t border-outline-variant/30 pt-2 text-[10px] text-on-surface-variant">
          Total: <span className="font-medium text-on-surface">{total}</span> personagem(ns) · contas com role jogador
        </p>
      )}
    </div>
  )
}
