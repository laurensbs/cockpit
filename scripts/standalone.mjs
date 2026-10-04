// Puts the standalone server together in release/server: Next's traced server plus the static
// files and the public folder it serves. The app starts release/server/server.js.
import { cpSync, existsSync, rmSync } from 'node:fs'

const out = 'release/server'
if (!existsSync('.next/standalone/server.js')) {
  console.error('Run `next build` first: .next/standalone is missing.')
  process.exit(1)
}
rmSync(out, { recursive: true, force: true })
cpSync('.next/standalone', out, { recursive: true })
cpSync('.next/static', `${out}/.next/static`, { recursive: true })
if (existsSync('public')) cpSync('public', `${out}/public`, { recursive: true })
console.log(`Server assembled in ${out}`)
