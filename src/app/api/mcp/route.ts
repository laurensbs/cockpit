import { WebStandardStreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js'
import { NextResponse } from 'next/server'
import { getDb } from '@/db'
import { createCockpitServer } from '@/server/mcp/server'
import { bearerOwner } from '@/server/session'

export const dynamic = 'force-dynamic'

/**
 * The MCP endpoint for Claude Code (and the Claude desktop app): JSON-RPC over HTTP, one bearer
 * token, no sessions. Every request gets a fresh server, so nothing lingers between calls.
 */
async function handle(request: Request) {
  const owner = bearerOwner(request)
  if (!owner) return NextResponse.json({ error: 'unauthorized' }, { status: 401, headers: { 'WWW-Authenticate': 'Bearer' } })
  const db = await getDb()
  const server = createCockpitServer(db, owner.userId)
  const transport = new WebStandardStreamableHTTPServerTransport({ sessionIdGenerator: undefined, enableJsonResponse: true })
  await server.connect(transport)
  return transport.handleRequest(request)
}

export { handle as GET, handle as POST, handle as DELETE }
