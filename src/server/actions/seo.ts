'use server'

import { and, eq } from 'drizzle-orm'
import { revalidatePath } from 'next/cache'
import { getDb } from '@/db'
import * as s from '@/db/schema'
import { addResult } from '@/lib/visibility'
import { seenHistory } from '../seo'
import { actionOwner } from '../session'
import { setSetting } from '../settings'
import { award } from '../xp'

/** "Word je gevonden?": how many of this month's questions named his business. Claude reads it next time. */
export async function saveSeen(projectId: string, month: string, asked: number, named: number): Promise<{ ok: boolean; message: string; xp: number }> {
  const owner = await actionOwner()
  if (!/^\d{4}-\d{2}$/.test(month) || !Number.isInteger(asked) || !Number.isInteger(named) || asked < 1 || asked > 5 || named < 0 || named > asked) return { ok: false, message: 'Dat klopt niet.', xp: 0 }
  const db = await getDb()
  const [p] = await db.select({ id: s.project.id }).from(s.project).where(and(eq(s.project.id, String(projectId)), eq(s.project.ownerId, owner.userId)))
  if (!p) return { ok: false, message: 'Dat project bestaat niet.', xp: 0 }
  const history = addResult(await seenHistory(db, owner.userId, p.id), { month, asked, named })
  await setSetting(db, owner.userId, `seen_${p.id}`, JSON.stringify(history))
  const xp = await award(db, owner.userId, { kind: 'quest', refId: `seen:${p.id}:${month}`, projectId: p.id, xp: 15 })
  revalidatePath('/')
  revalidatePath('/studio')
  const before = history[1]
  const message = named
    ? `Genoemd bij ${named} van ${asked}${before ? ` (vorige maand ${before.named})` : ''}. Claude schrijft eerst voor de vragen waar je nog niet staat.`
    : 'Nog nergens genoemd. Dat is normaal in het begin: Claude schrijft eerst voor deze vragen.'
  return { ok: true, message, xp }
}
