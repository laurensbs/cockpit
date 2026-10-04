import type { APIRequestContext, Browser, BrowserContextOptions, Page } from '@playwright/test'

const PORT = Number(process.env.E2E_PORT ?? 3300)
export const BASE_URL = process.env.E2E_BASE_URL ?? `http://localhost:${PORT}`

/** The token the test server was started with (playwright.config.ts). */
export const TOKEN = 'e2e-token'

/** With SHOTS=1, saves a full-page screenshot per step for design review (shots/<name>.png). */
export async function shot(page: Page, name: string) {
  if (!process.env.SHOTS) return
  await page.waitForTimeout(400)
  await page.screenshot({ path: `shots/${process.env.SHOTS_PREFIX ?? ''}${name}.png`, fullPage: true })
}

/** A browser context that carries the app's token, the way the app window does; or a stranger without it. */
export async function newVisitor(browser: Browser, options: BrowserContextOptions = {}, { anonymous = false } = {}) {
  const context = await browser.newContext({
    colorScheme: process.env.SHOTS_DARK ? 'dark' : 'light',
    ...options,
  })
  if (!anonymous) await context.addCookies([{ name: 'cockpit', value: TOKEN, url: BASE_URL }])
  const page = await context.newPage()
  return { context, page }
}

/** The headers Claude Code's MCP client sends: JSON-RPC over HTTP with the bearer token. */
export const MCP_HEADERS = { Authorization: `Bearer ${TOKEN}`, 'Content-Type': 'application/json', Accept: 'application/json, text/event-stream' }

interface Rpc {
  result?: { content?: { type: string; text: string }[]; isError?: boolean; tools?: { name: string }[]; prompts?: { name: string }[] }
  error?: { code: number; message: string }
}

/** One JSON-RPC request to the cockpit's MCP endpoint, as Claude Code would send it. */
export async function mcpCall(request: APIRequestContext, method: string, params: unknown = {}): Promise<Rpc> {
  const res = await request.post('/api/mcp', { headers: MCP_HEADERS, data: { jsonrpc: '2.0', id: 1, method, params } })
  return (await res.json()) as Rpc
}

/** Calls a tool and gives back its text, the way Claude sees it. */
export async function mcpTool(request: APIRequestContext, name: string, args: Record<string, unknown> = {}) {
  const r = await mcpCall(request, 'tools/call', { name, arguments: args })
  if (r.error) throw new Error(`${name}: ${r.error.message}`)
  return { text: r.result?.content?.map((c) => c.text).join('\n') ?? '', isError: Boolean(r.result?.isError) }
}
