import { formatUsdMicros } from '@/lib/time'
import type { BudgetState } from '@/server/ai/budget'

/** This month's AI spending against the hard limit. */
export function CostMeter({ budget }: { budget: BudgetState }) {
  const used = budget.spentMicros + budget.reservedMicros
  const share = budget.budgetMicros ? Math.min(1, used / budget.budgetMicros) : 1
  return (
    <div className="stack-xs" title="Kosten van Claude deze maand">
      <div className="row between tiny">
        <span className="muted">AI deze maand</span>
        <span className="num">
          {formatUsdMicros(used)} / {formatUsdMicros(budget.budgetMicros)}
        </span>
      </div>
      <div className={`bar ${share > 0.8 ? 'warn' : 'accent'}`} style={{ height: 6 }}>
        <span style={{ width: `${Math.round(share * 100)}%` }} />
      </div>
    </div>
  )
}
