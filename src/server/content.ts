import 'server-only'
import { and, desc, eq, gte, inArray, like } from 'drizzle-orm'
import type { Db } from '@/db'
import * as s from '@/db/schema'
import { CONTENT_CHANNELS, normalizeRhythm, type Rhythm } from '@/lib/ai/playbooks'
import type { ContentProjectInput } from '@/lib/ai/prompts'
import type { Profile } from '@/lib/ai/schemas'
import { normalizeBrand } from '@/lib/brand'
import { addDays } from '@/lib/dates'
import { metricLabel } from '@/lib/metrics'
import { ACTIVE_STAGES } from '@/lib/options'
import { bottleneckLine, lessonLine, type LessonBody, outcomeStates, paceLine } from './outcome-state'

// The content week's raw material per project: its rhythm, house style, profile, growth focus,
// lessons and what was made lately. Used by Claude's brief and by the Studio.

const rhythmKey = (projectId: string) => `content_rhythm:${projectId}`

export async function rhythms(db: Db, ownerId: string, projects: { id: string; stage: string }[]): Promise<Map<string, Rhythm>> {
  const rows = projects.length
    ? await db
        .select({ key: s.setting.key, value: s.setting.value })
        .from(s.setting)
        .where(and(eq(s.setting.ownerId, ownerId), like(s.setting.key, 'content_rhythm:%')))
    : []
  const out = new Map<string, Rhythm>()
  for (const p of projects) {
    const stored = rows.find((r) => r.key === rhythmKey(p.id))?.value
    let parsed: unknown = null
    try {
      parsed = stored ? JSON.parse(stored) : null
    } catch {
      parsed = null
    }
    out.set(p.id, normalizeRhythm(parsed, p.stage))
  }
  return out
}

export const rhythmSettingKey = rhythmKey
export const rhythmTotal = (r: Rhythm) => CONTENT_CHANNELS.reduce((n, c) => n + r[c], 0)

/** Days that already have a LinkedIn post planned (his profile takes one a day at most). */
export async function plannedLinkedinDays(db: Db, ownerId: string, from: string): Promise<string[]> {
  const rows = await db
    .select({ day: s.contentItem.plannedFor })
    .from(s.contentItem)
    .where(and(eq(s.contentItem.ownerId, ownerId), eq(s.contentItem.channel, 'linkedin'), gte(s.contentItem.plannedFor, from), inArray(s.contentItem.status, ['draft', 'planned', 'approved'])))
  return rows.map((r) => r.day).filter((d): d is string => Boolean(d))
}

/** Every active project with something to post this week, as the content brief needs it. */
export async function contentProjects(db: Db, ownerId: string, today: string, only?: string): Promise<ContentProjectInput[]> {
  const projects = (
    await db
      .select({ project: s.project, color: s.company.color })
      .from(s.project)
      .leftJoin(s.company, eq(s.company.id, s.project.companyId))
      .where(eq(s.project.ownerId, ownerId))
  ).filter((r) => (only ? r.project.id === only : (ACTIVE_STAGES as readonly string[]).includes(r.project.stage)))
  if (!projects.length) return []
  const ids = projects.map((r) => r.project.id)
  const [rhythm, outcomes, profiles, lessons, recent, media] = await Promise.all([
    rhythms(db, ownerId, projects.map((r) => ({ id: r.project.id, stage: r.project.stage }))),
    outcomeStates(db, ownerId),
    db
      .select({ projectId: s.brief.projectId, content: s.brief.content })
      .from(s.brief)
      .where(and(eq(s.brief.ownerId, ownerId), eq(s.brief.kind, 'profile'), inArray(s.brief.projectId, ids)))
      .orderBy(desc(s.brief.createdAt)),
    db
      .select({ projectId: s.contentItem.projectId, title: s.contentItem.title, body: s.contentItem.body })
      .from(s.contentItem)
      .where(and(eq(s.contentItem.ownerId, ownerId), eq(s.contentItem.kind, 'lesson'), inArray(s.contentItem.projectId, ids)))
      .orderBy(desc(s.contentItem.createdAt))
      .limit(60),
    db
      .select({ projectId: s.contentItem.projectId, title: s.contentItem.title })
      .from(s.contentItem)
      .where(and(eq(s.contentItem.ownerId, ownerId), inArray(s.contentItem.kind, ['social', 'forum']), gte(s.contentItem.createdAt, new Date(`${addDays(today, -45)}T00:00:00Z`))))
      .orderBy(desc(s.contentItem.createdAt))
      .limit(400),
    db
      .select({ id: s.mediaAsset.id, projectId: s.mediaAsset.projectId, role: s.mediaAsset.role, description: s.mediaAsset.description })
      .from(s.mediaAsset)
      .where(and(eq(s.mediaAsset.ownerId, ownerId), eq(s.mediaAsset.origin, 'upload'), inArray(s.mediaAsset.projectId, ids)))
      .orderBy(desc(s.mediaAsset.createdAt))
      .limit(200),
  ])
  return projects
    .map(({ project: p, color }) => {
      const profile = profiles.find((b) => b.projectId === p.id)?.content as Profile | undefined
      const o = outcomes.get(p.id)
      const b = o?.funnel?.bottleneck
      const focusKey = b && 'key' in b ? b.key : b?.kind === 'step' ? b.to : null
      return {
        id: p.id,
        name: p.name,
        stage: p.stage,
        language: p.languages[0] ?? 'nl',
        oneLiner: profile?.oneLiner || p.oneLiner,
        audience: p.audience,
        tone: profile?.tone || p.tone,
        pillars: profile?.pillars ?? [],
        redLines: p.redLines,
        siteUrl: p.siteUrl,
        handle: normalizeBrand(p.brand, color).handle,
        rhythm: rhythm.get(p.id) ?? normalizeRhythm(null, p.stage),
        growth: o?.model && o.pace ? `${paceLine(o.model, o.pace)}${bottleneckLine(o) ? `; ${bottleneckLine(o)}` : ''}` : null,
        focus: focusKey ? `${focusKey} (${metricLabel(focusKey)})` : null,
        lessons: lessons
          .filter((l) => l.projectId === p.id)
          .slice(0, 5)
          .map((l) => lessonLine(l.title, l.body as LessonBody)),
        pastTitles: recent
          .filter((r) => r.projectId === p.id)
          .slice(0, 25)
          .map((r) => r.title),
        media: media
          .filter((m) => m.projectId === p.id)
          .slice(0, 30)
          .map((m) => ({ id: m.id, kind: m.role, description: m.description || 'zonder beschrijving' })),
      }
    })
    .filter((p) => only || rhythmTotal(p.rhythm) > 0)
}

/** For Vandaag: how many items wait for his approval, and how many are due today. */
export async function contentWeekSummary(db: Db, ownerId: string, today: string): Promise<{ ready: number; dueToday: number }> {
  const rows = await db
    .select({ status: s.contentItem.status, day: s.contentItem.plannedFor, body: s.contentItem.body })
    .from(s.contentItem)
    .where(and(eq(s.contentItem.ownerId, ownerId), inArray(s.contentItem.kind, ['social', 'forum']), inArray(s.contentItem.status, ['draft', 'approved']), gte(s.contentItem.plannedFor, today)))
  const week = rows.filter((r) => (r.body as { week?: boolean }).week && (r.day ?? '') <= addDays(today, 13))
  return {
    ready: week.filter((r) => r.status === 'draft' && !(r.body as { forum?: unknown }).forum && (r.body as { render?: { status?: string } }).render?.status === 'done').length,
    dueToday: week.filter((r) => r.status === 'approved' && r.day === today).length,
  }
}
