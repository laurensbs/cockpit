import 'server-only'
import { and, desc, eq, gte, ne } from 'drizzle-orm'
import type { Db } from '@/db'
import * as s from '@/db/schema'
import type { ContextInput } from '@/lib/ai/prompts'
import { profileFromJson, type Profile } from '@/lib/ai/schemas'
import { addMonths, dayOf, monthStart } from '@/lib/dates'

export interface JobContext {
  ownerId: string
  project: typeof s.project.$inferSelect
  input: ContextInput
  profile: Profile | null
}

/** Everything the AI may know about one of the owner's projects, or null when it is not theirs. */
export async function loadJobContext(db: Db, ownerId: string, projectId: string): Promise<JobContext | null> {
  const [project] = await db
    .select()
    .from(s.project)
    .where(and(eq(s.project.id, projectId), eq(s.project.ownerId, ownerId)))
  if (!project) return null
  const [company] = project.companyId ? await db.select().from(s.company).where(eq(s.company.id, project.companyId)) : []
  const repos = await db
    .select()
    .from(s.repo)
    .where(and(eq(s.repo.projectId, projectId), eq(s.repo.includeInAi, true)))
  const metrics = await db
    .select({ month: s.metric.month, key: s.metric.key, value: s.metric.value })
    .from(s.metric)
    .where(and(eq(s.metric.projectId, projectId), gte(s.metric.month, addMonths(monthStart(dayOf(new Date())), -3))))
  const others = await db
    .select({ name: s.project.name, oneLiner: s.project.oneLiner, stage: s.project.stage })
    .from(s.project)
    .where(and(eq(s.project.ownerId, ownerId), ne(s.project.id, projectId)))
  const rated = await db
    .select({ title: s.contentItem.title, rating: s.contentItem.rating })
    .from(s.contentItem)
    .where(and(eq(s.contentItem.projectId, projectId), ne(s.contentItem.rating, 0)))
    .orderBy(desc(s.contentItem.createdAt))
    .limit(30)
  const [profileBrief] = await db
    .select({ content: s.brief.content })
    .from(s.brief)
    .where(and(eq(s.brief.projectId, projectId), eq(s.brief.kind, 'profile')))
    .orderBy(desc(s.brief.createdAt))
    .limit(1)
  return {
    ownerId,
    project,
    profile: profileBrief ? profileFromJson(profileBrief.content) : null,
    input: {
      project: {
        name: project.name,
        stage: project.stage,
        oneLiner: project.oneLiner,
        what: project.what,
        audience: project.audience,
        goal: project.goal,
        northStar: project.northStar,
        tone: project.tone,
        redLines: project.redLines,
        markets: project.markets,
        languages: project.languages,
        monthlyBudget: project.monthlyBudget,
        siteUrl: project.siteUrl,
      },
      company: company ? { name: company.name, kind: company.kind } : null,
      repos: repos.map((r) => ({ fullName: r.fullName, description: r.description, homepage: r.homepage, stack: r.stack, readme: r.readme, docs: r.docs, recentCommits: r.recentCommits })),
      metrics,
      others,
      liked: rated.filter((r) => r.rating > 0).map((r) => r.title),
      disliked: rated.filter((r) => r.rating < 0).map((r) => r.title),
    },
  }
}
