import 'server-only'
import { PGlite } from '@electric-sql/pglite'
import { sql } from 'drizzle-orm'
import { drizzle } from 'drizzle-orm/pglite'
import migrations from './migrations.json'
import * as schema from './schema'

export type Db = ReturnType<typeof drizzle<typeof schema>>

interface DbState {
  db: Db
  /** The folder with the data, or null when it lives in memory. */
  dir: string | null
  ready?: Promise<void>
}

const globalForDb = globalThis as unknown as { __cockpitDb?: DbState }

/**
 * An embedded Postgres (PGlite). The app passes its data folder in PGLITE_DIR; development uses
 * .pglite in this folder; tests and the build ("memory") keep it in memory, so the build's page
 * workers do not fight over one folder.
 */
function dataDir(): string | null {
  const building = process.env.NEXT_PHASE === 'phase-production-build'
  const dir = process.env.PGLITE_DIR ?? (building ? 'memory' : '.pglite')
  return dir === 'memory' ? null : dir
}

function create(): DbState {
  const dir = dataDir()
  return { db: drizzle({ client: new PGlite(dir ?? undefined), schema }), dir }
}

const state = (globalForDb.__cockpitDb ??= create())

export const db = state.db

export const dbDir = (): string | null => state.dir

export const dbMode = (): 'pglite' | 'memory' => (state.dir ? 'pglite' : 'memory')

async function migrate(): Promise<void> {
  await db.execute(sql`create table if not exists _cockpit_migrations (tag text primary key, applied_at timestamp default now())`)
  for (const migration of migrations) {
    await db.transaction(async (tx) => {
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
