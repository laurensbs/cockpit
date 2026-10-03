// Suggests which repositories belong together, from their names: caravanstallingspanje,
// caravanstallingspanje-repair and caravanverhuur-stalling are one business.

const SUFFIXES = /[-_](v\d+|app|web|site|api|admin|panel|repair|backend|frontend|plugin|runelite-plugin|projecten|website|sales|qr-menu|stalling)$/i

/** The part of a repository name that names the venture. */
export function stemOf(name: string): string {
  let stem = name.toLowerCase().replace(/^.*\//, '')
  for (let i = 0; i < 3 && SUFFIXES.test(stem); i++) stem = stem.replace(SUFFIXES, '')
  return stem
}

/** Groups names that share a stem, or where one stem starts another (scapestack, scapestack-runelite-plugin). */
export function suggestGroups(names: readonly string[]): string[][] {
  const stems = names.map((n) => ({ name: n, stem: stemOf(n) }))
  const groups: { stem: string; names: string[] }[] = []
  for (const { name, stem } of [...stems].sort((a, b) => a.stem.length - b.stem.length)) {
    const group = groups.find((g) => stem === g.stem || (g.stem.length >= 6 && stem.startsWith(g.stem)))
    if (group) group.names.push(name)
    else groups.push({ stem, names: [name] })
  }
  return groups.map((g) => g.names)
}
