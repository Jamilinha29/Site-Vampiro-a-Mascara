type Axis = { label: string; value: number }

type Props = {
  axes: Axis[]
  empty?: boolean
}

const CX = 150
const CY = 150
const R = 100

function point(i: number, n: number, r: number, value = 1) {
  const angle = (Math.PI * 2 * i) / n - Math.PI / 2
  const dist = r * value
  return [CX + Math.cos(angle) * dist, CY + Math.sin(angle) * dist]
}

export function RadarChart({ axes, empty }: Props) {
  const n = 8
  const labels =
    axes.length > 0
      ? axes
      : [
          { label: 'Combate', value: 0 },
          { label: 'Social', value: 0 },
          { label: 'Investigação', value: 0 },
          { label: 'Ocultismo', value: 0 },
          { label: 'Estratégia', value: 0 },
          { label: 'Exploração', value: 0 },
          { label: 'Sobrevivência', value: 0 },
          { label: 'Interpretação', value: 0 },
        ]

  const gridLevels = [0.25, 0.5, 0.75, 1]
  const dataPoints = labels
    .slice(0, n)
    .map((a, i) => point(i, n, R, empty ? 0 : a.value / 100))
    .map(([x, y]) => `${x},${y}`)
    .join(' ')

  return (
    <svg className="mx-auto h-[260px] w-full max-w-[270px] overflow-visible" viewBox="0 0 300 300" role="img">
      <title>Perfil de equilíbrio do personagem</title>
      {gridLevels.map((lvl) => (
        <polygon
          key={lvl}
          fill="none"
          stroke="#363647"
          strokeOpacity={0.6}
          points={Array.from({ length: n }, (_, i) => point(i, n, R * lvl).join(',')).join(' ')}
        />
      ))}
      {Array.from({ length: n }, (_, i) => {
        const [x, y] = point(i, n, R)
        return <line key={i} x1={CX} y1={CY} x2={x} y2={y} stroke="#594141" strokeDasharray="2 2" />
      })}
      {!empty ? (
        <polygon fill="rgba(158, 27, 45, 0.28)" stroke="#9E1B2D" strokeWidth={2} points={dataPoints} />
      ) : null}
      {labels.slice(0, n).map((a, i) => {
        const [x, y] = point(i, n, R + 18)
        return (
          <text
            key={a.label}
            x={x}
            y={y}
            fill="#e0bfbe"
            fontSize={8}
            textAnchor="middle"
            dominantBaseline="middle"
          >
            {empty ? a.label : `${a.label} (${a.value}%)`}
          </text>
        )
      })}
    </svg>
  )
}
