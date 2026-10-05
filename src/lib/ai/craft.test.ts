import { describe, expect, it } from 'vitest'
import { articleProblems, clichesIn, overlap, postProblems, specificTags } from './craft'

const good = {
  title: 'Werkbon in 4 seconden',
  hook: 'Zo komt een aanvraag van een garage binnen: met kenteken en foto, in vier seconden.',
  caption: 'Een klant vult op zijn telefoon het formulier in. Op mijn laptop staat binnen vier seconden de werkbon, met wat er nog ontbreekt. Sla dit op als je ook WhatsApp-chaos kent.',
}

describe('postProblems', () => {
  it('lets a concrete post through', () => {
    expect(postProblems(good)).toEqual([])
  })

  it('names hype, clichés and fake urgency in all three languages', () => {
    expect(clichesIn('Dit is een echte game changer voor je bedrijf')).toEqual(['game changer'])
    expect(clichesIn('Lleva tu negocio al siguiente nivel')).toEqual(['siguiente nivel'])
    expect(postProblems({ ...good, caption: `${good.caption} Laatste kans!` })[0]).toContain('"laatste kans"')
  })

  it('refuses a long hook, a thin caption, emoji spam and shouting', () => {
    expect(postProblems({ ...good, hook: 'x'.repeat(160) }).join()).toContain('160 characters')
    expect(postProblems({ ...good, caption: 'Kijk!' }).join()).toContain('too thin')
    expect(postProblems({ ...good, caption: `${good.caption} 🔥🔥🔥🔥🔥🔥🔥🔥🔥` }).join()).toContain('9 emoji')
    expect(postProblems({ ...good, caption: `${good.caption} NU NIEUW GRATIS SNEL KLAAR` }).join()).toContain('capitals')
  })

  it('catches a repeat of an earlier hook, not a different one', () => {
    expect(postProblems(good, ['Zo komt een aanvraag van een garage binnen: met kenteken en foto, in 4 seconden.']).join()).toContain('repeats an earlier post')
    expect(postProblems(good, ['Drie vragen die elke caravanstalling krijgt'])).toEqual([])
    expect(overlap('a b c', 'a b c')).toBe(1)
  })
})

describe('specificTags', () => {
  it('drops generic reach-bait and keeps the specific ones', () => {
    expect(specificTags(['#marketing', '#werkbon', '#CostaBrava', '#FYP', 'ondernemer'])).toEqual({ kept: ['#werkbon', '#CostaBrava'], dropped: ['#marketing', '#FYP', 'ondernemer'] })
  })
})

describe('articleProblems', () => {
  const body = ['## Wat kost het', '## Hoe werkt het', '## Wat vragen klanten'].map((h) => `${h}\n\n${'Een echt antwoord met een voorbeeld uit de praktijk. '.repeat(30)}`).join('\n\n')

  it('lets a full article with sections through', () => {
    expect(articleProblems({ title: 'Wat kost een aanvraagformulier voor een garage?', metaDescription: 'Prijzen, voorbeelden en vragen.', markdown: body })).toEqual([])
  })

  it('wants enough words and sections in the written-out one, and checks only the title of an outline', () => {
    expect(articleProblems({ title: 'Kort', metaDescription: '', markdown: '## Een\nTe kort.' }).join()).toMatch(/words.*H2/)
    expect(articleProblems({ title: 'Nog uit te schrijven', metaDescription: '', markdown: '' })).toEqual([])
  })
})
