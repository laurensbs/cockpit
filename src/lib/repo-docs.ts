// Which documents in a repository's docs folder say the most about the product and its market.

const PRIORITY = [/market/i, /strateg/i, /growth|groei/i, /roadmap/i, /pitch|deck/i, /prd|product/i, /launch|lancer/i, /outreach|sales/i, /about|over/i, /research|onderzoek/i, /decision|beslis/i]

/** Up to max markdown files, the most telling first; the rest of the folder is left alone. */
export function pickDocs(paths: readonly string[], max = 5): string[] {
  const md = paths.filter((p) => /\.mdx?$/i.test(p) && !/changelog|license|contributing|code_of_conduct/i.test(p))
  const rank = (p: string) => {
    const i = PRIORITY.findIndex((r) => r.test(p))
    return i === -1 ? PRIORITY.length : i
  }
  return [...md].sort((a, b) => rank(a) - rank(b) || a.localeCompare(b)).slice(0, max)
}
