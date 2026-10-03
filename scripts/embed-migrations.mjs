// Embeds the SQL migrations from ./drizzle into src/db/migrations.json, so the app
// can migrate itself at runtime on any host (Neon or PGlite) without reading files.
import { readFileSync, writeFileSync } from 'node:fs'

const journal = JSON.parse(readFileSync('drizzle/meta/_journal.json', 'utf8'))
const migrations = journal.entries.map((entry) => ({
  tag: entry.tag,
  statements: readFileSync(`drizzle/${entry.tag}.sql`, 'utf8')
    .split('--> statement-breakpoint')
    .map((s) => s.trim())
    .filter(Boolean),
}))
writeFileSync('src/db/migrations.json', JSON.stringify(migrations, null, 2) + '\n')
console.log(`Embedded ${migrations.length} migration(s).`)
