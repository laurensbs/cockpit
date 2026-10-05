'use server'

import { and, eq } from 'drizzle-orm'
import { revalidatePath } from 'next/cache'
import { getDb } from '@/db'
import * as s from '@/db/schema'
import { expectedToken } from '@/lib/local'
import { connectClaudeCode, launchPrompt, mcpUrl, openTerminal } from '../claude'
import { setKeepAwakeSetting } from '../keep-awake'
import { isPortfolioTask, isTaskKind, TaskOptions } from '../mcp/tasks'
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
  if (!isPortfolioTask(task, Boolean(projectId))) {
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

/** The autopilot: on Monday morning Claude Code makes the weekly focus by itself. */
export async function setAutopilot(on: boolean): Promise<void> {
  const owner = await actionOwner()
  await setSetting(await getDb(), owner.userId, 'autopilot_weekly', on ? '1' : null)
  revalidatePath('/settings')
}

/** "Aan laten staan": keep the computer awake on mains power while the cockpit is open. */
export async function setKeepAwake(on: boolean): Promise<void> {
  const owner = await actionOwner()
  await setKeepAwakeSetting(await getDb(), owner.userId, on)
  revalidatePath('/settings')
}

/** The content autopilot: on Monday morning Claude Code makes the content week by itself. */
export async function setContentAutopilot(on: boolean): Promise<void> {
  const owner = await actionOwner()
  await setSetting(await getDb(), owner.userId, 'autopilot_content', on ? '1' : null)
  revalidatePath('/settings')
  revalidatePath('/studio')
}

