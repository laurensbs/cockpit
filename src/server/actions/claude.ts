'use server'

import { and, eq } from 'drizzle-orm'
import { revalidatePath } from 'next/cache'
import { getDb } from '@/db'
import * as s from '@/db/schema'
import { expectedToken } from '@/lib/local'
import { claudeLoggedIn, connectClaudeCode, launchPrompt, mcpUrl, openTerminal, runHeadless } from '../claude'
import { isTaskKind, TaskOptions } from '../mcp/tasks'
import { createTicket } from '../mcp/tickets'
import { actionOwner } from '../session'
import { setSetting } from '../settings'

export interface LaunchResult {
  ok: boolean
  launched?: boolean
  command?: string
  ticket?: string
  error?: string
}

/** A button was pressed: make a ticket for the task and open Claude Code with it. */
export async function openInClaude(task: string, projectId: string | null, options: Record<string, unknown> = {}): Promise<LaunchResult> {
  const owner = await actionOwner()
  if (!isTaskKind(task)) return { ok: false, error: 'Onbekende taak.' }
  const parsed = TaskOptions.safeParse(options)
  if (!parsed.success) return { ok: false, error: 'Die keuzes kloppen niet.' }
  if (task === 'ask' && !parsed.data.question) return { ok: false, error: 'Wat wil je Claude vragen?' }
  let cwd: string | null = null
  let id: string | null = null
  if (task !== 'weekly' && !(task === 'ask' && !projectId)) {
    const db = await getDb()
    const [project] = await db
      .select({ id: s.project.id, localPath: s.project.localPath })
      .from(s.project)
      .where(and(eq(s.project.id, String(projectId)), eq(s.project.ownerId, owner.userId)))
    if (!project) return { ok: false, error: 'Dit project bestaat niet.' }
    id = project.id
    cwd = project.localPath
  }
  const ticket = createTicket({ task, projectId: id, options: parsed.data })
  const outcome = await openTerminal(launchPrompt(ticket), cwd)
  return { ok: true, ticket, ...outcome }
}

/** Registers the cockpit's MCP server with Claude Code on this computer. */
export async function connectClaude(): Promise<{ ok: boolean; message: string }> {
  const owner = await actionOwner()
  const token = expectedToken()
  if (!token) return { ok: false, message: 'De cockpit heeft geen toegangscode.' }
  const result = await connectClaudeCode(token)
  if (result.ok) {
    const db = await getDb()
    await setSetting(db, owner.userId, 'claude_connected', new Date().toISOString())
    await setSetting(db, owner.userId, 'claude_url', mcpUrl())
  }
  revalidatePath('/settings')
  return result
}

/** The autopilot: on Monday morning the weekly focus, and on working days a post about what he built. */
export async function setAutopilot(on: boolean): Promise<void> {
  const owner = await actionOwner()
  await setSetting(await getDb(), owner.userId, 'autopilot_weekly', on ? '1' : '0')
  revalidatePath('/settings')
}

/** Tasks that need to search or read the web. */
const WEB_TASKS = new Set(['opportunities', 'seo', 'prospect'])

/**
 * The day route's buttons: Claude does the task in the background, without a terminal window; the
 * result appears on the page when it lands. For a layperson that is one tap and nothing to watch.
 */
export async function runInBackground(task: string, projectId: string, options: Record<string, unknown> = {}): Promise<{ ok: boolean; message: string }> {
  const owner = await actionOwner()
  if (!isTaskKind(task) || task === 'ask') return { ok: false, message: 'Onbekende taak.' }
  const parsed = TaskOptions.safeParse(options)
  if (!parsed.success) return { ok: false, message: 'Die keuzes kloppen niet.' }
  const db = await getDb()
  const [project] = await db
    .select({ id: s.project.id })
    .from(s.project)
    .where(and(eq(s.project.id, String(projectId)), eq(s.project.ownerId, owner.userId)))
  if (!project) return { ok: false, message: 'Dit project bestaat niet.' }
  const ticket = createTicket({ task, projectId: project.id, options: parsed.data })
  const { started } = await runHeadless(launchPrompt(ticket), { web: WEB_TASKS.has(task) })
  return started ? { ok: true, message: 'Claude is ermee bezig. Het verschijnt hier vanzelf.' } : { ok: false, message: 'Claude Code kon niet starten.' }
}

/**
 * After he logged in again: forget that today's background work was started (it failed), and start it
 * again (the weekly focus on Monday, the posts, the search for businesses).
 */
export async function retryBackgroundToday(): Promise<{ ok: boolean; message: string }> {
  const owner = await actionOwner()
  if ((await claudeLoggedIn()) === false) return { ok: false, message: 'Claude Code is nog niet ingelogd. Typ in Terminal claude en dan /login.' }
  const db = await getDb()
  const { maybeAutopilot, maybeBuildPosts, maybeProspect } = await import('../autopilot')
  const projects = await db.select({ id: s.project.id }).from(s.project).where(eq(s.project.ownerId, owner.userId))
  for (const p of projects) {
    await setSetting(db, owner.userId, `build_post_${p.id}`, null)
    await setSetting(db, owner.userId, `prospect_day_${p.id}`, null)
  }
  await setSetting(db, owner.userId, 'autopilot_week', null)
  const [weekly, prospects, posts] = await Promise.all([maybeAutopilot(db, owner.userId), maybeProspect(db, owner.userId), maybeBuildPosts(db, owner.userId)])
  revalidatePath('/')
  const started = (weekly === 'started' ? 1 : 0) + prospects.started.length + posts.length
  return { ok: true, message: started ? `Claude is opnieuw begonnen (${started} ${started === 1 ? 'klus' : 'klussen'}).` : 'Er stond vandaag niets meer klaar om te doen.' }
}
