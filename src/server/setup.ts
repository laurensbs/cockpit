import 'server-only'
import type { Db } from '@/db'
import { claudeVersion } from './claude'
import { mailStatus } from './outbox-views'
import { getSetting, githubTokenSource } from './settings'
import { fixturesAllowed, githubStatus } from './status'

export interface SetupStep {
  key: 'claude' | 'connected' | 'github' | 'projects' | 'mail'
  title: string
  hint: string
  href: string
  done: boolean
  optional?: boolean
}

export interface ClaudeState {
  installed: boolean
  version: string | null
  connected: boolean
}

/** Is Claude Code there, and does it know the cockpit. In the tests the fake terminal stands in for it. */
export async function claudeState(db: Db, ownerId: string): Promise<ClaudeState> {
  const fake = fixturesAllowed() && Boolean(process.env.COCKPIT_FAKE_TERMINAL)
  const [version, connectedAt] = await Promise.all([fake ? Promise.resolve('test') : claudeVersion(), getSetting(db, ownerId, 'claude_connected')])
  return { installed: Boolean(version), version, connected: Boolean(version) && Boolean(connectedAt) }
}

/** What is left before the cockpit works on its own: shown on Vandaag until the required steps are done. */
export async function setupSteps(db: Db, ownerId: string, projects: number): Promise<SetupStep[]> {
  const [claude, github, mail] = await Promise.all([claudeState(db, ownerId), githubTokenSource(db, ownerId), mailStatus(db, ownerId)])
  return [
    { key: 'claude', title: 'Claude Code installeren', hint: 'Het brein: draait op je eigen Claude-abonnement.', href: '/settings#claude', done: claude.installed },
    { key: 'connected', title: 'Claude Code koppelen', hint: 'Eén klik; daarna ziet Claude je projecten.', href: '/settings#claude', done: claude.connected },
    { key: 'github', title: 'GitHub koppelen', hint: 'Een token met alleen leesrechten, of je login van de GitHub CLI.', href: '/settings#you', done: githubStatus(github.token) !== 'off' },
    { key: 'projects', title: 'Projecten binnenhalen', hint: 'Al je repo’s in één keer, gegroepeerd tot projecten.', href: '/github', done: projects > 0 },
    { key: 'mail', title: 'Mailbox koppelen', hint: 'Dan gaan goedgekeurde mails vanzelf de deur uit.', href: '/settings#mail', done: mail.ready && mail.enabled, optional: true },
  ]
}
