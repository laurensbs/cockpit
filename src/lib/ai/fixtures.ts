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

// A written-out article long enough for the quality gate (800–1200 words, at least three H2s).
const SECTION = (h: string, focus: string) =>
  `## ${h}\n\n${[
    `Veel opvangen in de buurt hebben te weinig handen, vooral doordeweeks en in de vakanties. ${focus}`,
    'Je hoeft geen ervaring te hebben: de vrijwilligers van de opvang leggen uit hoe je een hond aanlijnt, welke route rustig is en wat je doet als de hond schrikt van een fiets of een andere hond.',
    'Plan je eerste wandeling op een vast moment in de week, zodat de hond en de verzorgers op je kunnen rekenen. Een korte vaste ronde werkt beter dan een lange wandeling die je maar af en toe maakt.',
    'Neem water mee, een paar zakjes en je telefoon, en laat de hond in het begin vooral snuffelen: zo leert hij jou kennen en jij hem. Vertel na afloop kort hoe het ging, dan weet de opvang wat de hond nodig heeft.',
  ].join(' ')}`
const ARTICLE_BODY = [
  '# Vrijwilligerswerk met honden',
  SECTION('Waarom opvangen hulp zoeken', 'Een hond die elke dag naar buiten gaat, is rustiger in het asiel en vindt sneller een nieuw huis.'),
  SECTION('Stap 1: kies een opvang', 'Begin dichtbij huis, zodat je er makkelijk heen fietst of loopt en het ook in de winter volhoudt.'),
  SECTION('Stap 2: kennismaken', 'De eerste keer loop je mee met een vaste vrijwilliger, die je de honden en de regels laat zien.'),
  SECTION('Stap 3: je eerste rondje alleen', 'Na een paar keer meelopen mag je alleen met een rustige hond op pad, op een route die je al kent.'),
  SECTION('Veelgestelde vragen', 'Mag je een eigen hond meenemen? Meestal niet tijdens de wandeling, want honden die elkaar niet kennen kunnen schrikken.'),
].join('\n\n')

export const articlesFixture = () => ({
  keywords: [
    { keyword: 'vrijwilligerswerk met honden', intent: 'informatief', difficulty: 'laag', why: 'Studenten zoeken dit vlak voor de zomer.' },
    { keyword: 'hond uitlaten asiel', intent: 'transactioneel', difficulty: 'middel', why: 'Mensen die al willen helpen.' },
  ],
  articles: [
    {
      title: 'Vrijwilligerswerk met honden: zo begin je in 4 stappen',
      slug: 'Vrijwilligerswerk met honden!',
      metaDescription: 'Zin om honden uit te laten? Zo vind je een opvang, wat je nodig hebt en hoe je eerste rondje gaat.',
      keywords: ['vrijwilligerswerk met honden', 'hond uitlaten asiel'],
      outline: ['Waarom opvangen hulp zoeken', 'Stap 1: kies een opvang', 'Stap 2: kennismaken'],
      body: ARTICLE_BODY,
    },
    { title: 'Wat je moet weten voor je eerste rondje', slug: '', metaDescription: 'Riem, route en regels.', keywords: ['eerste keer hond uitlaten'], outline: ['De riem', 'De route'], body: '' },
  ],
})

export const experimentsFixture = () => ({
  experiments: [
    {
      title: 'Flyer met QR bij de bieb van de universiteit',
      hypothesis: 'Als studenten een QR zien op hun vaste studieplek, melden er 10 per week aan.',
      channel: 'Offline',
      steps: ['Maak een A5-flyer met QR', 'Vraag de bieb om toestemming', 'Hang 10 flyers op'],
      metric: 'Aanmeldingen via de QR',
      target: '10 per week',
      impact: 7,
      confidence: 6,
      ease: 9,
      cost: '€15',
    },
    {
      title: 'Wekelijkse hond-van-de-week op Instagram',
      hypothesis: 'Een vaste rubriek levert elke week nieuwe volgers op.',
      channel: 'Instagram',
      steps: ['Kies elke maandag een hond', 'Post op vrijdag 17:00'],
      metric: 'Nieuwe volgers per week',
      target: '+25',
      impact: 5,
      confidence: 7,
      ease: 8,
      cost: '€0',
    },
  ],
})

export const linkedinFixture = () => ({
  headline: 'Bouwer van Rondje: jongeren en asielhonden samen op pad',
  about: 'Ik bouw Rondje, een gratis platform dat jonge vrijwilligers koppelt aan honden in opvangen.',
  featured: ['De site van Rondje', 'Het verhaal achter Rondje'],
  connect: [{ who: 'Coördinatoren van dierenopvangen', why: 'Zij beslissen over vrijwilligers.', message: 'Hoi! Ik bouw Rondje: gratis wandelingen voor jullie honden door jonge vrijwilligers. Mag ik je toevoegen?' }],
  routine: ['Maandag: één post', 'Dagelijks: drie reacties bij opvangen en vrijwilligersorganisaties'],
  posts: [{ hook: 'Elke hond in een opvang wacht op één ding.', text: 'Elke hond in een opvang wacht op één ding: een rondje. Daarom bouw ik Rondje.', hashtags: ['#vrijwilligerswerk', 'dierenwelzijn', '#Rondje'] }],
})
