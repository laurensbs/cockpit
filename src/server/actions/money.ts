'use server'

import { and, eq } from 'drizzle-orm'
import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { getDb } from '@/db'
import * as s from '@/db/schema'
import { CURRENCIES, MONEY_KINDS, MONEY_PERIODS, type MoneyPeriod, nextAfter } from '@/lib/finance'
import { addMoney, changeMoney } from '../finance'
import { actionOwner } from '../session'
import type { FormState } from './types'
import { award } from '../xp'

const refresh = () => {
  revalidatePath('/geld')
  revalidatePath('/')
}

async function ownItem(ownerId: string, id: string) {
  const [row] = await (await getDb())
    .select()
    .from(s.moneyItem)
    .where(and(eq(s.moneyItem.id, String(id)), eq(s.moneyItem.ownerId, ownerId)))
  return row ?? null
}

/**
 * The money step in his day, or a button on the money page:
 * - done: renewed or filed; a thing that comes back moves to its next date, a one-time thing is finished;
 * - stop: cancelled, or he does not want it;
 * - yes: a proposal he says yes to becomes a cost he pays.
 * Paying itself is always his, outside the cockpit.
 */
export async function moneyStep(id: string, action: 'done' | 'stop' | 'yes'): Promise<{ ok: boolean; message: string; xp: number }> {
  const owner = await actionOwner()
  const item = await ownItem(owner.userId, id)
  if (!item) return { ok: false, message: 'Die regel bestaat niet meer.', xp: 0 }
  const db = await getDb()
  const period = item.period as MoneyPeriod
  if (action === 'stop') {
    await changeMoney(db, owner.userId, item.id, { status: 'stopped' })
    refresh()
    return { ok: true, message: item.kind === 'plan' ? 'Niet doen: weg van je lijst.' : 'Gestopt: telt niet meer mee.', xp: 0 }
  }
  if (action === 'yes') {
    await changeMoney(db, owner.userId, item.id, { kind: 'cost', status: 'active' })
    refresh()
    return { ok: true, message: 'Genoteerd als kosten. Betalen doe je zelf.', xp: 0 }
  }
  const next = item.nextDate ? nextAfter(item.nextDate, period) : null
  await changeMoney(db, owner.userId, item.id, next ? { nextDate: next } : item.kind === 'deadline' ? { status: 'stopped', nextDate: null } : { nextDate: null })
  const xp = await award(db, owner.userId, { kind: 'quest', refId: `money:${item.id}:${item.nextDate ?? 'x'}`, projectId: item.projectId, xp: 15 })
  refresh()
  return { ok: true, message: next ? `Geregeld. De volgende keer: ${next}.` : 'Geregeld.', xp }
}

const MoneyForm = z.object({
  kind: z.enum(MONEY_KINDS),
  title: z.string().trim().min(2).max(120),
  amount: z
    .string()
    .trim()
    .transform((v) => (v ? Number(v.replace(/\./g, '').replace(',', '.')) : null))
    .refine((v) => v === null || (Number.isFinite(v) && v >= 0 && v <= 1_000_000)),
  currency: z.enum(CURRENCIES),
  period: z.enum(MONEY_PERIODS),
  nextDate: z
    .string()
    .trim()
    .refine((v) => !v || /^\d{4}-\d{2}-\d{2}$/.test(v))
    .transform((v) => v || null),
  projectId: z
    .string()
    .trim()
    .transform((v) => v || null),
  note: z.string().trim().max(300),
})

const field = (form: FormData, name: string) => String(form.get(name) ?? '')

/** A line he adds or changes himself on the money page; from then on it is his. */
export async function saveMoneyItem(_prev: FormState, form: FormData): Promise<FormState> {
  const owner = await actionOwner()
  const parsed = MoneyForm.safeParse({
    kind: field(form, 'kind'),
    title: field(form, 'title'),
    amount: field(form, 'amount'),
    currency: field(form, 'currency') || 'EUR',
    period: field(form, 'period'),
    nextDate: field(form, 'nextDate'),
    projectId: field(form, 'projectId'),
    note: field(form, 'note'),
  })
  if (!parsed.success) return { ok: false, error: 'Vul een naam in (minstens 2 tekens) en een geldig bedrag, of laat het bedrag leeg.' }
  const db = await getDb()
  const v = parsed.data
  if (v.projectId) {
    const [p] = await db.select({ id: s.project.id }).from(s.project).where(and(eq(s.project.id, v.projectId), eq(s.project.ownerId, owner.userId)))
    if (!p) return { ok: false, error: 'Dat project bestaat niet.' }
  }
  const id = field(form, 'id')
  if (id) {
    if (!(await ownItem(owner.userId, id))) return { ok: false, error: 'Die regel bestaat niet meer.' }
    await changeMoney(db, owner.userId, id, { kind: v.kind, title: v.title, amount: v.amount, currency: v.currency, period: v.period, nextDate: v.nextDate, projectId: v.projectId, note: v.note })
  } else {
    await addMoney(db, owner.userId, { ...v, status: v.kind === 'plan' ? 'proposed' : 'active' })
  }
  refresh()
  return { ok: true, message: id ? 'Aangepast.' : 'Toegevoegd.' }
}

/** Takes a stopped line back, or removes a line that was wrong. */
export async function moneyStatus(id: string, status: 'active' | 'proposed' | 'delete'): Promise<{ ok: boolean }> {
  const owner = await actionOwner()
  const item = await ownItem(owner.userId, id)
  if (!item) return { ok: false }
  const db = await getDb()
  if (status === 'delete') await db.delete(s.moneyItem).where(eq(s.moneyItem.id, item.id))
  else await changeMoney(db, owner.userId, item.id, { status })
  refresh()
  return { ok: true }
}
