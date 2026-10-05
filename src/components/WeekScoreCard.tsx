import { HandHeart, Mail, Megaphone, MessageCircle, Phone, type LucideIcon } from 'lucide-react'
import { MEASURE_LABEL, MEASURES, type Measure, projectLine, type WeekScore } from '@/lib/week-score'
import type { Tone } from './StepIcon'

const LOOK: Record<Measure, { icon: LucideIcon; tone: Tone }> = {
  called: { icon: Phone, tone: 'blue' },
  info: { icon: Mail, tone: 'violet' },
  answered: { icon: MessageCircle, tone: 'green' },
  posted: { icon: Megaphone, tone: 'orange' },
  helped: { icon: HandHeart, tone: 'pink' },
}

/** The week in five numbers, next to last week, and per project what happened. */
export function WeekScoreCard({ score, projects }: { score: WeekScore; projects: { id: string; name: string; color: string }[] }) {
  return (
    <section className="card stack-s rail-wide" aria-label="Deze week">
      <div className="row between">
        <h3>Deze week</h3>
        <span className="tiny muted">vorige week</span>
      </div>
      <ul className="week-rows">
        {MEASURES.map((m) => {
          const { icon: Glyph, tone } = LOOK[m]
          const up = score.now[m] > score.before[m]
          return (
            <li key={m}>
              <span className={`week-ico tone-${tone}`} aria-hidden="true">
                <Glyph size={18} strokeWidth={2.5} />
              </span>
              <span className="grow">{MEASURE_LABEL[m]}</span>
              <strong className={`num${up ? ' up' : ''}`}>{score.now[m]}</strong>
              <span className="tiny muted num week-before">{score.before[m]}</span>
            </li>
          )
        })}
      </ul>
      {score.projects.length ? (
        <ul className="week-projects">
          {score.projects.slice(0, 4).map((p) => {
            const project = projects.find((x) => x.id === p.projectId)
            return project ? (
              <li key={p.projectId} className="tiny">
                <span className="dot" style={{ background: project.color }} aria-hidden="true" />
                <strong>{project.name}</strong>
                <span className="muted">{projectLine(p.counts)}</span>
              </li>
            ) : null
          })}
        </ul>
      ) : (
        <p className="tiny muted">Nog niets deze week. Eén stap uit je dag telt al.</p>
      )}
    </section>
  )
}
