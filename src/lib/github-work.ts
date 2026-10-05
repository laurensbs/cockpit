// What changed in a repository, in words Claude and he can use: which areas of the code a commit
// touched and how much. Pure, so it can be tested; src/server/github/sync.ts fetches the files.

const DEEP = new Set(['app', 'src', 'lib', 'components', 'pages', 'web', 'ios', 'packages', 'server', 'scripts', 'docs', 'e2e'])

/** The areas a set of files lives in: "app/portal", "lib", "ios/Rondje", at most five, biggest first. */
export function areasOf(files: { filename: string; additions: number; deletions: number }[]): string[] {
  const weight = new Map<string, number>()
  for (const f of files) {
    const parts = f.filename.split('/')
    const area = parts.length > 2 && DEEP.has(parts[0]) ? `${parts[0]}/${parts[1]}` : parts.length > 1 ? parts[0] : f.filename
    weight.set(area, (weight.get(area) ?? 0) + f.additions + f.deletions + 1)
  }
  return [...weight].sort((a, b) => b[1] - a[1]).slice(0, 5).map(([a]) => a)
}

export function changeOf(commit: { sha: string; date: string; message: string }, files: { filename: string; additions: number; deletions: number }[]) {
  return {
    sha: commit.sha,
    date: commit.date,
    message: commit.message.split('\n')[0].slice(0, 140),
    areas: areasOf(files),
    files: files.length,
    additions: files.reduce((t, f) => t + f.additions, 0),
    deletions: files.reduce((t, f) => t + f.deletions, 0),
  }
}

/** One line per pull request and change, for Claude's picture of the work: newest first. */
export function workLines(
  pulls: { number: number; title: string; state: string; updatedAt: string }[],
  changes: { date: string; message: string; areas: string[]; additions: number; deletions: number }[],
): string[] {
  return [
    ...pulls.slice(0, 6).map((p) => `${p.updatedAt.slice(0, 10)} PR #${p.number} (${p.state}): ${p.title}`),
    ...changes.slice(0, 6).map((c) => `${c.date.slice(0, 10)} ${c.message}${c.areas.length ? ` [${c.areas.join(', ')}; +${c.additions}/−${c.deletions}]` : ''}`),
  ]
}
