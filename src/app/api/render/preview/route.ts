import { and, eq } from 'drizzle-orm'
import { getDb } from '@/db'
import * as s from '@/db/schema'
import { normalizeBrand } from '@/lib/brand'
import { renderPng } from '@/server/render/engine'
import { coverSlide, POST_SIZE } from '@/server/render/templates'
import { getOwner } from '@/server/session'

export const dynamic = 'force-dynamic'

/** A sample cover in a project's house style, for the form. Nothing is stored. */
export async function GET(request: Request) {
  const owner = await getOwner()
  if (!owner) return new Response('Unauthorized', { status: 401 })
  const query = new URL(request.url).searchParams
  const projectId = query.get('project') ?? ''
  const db = await getDb()
  const [row] = await db
    .select({ name: s.project.name, brand: s.project.brand, color: s.company.color })
    .from(s.project)
    .leftJoin(s.company, eq(s.company.id, s.project.companyId))
    .where(and(eq(s.project.id, projectId), eq(s.project.ownerId, owner.userId)))
  if (!row) return new Response('Not found', { status: 404 })
  // The form sends the values he is choosing, so the sample follows him before he saves.
  const asked = ['bg', 'fg', 'accent', 'font', 'style', 'handle'].some((k) => query.has(k))
  const brand = normalizeBrand(asked ? { ...(row.brand ?? {}), ...Object.fromEntries(['bg', 'fg', 'accent', 'font', 'style', 'handle'].filter((k) => query.has(k)).map((k) => [k, query.get(k)])) } : row.brand, row.color)
  const png = await renderPng(coverSlide(brand, { title: `Zo ziet een post van ${row.name} eruit`, body: 'Grote letters, je kleuren, je handle.' }, 5, POST_SIZE), POST_SIZE.width, POST_SIZE.height)
  return new Response(new Uint8Array(png), { headers: { 'Content-Type': 'image/png', 'Cache-Control': 'no-store' } })
}
