import 'server-only'
import { exec, spawn } from 'node:child_process'
import { appendFileSync, existsSync, mkdirSync } from 'node:fs'
import { homedir } from 'node:os'
import { dirname } from 'node:path'
import { fixturesAllowed } from './status'

// Claude Code is the brain of the cockpit: it runs on the owner's own Claude account. The cockpit
// never calls a model itself; it opens Claude Code with a task and gets the result back through MCP.

const run = (command: string, timeout = 8_000) =>
  new Promise<{ ok: boolean; out: string }>((resolve) => {
    exec(command, { timeout, windowsHide: true }, (error, stdout, stderr) => resolve({ ok: !error, out: `${stdout}\n${stderr}`.trim() }))
  })

let versionCache: { at: number; version: string | null } | null = null

/** "2.1.288" when Claude Code is installed and on the PATH, else null. Looked up once a minute. */
export async function claudeVersion(): Promise<string | null> {
  if (versionCache && Date.now() - versionCache.at < 60_000) return versionCache.version
  const r = await run('claude --version')
  const version = r.ok ? (r.out.match(/\d+\.\d+\.\d+/)?.[0] ?? r.out.slice(0, 40)) : null
  versionCache = { at: Date.now(), version }
  return version
}

/** Where Claude Code finds the cockpit. */
export const mcpUrl = () => `http://127.0.0.1:${process.env.PORT ?? 3000}/api/mcp`

/** The command that registers the cockpit with Claude Code, for the owner's own account on this computer. */
export const connectCommand = (token: string) => `claude mcp add --transport http --scope user cockpit ${mcpUrl()} --header "Authorization: Bearer ${token}"`

/** The same connection for the Claude desktop app (claude_desktop_config.json), through the mcp-remote bridge. */
export const desktopConfig = (token: string) =>
  JSON.stringify({ mcpServers: { cockpit: { command: 'npx', args: ['-y', 'mcp-remote', mcpUrl(), '--header', `Authorization: Bearer ${token}`] } } }, null, 2)

/** What Claude Code is told when a button opens it: just the ticket; the task comes through MCP. */
export const launchPrompt = (ticket: string) => `Haal met de cockpit-tool get_task de taak met ticket ${ticket} op en voer die uit.`

/** Only letters, digits and plain punctuation go into a command line (no ";": Windows Terminal splits on it). */
export const cleanPrompt = (text: string) =>
  text
    .replace(/[^\p{L}\p{N} .,:()_/-]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 300)

const CLAUDE_ARGS = '--allowedTools mcp__cockpit'

export interface LaunchOutcome {
  launched: boolean
  command: string
  error?: string
}

/** In tests, the command is written to a file instead of opening a terminal; never in the packaged app. */
const fakeTerminal = () => (fixturesAllowed() ? process.env.COCKPIT_FAKE_TERMINAL : undefined)

function record(file: string, entry: Record<string, unknown>): void {
  mkdirSync(dirname(file), { recursive: true })
  appendFileSync(file, `${JSON.stringify({ ...entry, at: new Date().toISOString() })}\n`)
}

const quoteWin = (value: string) => `"${value.replace(/"/g, '')}"`

/**
 * Opens a terminal window that starts Claude Code with the prompt, in the project's folder when it
 * has one. Returns the command as well, so the page can show it when no window could be opened.
 */
export async function openTerminal(prompt: string, cwd: string | null): Promise<LaunchOutcome> {
  const command = `claude ${CLAUDE_ARGS} "${cleanPrompt(prompt)}"`
  const dir = cwd && existsSync(cwd) ? cwd : homedir()
  const fake = fakeTerminal()
  if (fake) {
    record(fake, { command, cwd: dir })
    return { launched: true, command }
  }
  try {
    if (process.platform === 'win32') {
      const line = (await run('where wt')).ok
        ? `wt -w new -d ${quoteWin(dir)} cmd /k ${command}`
        : `start "Cockpit - Claude Code" /d ${quoteWin(dir)} cmd /k ${command}`
      spawn(line, { shell: true, detached: true, stdio: 'ignore', windowsHide: false }).unref()
      return { launched: true, command }
    }
    if (process.platform === 'darwin') {
      const script = `cd ${JSON.stringify(dir)} && ${command}`
      spawn('osascript', ['-e', `tell application "Terminal" to do script ${JSON.stringify(script)}`], { detached: true, stdio: 'ignore' }).unref()
      return { launched: true, command }
    }
    for (const terminal of ['x-terminal-emulator', 'gnome-terminal', 'konsole', 'xterm']) {
      if (!(await run(`command -v ${terminal}`)).ok) continue
      spawn(terminal, ['-e', 'bash', '-lc', `cd ${JSON.stringify(dir)} && ${command}; exec bash`], { detached: true, stdio: 'ignore' }).unref()
      return { launched: true, command }
    }
    return { launched: false, command, error: 'Geen terminal gevonden.' }
  } catch {
    return { launched: false, command, error: 'Het terminalvenster wilde niet openen.' }
  }
}

/** Registers the cockpit with Claude Code (user scope), replacing an older registration. */
export async function connectClaudeCode(token: string): Promise<{ ok: boolean; message: string }> {
  if (!/^[A-Za-z0-9_-]+$/.test(token)) return { ok: false, message: 'De toegangscode bevat tekens die niet in een commando passen.' }
  const command = connectCommand(token)
  const fake = fakeTerminal()
  if (fake) {
    record(fake, { command: command.replace(token, '<token>') })
    return { ok: true, message: 'Gekoppeld (test).' }
  }
  if (!(await claudeVersion())) return { ok: false, message: 'Claude Code is niet gevonden op deze computer.' }
  await run('claude mcp remove --scope user cockpit')
  const r = await run(command, 20_000)
  return r.ok
    ? { ok: true, message: 'Claude Code kent de cockpit nu. Een nieuwe Claude Code-sessie ziet de tools meteen.' }
    : { ok: false, message: r.out.slice(0, 300) || 'Koppelen lukte niet.' }
}
