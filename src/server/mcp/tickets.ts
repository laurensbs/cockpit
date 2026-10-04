import 'server-only'
import { randomBytes } from 'node:crypto'
import type { TaskKind, TaskOptions } from './tasks'

export interface Ticket {
  task: TaskKind
  projectId: string | null
  options: TaskOptions
  createdAt: number
}

const TTL_MS = 2 * 60 * 60 * 1000

/**
 * A button in the cockpit makes a ticket and opens Claude Code with just its number; Claude asks the
 * cockpit for the task behind it. The choices (platform, language, a note) never have to travel
 * through a command line. Tickets live in memory for two hours: a launch is used within seconds.
 */
const tickets = ((globalThis as unknown as { __cockpitTickets?: Map<string, Ticket> }).__cockpitTickets ??= new Map())

export function createTicket(ticket: Omit<Ticket, 'createdAt'>): string {
  for (const [id, t] of tickets) if (Date.now() - t.createdAt > TTL_MS) tickets.delete(id)
  const id = randomBytes(4).toString('hex')
  tickets.set(id, { ...ticket, createdAt: Date.now() })
  return id
}

/** The ticket, as long as it is fresh. Reading it does not use it up: Claude may ask twice. */
export function readTicket(id: string): Ticket | null {
  const t = tickets.get(id.trim().toLowerCase())
  return t && Date.now() - t.createdAt <= TTL_MS ? t : null
}
