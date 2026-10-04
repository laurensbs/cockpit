'use client'

import Link from 'next/link'
import type { SetupStep } from '@/server/setup'
import { LaunchStatus } from './ClaudeButton'
import { Icon } from './Icon'
import { useClaudeLaunch } from './useClaudeLaunch'

export interface NextStepProject {
  projectId: string
  projectName: string
  color: string | null
  href: string
  /** The Claude Code job that does this step, when Claude can do it. */
  task: string | null
}

export interface NextStepGroup {
  key: string
  title: string
  why: string
  projects: NextStepProject[]
}

/**
 * The best next step per project, the project that needs it most first. The same step for several
 * projects is one row; a project with a Claude job starts Claude Code in one click.
 */
export function NextSteps({ groups, disabledReason, project }: { groups: NextStepGroup[]; disabledReason?: string | null; project?: string }) {
  const { open, pending, launch, done } = useClaudeLaunch()
  // On a project page the chips say what they do instead of repeating the project's name.
  const label = (p: NextStepProject, claude: boolean) => (project ? (claude ? 'Laat Claude het doen' : 'Doen') : p.projectName)
  return (
    <section className="card stack-s" aria-labelledby="next-title">
      <div className="row between">
        <h2 id="next-title">{project ? `Nu doen voor ${project}` : 'Nu doen'}</h2>
        <span className="tiny muted">{project ? 'De stappen die het meest opleveren' : 'Per project de stap die het meest oplevert'}</span>
      </div>
      {groups.length ? (
        <ol className="list next-steps">
          {groups.map((g) => (
            <li key={g.key} className="stack-xs">
              <p>
                <strong>{g.title}</strong>
              </p>
              <p className="tiny muted">{g.why}</p>
              <div className="row next-projects">
                {g.projects.map((p) =>
                  p.task && !disabledReason ? (
                    <button
                      key={p.projectId}
                      type="button"
                      className="project-chip claude"
                      disabled={pending}
                      title={`Laat Claude Code dit doen voor ${p.projectName}`}
                      onClick={() => void open(p.task!, p.projectId)}
                    >
                      {project ? null : <span className="dot" style={{ background: p.color ?? 'var(--accent)' }} aria-hidden="true" />}
                      {label(p, true)}
                      <Icon name="bolt" size={13} />
                    </button>
                  ) : (
                    <Link key={p.projectId} href={p.href} className="project-chip">
                      {project ? null : <span className="dot" style={{ background: p.color ?? 'var(--accent)' }} aria-hidden="true" />}
                      {label(p, false)}
                      <Icon name="arrow" size={13} />
                    </Link>
                  ),
                )}
              </div>
            </li>
          ))}
        </ol>
      ) : (
        <p className="small">Alles loopt: posts staan gepland, experimenten draaien en je outreach is bij. Tijd om te meten.</p>
      )}
      {groups.some((g) => g.projects.some((p) => p.task)) && !disabledReason ? (
        <p className="tiny faint">
          <Icon name="bolt" size={12} /> opent Claude Code met die klus; het resultaat komt hier terug.
        </p>
      ) : null}
      <LaunchStatus launch={launch} done={done} />
    </section>
  )
}

/** What is left before the cockpit works on its own. */
export function SetupChecklist({ steps }: { steps: SetupStep[] }) {
  const required = steps.filter((s) => !s.optional)
  const done = required.filter((s) => s.done).length
  const next = steps.find((s) => !s.done && !s.optional)
  return (
    <section className="card setup stack-s" aria-labelledby="setup-title">
      <div className="row between">
        <h2 id="setup-title">Klaarzetten</h2>
        <span className="chip accent num">
          {done} van {required.length}
        </span>
      </div>
      <div className="bar" role="progressbar" aria-valuemin={0} aria-valuemax={required.length} aria-valuenow={done} aria-label="Klaarzetten">
        <span style={{ width: `${Math.round((done / required.length) * 100)}%` }} />
      </div>
      <ol className="setup-steps">
        {steps.map((s) => (
          <li key={s.key} className={s.done ? 'done' : s === next ? 'next' : undefined}>
            <span className="setup-mark" aria-hidden="true">
              {s.done ? <Icon name="check" size={14} /> : null}
            </span>
            <span className="grow stack-xs" style={{ minWidth: 0 }}>
              <span className="setup-title">
                {s.title}
                {s.optional ? <span className="tiny muted"> · optioneel</span> : null}
              </span>
              {!s.done ? <span className="tiny muted">{s.hint}</span> : null}
            </span>
            {!s.done ? (
              <Link href={s.href} className={`button small ${s === next ? 'primary' : 'secondary'}`}>
                {s === next ? 'Nu doen' : 'Doen'}
              </Link>
            ) : null}
          </li>
        ))}
      </ol>
    </section>
  )
}
