/** Commits per day as small bars: the last n days, today on the right. */
export function Sparkline({ values, label, height = 28 }: { values: number[]; label: string; height?: number }) {
  const max = Math.max(1, ...values)
  const w = 4
  const gap = 2
  const width = values.length * (w + gap) - gap
  return (
    <svg width="100%" height={height} viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none" role="img" aria-label={label} className="sparkline">
      {values.map((v, i) => {
        const h = v === 0 ? 2 : Math.max(4, Math.round((v / max) * height))
        return <rect key={i} x={i * (w + gap)} y={height - h} width={w} height={h} rx={1.5} className={v === 0 ? 'off' : 'on'} />
      })}
    </svg>
  )
}
