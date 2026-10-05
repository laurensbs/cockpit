// Keeping the cockpit's knowledge of a project current: when he pushed to one of its repos or changed
// its STAND.md, Claude reads what is new and updates the intake (a new name, offer, stage). Pure, so the
// choice can be tested; src/server/knowledge.ts starts the work.

export interface KnowledgeStamp {
  /** What the knowledge was last read from: the newest push and the STAND.md's change time. */
  sig: string
  at: string
}

/** At most one refresh per project in three hours, however often he pushes. */
export const REFRESH_GAP_MS = 3 * 3_600_000

/** One string for "what there is to read": empty when the project has no repo and no STAND.md. */
export function knowledgeSig(pushedAts: readonly (Date | null)[], compassChangedAt: number | null): string {
  const pushed = Math.max(0, ...pushedAts.map((d) => d?.getTime() ?? 0))
  if (!pushed && !compassChangedAt) return ''
  return `${pushed}|${Math.round(compassChangedAt ?? 0)}`
}

export function parseStamp(value: string | null): KnowledgeStamp | null {
  if (!value) return null
  try {
    const v = JSON.parse(value) as Partial<KnowledgeStamp>
    return typeof v.sig === 'string' && typeof v.at === 'string' ? { sig: v.sig, at: v.at } : null
  } catch {
    return null
  }
}

/** New since the last read (or never read), and the last read is long enough ago. */
export function refreshDue(stored: KnowledgeStamp | null, sig: string, now: Date): boolean {
  if (!sig) return false
  if (!stored) return true
  if (stored.sig === sig) return false
  return now.getTime() - new Date(stored.at).getTime() >= REFRESH_GAP_MS
}
