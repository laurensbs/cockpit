import { addDays, weekStart } from '@/lib/dates'

/** A GitHub-style grid: weeks as columns, Monday on top, darker for more commits. */
export function Heatmap({ days, today, weeks = 13, label }: { days: Record<string, number>; today: string; weeks?: number; label: string }) {
  const start = addDays(weekStart(today), -7 * (weeks - 1))
  const size = 11
  const gap = 3
  const level = (n: number) => (n === 0 ? 0 : n === 1 ? 1 : n <= 3 ? 2 : n <= 6 ? 3 : 4)
  return (
    <svg viewBox={`0 0 ${weeks * (size + gap) - gap} ${7 * (size + gap) - gap}`} width="100%" role="img" aria-label={label} className="heatmap">
      {Array.from({ length: weeks }, (_, w) =>
        Array.from({ length: 7 }, (_, d) => {
          const day = addDays(start, w * 7 + d)
          if (day > today) return null
          return <rect key={day} x={w * (size + gap)} y={d * (size + gap)} width={size} height={size} rx={2.5} className={`l${level(days[day] ?? 0)}`} />
        }),
      )}
    </svg>
  )
}
