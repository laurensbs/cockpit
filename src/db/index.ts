import 'server-only'
import { PGlite } from '@electric-sql/pglite'
import { Pool } from '@neondatabase/serverless'
import { sql } from 'drizzle-orm'
import { drizzle as drizzleNeon } from 'drizzle-orm/neon-serverless'
import { drizzle as drizzlePg } from 'drizzle-orm/node-postgres'
import { drizzle as drizzlePglite } from 'drizzle-orm/pglite'
import pg from 'pg'
import migrations from './migrations.json'
import * as schema from './schema'

export type Db = ReturnType<typeof drizzlePglite<typeof schema>>

interface DbState {
  db: Db
  mode: 'neon' | 'postgres' | 'pglite'
  ready?: Promise<void>
}

const globalForDb = globalThis as unknown as { __cockpitDb?: DbState }

function connectionString(): string | undefined {
  return process.env.DATABASE_URL || process.env.POSTGRES_URL || undefined
}

function isNeon(url: string): boolean {
  try {
    return new URL(url).hostname.endsWith('.neon.tech')
  } catch {
    return false
  }
}

/** Plain Postgres (a local server, or another host) through node-postgres. */
function plainPool(url: string): pg.Pool {
  const parsed = new URL(url)
  const local = ['localhost', '127.0.0.1'].includes(parsed.hostname)
  parsed.searchParams.delete('sslmode')
  return new pg.Pool({
    connectionString: parsed.toString(),
    ssl: local ? undefined : { rejectUnauthorized: false },
    max: 5,
    idleTimeoutMillis: 10_000,
  })
}

function create(): DbState {
  const url = connectionString()
  if (url && isNeon(url)) {
    const pool = new Pool({ connectionString: url })
    return { db: drizzleNeon({ client: pool, schema }) as unknown as Db, mode: 'neon' }
  }
  if (url) {
    return { db: drizzlePg({ client: plainPool(url), schema }) as unknown as Db, mode: 'postgres' }
  }
  // No database configured: an embedded Postgres. Locally it persists in .pglite; on a
  // serverless host it lives in memory (nothing is kept between requests on different instances).
  // The build's page workers each load this module: they get one in memory instead of fighting over one folder.
  const building = process.env.NEXT_PHASE === 'phase-production-build'
  const dataDir = process.env.PGLITE_DIR ?? (process.env.VERCEL || building ? undefined : '.pglite')
  const client = new PGlite(dataDir === 'memory' ? undefined : dataDir)
  return { db: drizzlePglite({ client, schema }), mode: 'pglite' }
}

const state = (globalForDb.__cockpitDb ??= create())

export const db = state.db

export function dbMode(): DbState['mode'] {
  return state.mode
}

async function migrate(): Promise<void> {
  await db.execute(sql`create table if not exists _cockpit_migrations (tag text primary key, applied_at timestamp default now())`)
  for (const migration of migrations) {
    await db.transaction(async (tx) => {
      // Serialise concurrent cold starts, then re-check inside the lock.
      await tx.execute(sql`select pg_advisory_xact_lock(424242)`)
      const done = await tx.execute(sql`select 1 from _cockpit_migrations where tag = ${migration.tag}`)
      if (done.rows.length > 0) return
      for (const statement of migration.statements) await tx.execute(sql.raw(statement))
      await tx.execute(sql`insert into _cockpit_migrations (tag) values (${migration.tag})`)
    })
  }
}

/** Runs the migrations once per server instance. */
export function ready(): Promise<void> {
  state.ready ??= migrate().catch((error) => {
    state.ready = undefined
    throw error
  })
  return state.ready
}

/** The database, after migrations have run. */
export async function getDb(): Promise<Db> {
  await ready()
  return db
}
