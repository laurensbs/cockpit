import { monthLabel } from '@/lib/dates'
import type { SeenResult } from '@/lib/visibility'
import { CopyButton } from './CopyButton'

export interface SeoPlanView {
  keywords: { keyword: string; intent: string; difficulty: string; why: string }[]
  questions: string[]
  siteFixes: string[]
  made: string
  /** His monthly "Word je gevonden?" results, newest first. */
  seen: SeenResult[]
}

const INTENT: Record<string, string> = { informational: 'wil iets leren', comparing: 'vergelijkt', 'wanting to act': 'wil nu iets doen' }
const DIFFICULTY: Record<string, string> = { low: 'makkelijk', medium: 'te doen', high: 'lastig' }

/**
 * The search plan Claude made: what to be found on, what the site still misses, and the questions to check
 * each month in Google, ChatGPT and Perplexity. Fixes first: they pay off before any new article.
 */
export function SeoPlan({ plan }: { plan: SeoPlanView }) {
  return (
    <section className="card stack-m" aria-labelledby="seo-plan">
      <div className="stack-xs">
        <h2 id="seo-plan">Je zoekplan</h2>
        <p className="small muted">Gemaakt {plan.made}. Eerst de site op orde, dan één goed artikel per maand, en elke maand kijken of je genoemd wordt.</p>
      </div>
      {plan.seen[0] ? (
        <p className="small">
          <strong>Gevonden:</strong> genoemd bij {plan.seen[0].named} van {plan.seen[0].asked} vragen in {monthLabel(`${plan.seen[0].month}-01`)}
          {plan.seen[1] ? <span className="muted"> (de maand ervoor {plan.seen[1].named} van {plan.seen[1].asked})</span> : null}
        </p>
      ) : null}
      {plan.siteFixes.length ? (
        <div className="stack-xs">
          <p className="eyebrow">Wat je site nog mist</p>
          <ol className="small setup-how">
            {plan.siteFixes.map((f) => (
              <li key={f}>{f}</li>
            ))}
          </ol>
        </div>
      ) : null}
      {plan.keywords.length ? (
        <details>
          <summary className="small">Waar je op gevonden wilt worden ({plan.keywords.length})</summary>
          <ul className="setup-list" style={{ marginTop: '0.5rem' }}>
            {plan.keywords.map((k) => (
              <li key={k.keyword} className="setup-step">
                <div className="grow stack-xs">
                  <div className="row" style={{ gap: '0.4rem' }}>
                    <strong>{k.keyword}</strong>
                    {INTENT[k.intent] ? <span className="chip">{INTENT[k.intent]}</span> : null}
                    {DIFFICULTY[k.difficulty] ? <span className="chip">{DIFFICULTY[k.difficulty]}</span> : null}
                  </div>
                  <span className="tiny muted">{k.why}</span>
                </div>
              </li>
            ))}
          </ul>
        </details>
      ) : null}
      {plan.questions.length ? (
        <details>
          <summary className="small">Vragen om elke maand te checken ({plan.questions.length})</summary>
          <div className="stack-s" style={{ marginTop: '0.5rem' }}>
            <p className="tiny muted">Stel ze één keer per maand in Google, ChatGPT en Perplexity. Word je genoemd? Dan werkt het; zo niet, dan weet Claude waar het volgende artikel over gaat.</p>
            <ul className="small setup-how">
              {plan.questions.map((q) => (
                <li key={q}>{q}</li>
              ))}
            </ul>
            <CopyButton text={plan.questions.join('\n')} label="Kopieer de vragen" />
          </div>
        </details>
      ) : null}
    </section>
  )
}
