import { execFile } from 'node:child_process'
import { join } from 'node:path'

// A Mac app started from Finder or the Dock gets a bare PATH (/usr/bin:/bin:/usr/sbin:/sbin), so it
// would not find `claude` or `gh`. This builds the PATH a terminal would have.

/** Where Claude Code, Homebrew and npm usually put their commands on a Mac. */
export function knownBinDirs(home: string): string[] {
  return [join(home, '.local', 'bin'), join(home, '.claude', 'local'), '/opt/homebrew/bin', '/usr/local/bin', join(home, '.npm-global', 'bin')]
}

/** The known folders first, then the login shell's PATH, then what the app already had; no doubles, no empties. */
export function mergePath(home: string, shellPath: string | null, current: string | undefined): string {
  const parts = [...knownBinDirs(home), ...(shellPath ?? '').split(':'), ...(current ?? '').split(':')].map((p) => p.trim()).filter(Boolean)
  return [...new Set(parts)].join(':')
}

/** The PATH of his login shell, or null when it cannot be read within three seconds. */
export function loginShellPath(shell = process.env.SHELL || '/bin/zsh'): Promise<string | null> {
  return new Promise((resolve) => {
    execFile(shell, ['-ilc', 'printf "%s" "$PATH"'], { timeout: 3_000, encoding: 'utf8' }, (error, stdout) => {
      const path = (stdout ?? '').trim().split('\n').pop() ?? ''
      resolve(!error && path.includes('/') ? path : null)
    })
  })
}
