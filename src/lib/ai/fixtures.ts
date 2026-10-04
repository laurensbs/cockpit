// Fixed answers instead of Claude for tests (AI_FIXTURES=1, never in production). They must pass
// the same wire schemas as real answers; a test checks that.


export const profileFixture = (name: string) => ({
  oneLiner: `${name}: het rondje dat je week beter maakt.`,
  positioning: `Voor jonge mensen die iets goeds willen doen zonder gedoe: ${name} maakt het makkelijk om er elke week te zijn.`,
  audiences: [
    { name: 'Studenten (18–25)', pains: 'Willen iets betekenen, maar hebben weinig tijd en geen hond.', whereToFind: 'Studieverenigingen, introweken, Instagram' },
    { name: 'Opvangen', pains: 'Te weinig handen om alle honden uit te laten.', whereToFind: 'Websites en Facebook-pagina’s van opvangen in de regio' },
  ],
  valueProps: ['Gratis', 'Vast moment per week', 'Begeleid begin'],
  channels: [
    { name: 'Instagram', why: 'Honden doen het goed en je doelgroep zit er.', effort: 'medium', firstStep: 'Zet de eerste drie posts klaar.' },
    { name: 'Opvangen benaderen', why: 'Eén opvang levert veel honden op.', effort: 'low', firstStep: 'Mail drie opvangen uit de lijst.' },
  ],
  pillars: ['Honden van de week', 'Hoe het werkt', 'Verhalen met toestemming'],
  tone: 'Warm, nuchter, met een knipoog. Nooit zielig.',
  kpis: [{ name: 'Vaste koppels per week', target: '10 binnen 90 dagen (aanname)' }],
  risks: ['Te snel te veel steden: blijf bij één stad tot het loopt.'],
  quickWins: ['Mail drie opvangen', 'Plaats een post met een hond van de week'],
})

export const planFixture = () => ({
  summary: 'Eerst aanbod (opvangen), dan wandelaars via studenten, daarna een tweede stad.',
  phases: [
    {
      focus: 'Aanbod in één stad',
      actions: [
        { title: 'Mail vijf opvangen met de pitch', why: 'Honden eerst.', channel: 'E-mail', effort: 'low', week: 1 },
        { title: 'Organiseer een eerste groepswandeling', why: 'Laagdrempelig begin voor nieuwe wandelaars.', channel: 'Offline', effort: 'high', week: 3 },
      ],
    },
    {
      focus: 'Wandelaars werven',
      actions: [{ title: 'Spreek twee studieverenigingen aan', why: 'Groepen in één keer.', channel: 'Partnerschap', effort: 'medium', week: 6 }],
    },
    {
      focus: 'Tweede stad voorbereiden',
      actions: [{ title: 'Kies de tweede stad op basis van stemmen', why: 'Waar de vraag al is.', channel: 'Data', effort: 'small', week: 11 }],
    },
  ],
})

export const emailsFixture = () => ({
  drafts: [
    { title: 'Eerste mail aan een opvang', subject: 'Meer wandelingen voor jullie honden, gratis', body: 'Hoi,\n\nIk ben Laurens van Rondje. Wij koppelen jonge vrijwilligers aan honden die een extra wandeling goed kunnen gebruiken.\n\nLiever geen mail meer hierover? Laat het weten, dan stop ik.', ps: 'Jullie bepalen welke honden meedoen.' },
    { title: 'Kortere variant', subject: 'Vrijwilligers voor jullie honden?', body: 'Hoi,\n\nKort: gratis begeleide groepswandelingen met jonge vrijwilligers.\n\nLiever geen mail meer? Laat het weten.', ps: '' },
  ],
})

export const postsFixture = () => ({
  posts: [
    { title: 'Hond van de week', format: 'Carrousel', hook: 'Dit is Bram. Hij wacht op jou.', caption: 'Bram (6) houdt van eendjes kijken. Wie loopt zaterdag een rondje mee?', hashtags: ['#rondje', 'hondenliefde', '#Utrecht'], visualBrief: 'Bram op hondhoogte in het park, daglicht.', bestTime: 'zaterdag 10:00' },
    { title: 'Zo werkt het', format: 'Reel', hook: 'In 4 stappen naar je vaste rondje', caption: 'Aanmelden, kennismaken, samen lopen, vast moment.', hashtags: ['#vrijwilligerswerk'], visualBrief: 'Handen, riem, voeten op het pad.', bestTime: 'dinsdag 19:00' },
  ],
})

export const ideasFixture = () => ({
  ideas: [
    { title: 'Ruil een rondje tegen koffie', category: 'Partnerschap', why: 'Koffiebars zien wandelaars graag terug.', firstStep: 'Vraag één koffiebar bij het park.', impact: 3, effort: 2, cost: '€0', wildness: 3 },
    { title: 'Krijtstoepen bij de opvang', category: 'Guerrilla', why: 'Gezien door wie er al loopt.', firstStep: 'Vraag de opvang om toestemming.', impact: 2, effort: 1, cost: '€5', wildness: 4 },
    { title: 'Webstability-case over Rondje', category: 'Kruisbestuiving', why: 'Twee projecten in één verhaal.', firstStep: 'Schrijf de case in een uur.', impact: 4, effort: 3, cost: '€0', wildness: 2 },
  ],
})

export const opportunitiesFixture = () => ({
  opportunities: [
    { name: 'Dierenopvang Voorbeeld', type: 'Opvang', url: 'https://example.org/opvang', why: 'Zoekt uitlaters.', howToApproach: 'Mail de coördinator.' },
    { name: 'Onveilige link', type: 'Test', url: 'javascript:alert(1)', why: 'Mag niet klikbaar worden.', howToApproach: '-' },
  ],
})

export const weeklyFixture = () => ({
  headline: 'Deze week: Rondje op straat, de rest op een laag pitje.',
  focus: [{ project: 'Rondje', why: 'De lancering loopt en de eerste opvangen reageren.', firstStep: 'Bel de opvang die nog niet antwoordde.' }],
  wins: ['Marketingplan voor Rondje staat'],
  avoiding: 'De cijfers van vorige maand blijven liggen.',
  boss: { title: 'Organiseer de eerste groepswandeling', project: 'Rondje', why: 'Dat is het verhaal voor alle kanalen.' },
})
