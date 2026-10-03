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
import { JOBS, type Job, type JobExtras, type JobKind } from './jobs'

const REFUSALS: Record<Refusal, string> = {
  budget: 'Het AI-budget van deze maand is op. Verhoog AI_MONTHLY_BUDGET_USD als je meer wilt.',
  daily: 'Voor vandaag is genoeg uitgegeven (een vijfde van het maandbudget). Morgen weer.',
  busy: 'Dit loopt al. Even geduld.',
}

const NO_EXTRAS: JobExtras = { pastTitles: [], contact: null }

function prompts(job: Job, ctx: JobContext, options: unknown, extras: JobExtras) {
  const context = projectContext(ctx.input)
  const task = job.task(ctx, options, extras)
  return { context, task, inputTokens: estimateTokens(SYSTEM_PROMPT + context + task) + (job.webSearch?.extraInputTokens ?? 0) }
}

/** What a run will roughly cost (shown on the button), and the most it can cost (reserved). */
export function estimate(job: Job, ctx: JobContext, options: unknown = {}, extras: JobExtras = NO_EXTRAS): { typicalMicros: number; worstMicros: number } {
  const parsed = job.options.safeParse(options)
  const { inputTokens } = prompts(job, ctx, parsed.success ? parsed.data : options, extras)
  const price = priceOf(MODEL)
  const searches = job.webSearch?.maxUses ?? 0
  return {
    typicalMicros: Math.ceil(inputTokens * price.input + job.typicalOutput * price.output + searches * 10_000),
    worstMicros: worstCaseMicros(inputTokens, job.maxTokens, searches),
  }
}

async function extrasFor(db: Db, job: Job, ctx: JobContext, options: unknown): Promise<JobExtras> {
  return { ...NO_EXTRAS, ...(job.extras ? await job.extras(db, ctx, options) : {}) }
}

/** Starts a job for a project: reserves the budget, then runs after the response has gone out. */
export async function startJob(ownerId: string, kind: JobKind, projectId: string, rawOptions: unknown = {}): Promise<{ runId: string } | { error: string }> {
  if (aiStatus() === 'off') return { error: 'Claude is nog niet gekoppeld: zet ANTHROPIC_API_KEY in Vercel.' }
  const job = JOBS[kind] as Job
  const options = job.options.safeParse(rawOptions ?? {})
  if (!options.success) return { error: 'Kies eerst wat je wilt maken.' }
  const db = await getDb()
  const ctx = await loadJobContext(db, ownerId, projectId)
  if (!ctx) return { error: 'Dit project bestaat niet.' }
  const extras = await extrasFor(db, job, ctx, options.data)
  if (kind === 'contactEmail' && !extras.contact) return { error: 'Dit contact bestaat niet.' }
  const reserved = await reserveRun(db, {
    ownerId,
    projectId,
    kind,
    model: MODEL,
    worstMicros: estimate(job, ctx, options.data, extras).worstMicros,
    options: options.data as Record<string, unknown>,
  })
  if ('refusal' in reserved) return { error: REFUSALS[reserved.refusal] }
  after(() => executeRun(reserved.runId))
  return { runId: reserved.runId }
}

/** The JSON object in an answer that was not forced into a format (one with web search). */
export function extractJson(text: string): string {
  const start = text.indexOf('{')
  const end = text.lastIndexOf('}')
  return start === -1 || end <= start ? text : text.slice(start, end + 1)
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

/** What the calls cost, added up (a paused web search makes more than one call). */
async function recordUsage(db: Db, runId: string, usages: MessageUsage[]) {
  const sum = (f: (u: MessageUsage) => number) => usages.reduce((total, u) => total + f(u), 0)
  await db
    .update(s.aiRun)
    .set({
      inputTokens: sum((u) => u.input_tokens),
      outputTokens: sum((u) => u.output_tokens),
      cacheReadTokens: sum((u) => u.cache_read_input_tokens ?? 0),
      cacheWriteTokens: sum((u) => u.cache_creation_input_tokens ?? 0),
      webSearches: sum((u) => u.server_tool_use?.web_search_requests ?? 0),
      costMicros: sum((u) => costMicros(u, MODEL)),
    })
    .where(eq(s.aiRun.id, runId))
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
  const options = job?.options.safeParse(run.options)
  if (!job || !ctx || !options?.success) return finish(db, runId, { status: 'error', error: 'Het project of de taak bestaat niet meer.' })
  const extras = await extrasFor(db, job, ctx, options.data)
  const { context, task } = prompts(job, ctx, options.data, extras)

  let raw = ''
  let stopReason: string | null = 'end_turn'
  const usages: MessageUsage[] = []
  try {
    if (aiStatus() === 'fixtures') {
      await new Promise((r) => setTimeout(r, 300))
      raw = JSON.stringify(job.fixture(ctx))
      usages.push(FIXTURE_USAGE)
    } else {
      // Only the schema goes along; parsing happens here, after the usage is safe in the database.
      // A job with web search answers in free text instead (the format is described in its task).
      const { type, schema } = betaZodOutputFormat(job.wire)
      const messages: Anthropic.Beta.Messages.BetaMessageParam[] = [{ role: 'user', content: task }]
      // Web search can pause a long turn; sending the turn back lets it carry on (a few times at most).
      for (let round = 0; round < 3; round++) {
        const stream = anthropic().beta.messages.stream(
          {
            model: MODEL,
            max_tokens: job.maxTokens,
            betas: [FALLBACK_BETA],
            fallbacks: 'default',
            output_config: job.webSearch ? { effort: job.effort } : { effort: job.effort, format: { type, schema } },
            ...(job.webSearch ? { tools: [{ type: 'web_search_20260209' as const, name: 'web_search' as const, max_uses: job.webSearch.maxUses }] } : {}),
            system: [
              { type: 'text', text: SYSTEM_PROMPT },
              { type: 'text', text: context, cache_control: { type: 'ephemeral' } },
            ],
            messages,
          },
          { signal: AbortSignal.timeout(270_000) },
        )
        const message = await stream.finalMessage()
        usages.push(message.usage as MessageUsage)
        stopReason = message.stop_reason
        raw = message.content.map((b) => (b.type === 'text' ? b.text : '')).join('')
        if (stopReason !== 'pause_turn') break
        messages.push({ role: 'assistant', content: message.content })
      }
    }
  } catch (error) {
    console.error(`[ai] run ${runId} (${run.kind}) failed`, error instanceof Anthropic.APIError ? error.status : error)
    if (usages.length) await recordUsage(db, runId, usages)
    return finish(db, runId, { status: 'error', error: apiErrorText(error) })
  }

  await recordUsage(db, runId, usages)

  if (stopReason === 'refusal') return finish(db, runId, { status: 'refused', error: 'Claude wilde dit niet maken. Pas de intake aan en probeer het opnieuw.' })
  if (stopReason === 'max_tokens') return finish(db, runId, { status: 'error', error: 'Het antwoord werd te lang en is afgebroken. Probeer het opnieuw.' })
  if (stopReason === 'pause_turn') return finish(db, runId, { status: 'error', error: 'Het zoeken duurde te lang. Probeer het opnieuw.' })
  let parsed: unknown
  try {
    parsed = JSON.parse(job.webSearch ? extractJson(raw) : raw)
  } catch {
    return finish(db, runId, { status: 'error', error: 'Het antwoord was geen geldige JSON.' })
  }
  const result = job.wire.safeParse(parsed)
  if (!result.success) return finish(db, runId, { status: 'error', error: 'Het antwoord had niet de verwachte vorm.' })
  try {
    await job.save(db, { id: run.id, ownerId: run.ownerId, projectId: run.projectId }, ctx, result.data, options.data, extras)
    await award(db, run.ownerId, { kind: 'generate', refId: run.id, projectId: run.projectId })
  } catch (error) {
    console.error(`[ai] saving run ${runId} failed`, error)
    return finish(db, runId, { status: 'error', error: 'Opslaan lukte niet.' })
  }
  return finish(db, runId, { status: 'done' })
}
