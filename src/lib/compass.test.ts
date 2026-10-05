import { describe, expect, it } from 'vitest'
import { compassExcerpt, compassFrom } from './compass'

describe('compassFrom', () => {
  it('reads the phase, the goal and the open criteria from a STAND.md', () => {
    const md = `# Stand van Webstability

**Fase:** 2 · Prototype → volgende: 3 · MVP live

**Doel van deze fase:** de aanvraagstroom gaat van demo naar een verkoopbaar aanbod. Daarna de rest.

## Klaar voor de volgende fase als
- ✅ **Demo** werkt.
- ⬜ **1 betaalde pilot** vóór 30 okt. Met factuur.
- ⬜ Partnerpagina live.
`
    expect(compassFrom(md)).toMatchObject({
      phase: '2 · Prototype',
      goal: 'de aanvraagstroom gaat van demo naar een verkoopbaar aanbod.',
      open: ['1 betaalde pilot vóór 30 okt.', 'Partnerpagina live.'],
    })
  })

  it('handles the other ways his files write the phase, and a file without one', () => {
    expect(compassFrom('**Fase:** 2 · Prototype. Volgende fase: 3 · MVP live (in de App Store).').phase).toBe('2 · Prototype')
    expect(compassFrom('**Fase:** 2 · Prototype, oftewel de **Alpha**').phase).toBe('2 · Prototype')
    expect(compassFrom('# Notities').phase).toBeNull()
  })
})

describe('compassExcerpt', () => {
  it('keeps the start and the newest of the logbook, so Claude sees what changed since', () => {
    const md = `# Stand van Rondje\n\n**Fase:** 3 · MVP live\n\n## Scorebord\n${'| rij | waarde |\n'.repeat(400)}\n## Logboek\n- 2026-10-05 · De naam is Rondje Mee, op rondjemee.nl.\n- 2026-10-01 · Oud nieuws.\n\n## Bijlage\nNiet nodig.`
    const excerpt = compassExcerpt(md, 500, 3000)
    expect(excerpt.startsWith('# Stand van Rondje')).toBe(true)
    expect(excerpt).toContain('## Logboek (nieuwste eerst)\n- 2026-10-05 · De naam is Rondje Mee, op rondjemee.nl.')
    expect(excerpt).not.toContain('Niet nodig.')
    expect(excerpt.length).toBeLessThan(800)
  })

  it('takes the start alone when there is no logbook', () => {
    expect(compassExcerpt('# Notities\nkort')).toBe('# Notities\nkort')
  })
})
