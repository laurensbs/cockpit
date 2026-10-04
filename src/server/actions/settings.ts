'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { getDb } from '@/db'
import { actionOwner } from '../session'
import { setSetting } from '../settings'
import type { FormState } from './types'

// Classic and fine-grained personal access tokens.
const GITHUB_TOKEN = /^(?:ghp_|github_pat_)[A-Za-z0-9_]{20,}$/

const schema = z.object({
  name: z.string().trim().max(60),
  githubToken: z.string().trim().max(300),
  clearToken: z.boolean(),
})

/** The owner's name and GitHub token. An empty token field keeps the current one; the checkbox removes it. */
export async function saveSettings(_prev: FormState, form: FormData): Promise<FormState> {
  const owner = await actionOwner()
  const parsed = schema.safeParse({ name: form.get('name') ?? '', githubToken: form.get('githubToken') ?? '', clearToken: form.get('clearToken') === '1' })
  if (!parsed.success) return { ok: false, error: 'Controleer de velden.' }
  const { name, githubToken, clearToken } = parsed.data
  if (githubToken && !GITHUB_TOKEN.test(githubToken)) return { ok: false, error: 'Dat ziet er niet uit als een GitHub-token (github_pat_… of ghp_…).' }
  const db = await getDb()
  await setSetting(db, owner.userId, 'name', name)
  if (clearToken) await setSetting(db, owner.userId, 'github_token', null)
  else if (githubToken) await setSetting(db, owner.userId, 'github_token', githubToken)
  revalidatePath('/', 'layout')
  return { ok: true, message: 'Bewaard.' }
}
