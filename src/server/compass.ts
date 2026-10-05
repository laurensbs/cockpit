import 'server-only'
import { existsSync, readFileSync, realpathSync, statSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'
import { type Compass, compassFrom } from '@/lib/compass'
import { redactSecrets } from '@/lib/redact'

// Reads the STAND.md of a project, read-only: in its code folder, or in ~/Projecten/<name> (also by
// its first word: "OSRS RSPS" → ~/Projecten/OSRS). Only that one file, only inside his home folder.

const MAX_BYTES = 200_000

export function compassFile(project: { name: string; localPath: string | null }): string | null {
  const home = homedir()
  const hub = join(home, 'Projecten')
  const dirs = [project.localPath, join(hub, project.name), join(hub, project.name.split(/\s+/)[0])].filter((d): d is string => Boolean(d))
  for (const dir of dirs) {
    const file = join(dir.replace(/^~(?=$|\/)/, home), 'STAND.md')
    try {
      if (!existsSync(/*turbopackIgnore: true*/ file)) continue
      const real = realpathSync(/*turbopackIgnore: true*/ file)
      if (!real.startsWith(`${home}/`) || statSync(/*turbopackIgnore: true*/ real).size > MAX_BYTES) continue
      return real
    } catch {
      continue
    }
  }
  return null
}

export function readCompass(project: { name: string; localPath: string | null }): (Compass & { source: string }) | null {
  if (process.env.COCKPIT_NO_COMPASS === '1') return null
  const file = compassFile(project)
  if (!file) return null
  try {
    const compass = compassFrom(redactSecrets(readFileSync(/*turbopackIgnore: true*/ file, 'utf8')))
    return { ...compass, source: file.replace(homedir(), '~') }
  } catch {
    return null
  }
}

/** When his STAND.md last changed (ms), to notice that there is something new to read; null without one. */
export function compassStamp(project: { name: string; localPath: string | null }): number | null {
  if (process.env.COCKPIT_NO_COMPASS === '1') return null
  const file = compassFile(project)
  try {
    return file ? statSync(/*turbopackIgnore: true*/ file).mtimeMs : null
  } catch {
    return null
  }
}
