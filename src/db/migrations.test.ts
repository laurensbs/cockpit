import { PGlite } from '@electric-sql/pglite'
import { is } from 'drizzle-orm'
import { getTableConfig, PgTable } from 'drizzle-orm/pg-core'
import { describe, expect, it } from 'vitest'
import migrations from './migrations.json'
import * as schema from './schema'

describe('database migrations', () => {
  it('apply cleanly on an empty database', async () => {
    const db = new PGlite()
    for (const migration of migrations) for (const statement of migration.statements) await db.exec(statement)
    const tables = await db.query<{ table_name: string }>(
      "select table_name from information_schema.tables where table_schema = 'public' order by table_name",
    )
    expect(tables.rows.map((r) => r.table_name)).toEqual(
      expect.arrayContaining(['company', 'project', 'repo', 'brief', 'content_item', 'contact', 'quest', 'xp_event', 'metric', 'setting', 'email_job', 'metric_point', 'connector', 'contact_event']),
    )
    await db.close()
  }, 30_000)

  it('only ever adds: no drops or renames after the first migration', () => {
    for (const migration of migrations.slice(1)) {
      for (const statement of migration.statements) {
        expect(statement, migration.tag).not.toMatch(/\b(drop|rename)\b/i)
      }
    }
  })

  it('gives every cockpit table an owner, so it can serve more people later', () => {
    const tables = (Object.values(schema) as unknown[]).filter((value): value is PgTable => is(value, PgTable))
    for (const table of tables) {
      const config = getTableConfig(table)
      expect(
        config.columns.some((c) => c.name === 'owner_id' && c.notNull),
        config.name,
      ).toBe(true)
    }
  })
})
