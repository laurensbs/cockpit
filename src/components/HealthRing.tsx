/** A ring that fills with the score: red below 40, amber below 70, green above. */
export function HealthRing({ score, size = 44, label }: { score: number; size?: number; label?: string }) {
  const r = 16
  const c = 2 * Math.PI * r
  const tone = score < 40 ? 'var(--bad)' : score < 70 ? 'var(--warn)' : 'var(--good)'
  return (
    <svg width={size} height={size} viewBox="0 0 40 40" role="img" aria-label={label ?? `Gezondheid ${score} van 100`} className="ring">
      <circle cx="20" cy="20" r={r} fill="none" stroke="var(--sunken)" strokeWidth="5" />
      <circle
        cx="20"
        cy="20"
        r={r}
        fill="none"
        stroke={tone}
        strokeWidth="5"
        strokeLinecap="round"
        strokeDasharray={`${(Math.max(0, Math.min(100, score)) / 100) * c} ${c}`}
        transform="rotate(-90 20 20)"
      />
      <text x="20" y="24" textAnchor="middle" fontSize="11" fontWeight="700" fill="var(--ink)" fontFamily="var(--font-mono)">
        {score}
      </text>
    </svg>
  )
}
