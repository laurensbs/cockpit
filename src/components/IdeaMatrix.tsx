/** Impact against effort: the top left is where to start. Numbers match the idea cards. */
export function IdeaMatrix({ ideas }: { ideas: { impact: number; effort: number }[] }) {
  const size = 280
  const pad = 34
  const pos = (v: number) => pad + ((v - 1) / 4) * (size - 2 * pad)
  // Ideas on the same spot fan out a little so every number stays readable.
  const seen = new Map<string, number>()
  return (
    <svg viewBox={`0 0 ${size} ${size}`} width="100%" style={{ maxWidth: 360 }} role="img" aria-label="Ideeën op impact en moeite" className="matrix">
      <rect x={pad} y={pad / 2} width={(size - 2 * pad) / 2} height={(size - 1.5 * pad) / 2} className="sweet" rx="8" />
      <line x1={pad} y1={size - pad} x2={size - pad / 2} y2={size - pad} className="axis" />
      <line x1={pad} y1={size - pad} x2={pad} y2={pad / 2} className="axis" />
      <text x={size / 2} y={size - 8} textAnchor="middle" className="label">
        moeite →
      </text>
      <text x={12} y={size / 2} textAnchor="middle" className="label" transform={`rotate(-90 12 ${size / 2})`}>
        impact →
      </text>
      <text x={pad + 8} y={pad / 2 + 16} className="label">
        eerst doen
      </text>
      {ideas.map((idea, i) => {
        const key = `${idea.effort}:${idea.impact}`
        const n = seen.get(key) ?? 0
        seen.set(key, n + 1)
        const x = pos(idea.effort) + n * 14
        const y = size - pos(idea.impact) + n * 6
        return (
          <g key={i}>
            <circle cx={x} cy={y} r="11" className="dot" />
            <text x={x} y={y + 4} textAnchor="middle" className="num-label">
              {i + 1}
            </text>
          </g>
        )
      })}
    </svg>
  )
}
