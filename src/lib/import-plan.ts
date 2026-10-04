import { stemOf, suggestGroups } from './group-repos'
import type { Stage } from './options'

export interface RepoForImport {
  fullName: string
  description: string
  homepage: string | null
  pushedAt: string | null
  archived: boolean
  fork: boolean
}

export interface ImportPlan {
  /** Repositories that join a project they already share a group with. */
  toExisting: { projectId: string; names: string[] }[]
  /** Groups that become a project of their own. */
  newProjects: { name: string; names: string[]; oneLiner: string; siteUrl: string | null; stage: Stage }[]
}

const ACTIVE_DAYS = 60

/** "caravanstallingspanje-repair" → "Caravanstallingspanje"; "my-game" → "My game". */
export function projectNameOf(fullName: string): string {
  const words = stemOf(fullName).replace(/[-_.]+/g, ' ').trim()
  return words ? words[0].toUpperCase() + words.slice(1) : fullName.replace(/^.*\//, '')
}

/**
 * Everything from GitHub in one go: live repositories that are new (or in the cockpit without a
 * project) are grouped by name. A group that touches a known project joins it; the rest become new
 * projects, named after the group and filled in from the repository details.
 */
export function planImport(repos: readonly RepoForImport[], linked: ReadonlyMap<string, string | null>, now: Date): ImportPlan {
  const live = repos.filter((r) => !r.fork && !r.archived)
  const open = live.filter((r) => !linked.has(r.fullName) || linked.get(r.fullName) === null)
  const byName = new Map(live.map((r) => [r.fullName, r]))
  // Group the open repositories together with the ones already in a project, so a new
  // "rondje-admin" lands with "rondje".
  const inProjects = [...linked.entries()].filter(([, projectId]) => projectId !== null).map(([name]) => name)
  const groups = suggestGroups([...open.map((r) => r.fullName), ...inProjects])
  const plan: ImportPlan = { toExisting: [], newProjects: [] }
  const activity = new Map<string, number>()
  for (const group of groups) {
    const names = group.filter((n) => open.some((r) => r.fullName === n))
    if (!names.length) continue
    const projectId = group.map((n) => linked.get(n)).find((id): id is string => typeof id === 'string')
    if (projectId) {
      plan.toExisting.push({ projectId, names })
      continue
    }
    const repos = names.map((n) => byName.get(n)!)
    const main = [...repos].sort((a, b) => a.fullName.length - b.fullName.length)[0]
    const latest = Math.max(...repos.map((r) => (r.pushedAt ? Date.parse(r.pushedAt) : 0)))
    activity.set(names[0], latest)
    plan.newProjects.push({
      name: projectNameOf(main.fullName),
      names,
      oneLiner: (repos.find((r) => r.description.trim())?.description ?? '').trim().slice(0, 200),
      siteUrl: repos.find((r) => r.homepage)?.homepage ?? null,
      stage: now.getTime() - latest <= ACTIVE_DAYS * 86_400_000 ? 'build' : 'maintain',
    })
  }
  // The most recently active first: that is what he is working on.
  plan.newProjects.sort((a, b) => (activity.get(b.names[0]) ?? 0) - (activity.get(a.names[0]) ?? 0))
  return plan
}
