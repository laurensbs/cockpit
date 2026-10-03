import 'server-only'
import Anthropic from '@anthropic-ai/sdk'
import { betaZodOutputFormat } from '@anthropic-ai/sdk/helpers/beta/zod'
import { eq } from 'drizzle-orm'
import { after } from 'next/server'
import { getDb, type Db } from '@/db'
import * as s from '@/db/schema'
import { FIXTURE_USAGE } from '@/lib/ai/fixtures'
import { costMicros, estimateTokens, priceOf, worstCaseMicros, type MessageUsage } from '@/lib/ai/pricing'
import { projectContext, SYSTEM_PROMPT } from '@/lib/ai/prompts'
import { aiStatus } from '../status'
import { award } from '../xp'
import { reserveRun, type Refusal } from './budget'
import { anthropic, FALLBACK_BETA, MODEL } from './client'
import { loadJobContext, type JobContext } from './context'
import { JOBS, type Job, type JobKind } from './jobs'

const REFUSALS: Record<Refusal, string> = {
  budget: 'Het AI-budget van deze maand is op. Verhoog AI_MONTHLY_BUDGET_USD als je meer wilt.',
  daily: 'Voor vandaag is genoeg uitgegeven (een vijfde van het maandbudget). Morgen weer.',
  busy: 'Dit loopt al. Even geduld.',
}

function prompts(job: Job, ctx: JobContext) {
  const context = projectContext(ctx.input)
  const task = job.task(ctx)
  return { context, task, inputTokens: estimateTokens(SYSTEM_PROMPT + context + task) }
}

/** What a run will roughly cost (shown on the button), and the most it can cost (reserved). */
export function estimate(job: Job, ctx: JobContext): { typicalMicros: number; worstMicros: number } {
  const { inputTokens } = prompts(job, ctx)
  const price = priceOf(MODEL)
  return {
    typicalMicros: Math.ceil(inputTokens * price.input + job.typicalOutput * price.output),
    worstMicros: worstCaseMicros(inputTokens, job.maxTokens),
  }
}

/** Starts a job for a project: reserves the budget, then runs after the response has gone out. */
export async function startJob(ownerId: string, kind: JobKind, projectId: string): Promise<{ runId: string } | { error: string }> {
  if (aiStatus() === 'off') return { error: 'Claude is nog niet gekoppeld: zet ANTHROPIC_API_KEY in Vercel.' }
  const db = await getDb()
  const ctx = await loadJobContext(db, ownerId, projectId)
  if (!ctx) return { error: 'Dit project bestaat niet.' }
  const job = JOBS[kind] as Job
  const reserved = await reserveRun(db, { ownerId, projectId, kind, model: MODEL, worstMicros: estimate(job, ctx).worstMicros, options: {} })
  if ('refusal' in reserved) return { error: REFUSALS[reserved.refusal] }
  after(() => executeRun(reserved.runId))
  return { runId: reserved.runId }
}

function apiErrorText(error: unknown): string {
  if (error instanceof Anthropic.AuthenticationError) return 'De API-key van Anthropic klopt niet (meer).'
  if (error instanceof Anthropic.PermissionDeniedError) return 'Deze API-key mag dit model niet gebruiken.'
  if (error instanceof Anthropic.RateLimitError) return 'Claude is even druk. Probeer het over een minuut opnieuw.'
  if (error instanceof Anthropic.InternalServerError) return 'Claude had een storing. Probeer het later opnieuw.'
  if (error instanceof Anthropic.BadRequestError) return 'Claude begreep het verzoek niet.'
  if (error instanceof Anthropic.APIConnectionTimeoutError || (error instanceof Error && error.name === 'AbortError')) return 'Geen antwoord binnen de tijd.'
  if (error instanceof Anthropic.APIError) return `Claude gaf een fout (${error.status ?? '?'}).`
  return 'Er ging iets mis bij het maken.'
}

async function finish(db: Db, runId: string, values: Partial<typeof s.aiRun.$inferInsert>) {
  await db
    .update(s.aiRun)
    .set({ ...values, reservedMicros: 0, finishedAt: new Date() })
    .where(eq(s.aiRun.id, runId))
}

/**
 * Calls Claude (or the fixture), records what it cost before anything else, then checks why it
 * stopped, validates the JSON against the wire schema and lets the job store the result.
 */
export async function executeRun(runId: string): Promise<void> {
  const db = await getDb()
  const [run] = await db.select().from(s.aiRun).where(eq(s.aiRun.id, runId))
  if (!run || run.status !== 'running') return
  const job = JOBS[run.kind as JobKind] as Job | undefined
  const ctx = run.projectId ? await loadJobContext(db, run.ownerId, run.projectId) : null
  if (!job || !ctx) return finish(db, runId, { status: 'error', error: 'Het project of de taak bestaat niet meer.' })

  const { context, task } = prompts(job, ctx)
  let raw = ''
  let stopReason: string | null = 'end_turn'
  let usage: MessageUsage = FIXTURE_USAGE
  try {
    if (aiStatus() === 'fixtures') {
      await new Promise((r) => setTimeout(r, 300))
      raw = JSON.stringify(job.fixture(ctx))
    } else {
      // Only the schema goes along; parsing happens here, after the usage is safe in the database.
      const { type, schema } = betaZodOutputFormat(job.wire)
      const format = { type, schema }
      const stream = anthropic().beta.messages.stream(
        {
          model: MODEL,
          max_tokens: job.maxTokens,
          betas: [FALLBACK_BETA],
          fallbacks: 'default',
          output_config: { effort: job.effort, format },
          system: [
            { type: 'text', text: SYSTEM_PROMPT },
            { type: 'text', text: context, cache_control: { type: 'ephemeral' } },
          ],
          messages: [{ role: 'user', content: task }],
        },
        { signal: AbortSignal.timeout(270_000) },
      )
      const message = await stream.finalMessage()
      usage = message.usage as MessageUsage
      stopReason = message.stop_reason
      raw = message.content.map((b) => (b.type === 'text' ? b.text : '')).join('')
    }
  } catch (error) {
    console.error(`[ai] run ${runId} (${run.kind}) failed`, error instanceof Anthropic.APIError ? error.status : error)
    return finish(db, runId, { status: 'error', error: apiErrorText(error) })
  }

  await db
    .update(s.aiRun)
    .set({
      inputTokens: usage.input_tokens,
      outputTokens: usage.output_tokens,
      cacheReadTokens: usage.cache_read_input_tokens ?? 0,
      cacheWriteTokens: usage.cache_creation_input_tokens ?? 0,
      webSearches: usage.server_tool_use?.web_search_requests ?? 0,
      costMicros: costMicros(usage, MODEL),
    })
    .where(eq(s.aiRun.id, runId))

  if (stopReason === 'refusal') return finish(db, runId, { status: 'refused', error: 'Claude wilde dit niet maken. Pas de intake aan en probeer het opnieuw.' })
  if (stopReason === 'max_tokens') return finish(db, runId, { status: 'error', error: 'Het antwoord werd te lang en is afgebroken. Probeer het opnieuw.' })
  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch {
    return finish(db, runId, { status: 'error', error: 'Het antwoord was geen geldige JSON.' })
  }
  const result = job.wire.safeParse(parsed)
  if (!result.success) return finish(db, runId, { status: 'error', error: 'Het antwoord had niet de verwachte vorm.' })
  try {
    await job.save(db, { id: run.id, ownerId: run.ownerId, projectId: run.projectId }, ctx, result.data)
    await award(db, run.ownerId, { kind: 'generate', refId: run.id, projectId: run.projectId })
  } catch (error) {
    console.error(`[ai] saving run ${runId} failed`, error)
    return finish(db, runId, { status: 'error', error: 'Opslaan lukte niet.' })
  }
  return finish(db, runId, { status: 'done' })
}
