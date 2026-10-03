import 'server-only'
import { and, desc, eq, isNull } from 'drizzle-orm'
import type { Db } from '@/db'
import * as s from '@/db/schema'
import { weeklyFromJson } from '@/lib/ai/schemas'
import { renderEmail } from '@/lib/email-layout'
import { siteUrl } from '@/lib/site'
import { sendEmail } from './email'
import { playerStats, projectPulses } from './game'

/** Monday's mail to the owner: level, streak, what needs attention, and the focus when there is one. */
export async function sendWeeklyDigest(db: Db, owner: { userId: string; email: string; name: string }): Promise<boolean> {
  const [stats, pulses, open, [brief]] = await Promise.all([
    playerStats(db, owner.userId),
    projectPulses(db, owner.userId),
    db.select({ id: s.quest.id }).from(s.quest).where(and(eq(s.quest.ownerId, owner.userId), eq(s.quest.status, 'open'))),
    db
      .select()
      .from(s.brief)
      .where(and(eq(s.brief.ownerId, owner.userId), eq(s.brief.kind, 'weekly'), isNull(s.brief.projectId)))
      .orderBy(desc(s.brief.createdAt))
      .limit(1),
  ])
  const weekly = brief ? weeklyFromJson(brief.content) : null
  const attention = pulses.slice(0, 3).map((p) => `${p.name}: ${p.health.score}/100${p.health.tips[0] ? ` (${p.health.tips[0].toLowerCase()})` : ''}`)
  const paragraphs = [
    `Level ${stats.level.level} (${stats.level.title}), ${stats.totalXp} XP. Actiestreak: ${stats.actionStreak.length} dagen. Open quests: ${open.length}.`,
    ...(weekly ? [`Focus: ${weekly.headline}`, ...weekly.focus.map((f) => `• ${f.project}: ${f.firstStep}`), `Boss van de week: ${weekly.boss.title}`] : []),
    ...(attention.length ? ['Waar aandacht het meest oplevert:', ...attention.map((a) => `• ${a}`)] : []),
  ]
  const { html, text } = renderEmail({
    heading: `Goedemorgen ${owner.name.split(' ')[0]}, je week`,
    paragraphs,
    cta: { label: 'Open de cockpit', url: siteUrl() },
    footer: 'Deze mail komt van je eigen cockpit, elke maandag. Zet hem uit door RESEND_API_KEY of EMAIL_FROM uit Vercel te halen.',
  })
  return sendEmail({ to: owner.email, subject: 'Je week in de cockpit', html, text })
}
