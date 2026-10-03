import type { CompanyKind, Stage } from './options'

export interface StarterProject {
  key: string
  name: string
  companyKind: CompanyKind
  stage: Stage
  repos: string[]
  oneLiner: string
  languages: string[]
  markets: string[]
  redLines: string
}

/**
 * What Laurens is building now (October 2026), as suggestions for the first visit. Nothing is stored
 * until he confirms; the RSPS and the game have no repository yet.
 */
export const STARTER_PROJECTS: StarterProject[] = [
  {
    key: 'rsps',
    name: 'OSRS RSPS',
    companyKind: 'side',
    stage: 'build',
    repos: [],
    oneLiner: '',
    languages: ['en'],
    markets: ['Online'],
    redLines: 'Geen logo’s, namen of beelden van Jagex in betaalde advertenties. Eerlijk dat het een private server is, niet officieel.',
  },
  {
    key: 'rondje',
    name: 'Rondje',
    companyKind: 'nonprofit',
    stage: 'launch',
    repos: ['laurensbs/value'],
    oneLiner: 'Jongeren wandelen gratis met honden van ouderen, zieken en uit opvangen.',
    languages: ['nl', 'en', 'es', 'fr'],
    markets: ['NL', 'BE', 'ES'],
    redLines:
      'Geen advertenties in de app, geen betaalmuur, nooit data verkopen; sponsors bepalen niets. Geen therapie- of genezingsclaims. Nooit privépersonen ongevraagd benaderen.',
  },
  {
    key: 'webstability',
    name: 'Webstability',
    companyKind: 'own',
    stage: 'growth',
    repos: ['laurensbs/webstability'],
    oneLiner: '',
    languages: ['nl', 'en'],
    markets: ['NL', 'ES'],
    redLines: '',
  },
  {
    key: 'game',
    name: 'Game-app',
    companyKind: 'side',
    stage: 'build',
    repos: [],
    oneLiner: '',
    languages: ['en', 'nl'],
    markets: ['Online'],
    redLines: '',
  },
  {
    key: 'teampje',
    name: 'Teampje',
    companyKind: 'own',
    stage: 'build',
    repos: ['laurensbs/teampje'],
    oneLiner: '',
    languages: ['nl'],
    markets: ['NL'],
    redLines: '',
  },
]
