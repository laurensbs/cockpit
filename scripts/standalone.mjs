// Puts the standalone server together in release/server: Next's traced server plus the static
// files and the public folder it serves. The app starts release/server/server.js.
//
// Next links some external packages (PGlite) with symlinks that point to an absolute path on the
// build machine. Those would be broken on any other computer, so they are copied as real folders,
// and the build fails if any link is left that points outside the server folder.
import { cpSync, existsSync, lstatSync, readdirSync, readlinkSync, rmdirSync, rmSync, unlinkSync } from 'node:fs'
import { isAbsolute, join, relative, resolve } from 'node:path'

const out = 'release/server'
if (!existsSync('.next/standalone/server.js')) {
  console.error('Run `next build` first: .next/standalone is missing.')
  process.exit(1)
}
rmSync(out, { recursive: true, force: true })
cpSync('.next/standalone', out, { recursive: true })
cpSync('.next/static', `${out}/.next/static`, { recursive: true })
if (existsSync('public')) cpSync('public', `${out}/public`, { recursive: true })

// A link into the standalone build becomes a real copy of the same folder inside the server.
// The link itself is unlinked, never followed: on a Mac, Node's rmSync treats a link to a folder as
// that folder and refuses. A Windows junction only goes with rmdir, which leaves its target alone.
const removeLink = (path) => {
  try {
    unlinkSync(path)
  } catch {
    rmdirSync(path)
  }
}
const standalone = resolve('.next/standalone')
const localize = (dir) => {
  for (const name of readdirSync(dir)) {
    const path = join(dir, name)
    const stat = lstatSync(path)
    if (stat.isSymbolicLink()) {
      const target = readlinkSync(path)
      const full = isAbsolute(target) ? target : resolve(dir, target)
      const inside = relative(standalone, full)
      if (!inside.startsWith('..') && !isAbsolute(inside)) {
        removeLink(path)
        cpSync(join(out, inside), path, { recursive: true })
      }
    } else if (stat.isDirectory()) localize(path)
  }
}
localize(out)

const outside = []
const walk = (dir) => {
  for (const name of readdirSync(dir)) {
    const path = join(dir, name)
    const stat = lstatSync(path)
    if (stat.isSymbolicLink()) {
      const target = readlinkSync(path)
      const full = isAbsolute(target) ? target : resolve(dir, target)
      if (isAbsolute(target) || relative(resolve(out), full).startsWith('..')) outside.push(`${path} -> ${target}`)
    } else if (stat.isDirectory()) walk(path)
  }
}
walk(out)
if (outside.length) {
  console.error(`Links that point outside the server folder (they would break on another computer):\n${outside.join('\n')}`)
  process.exit(1)
}
console.log(`Server assembled in ${out}`)
