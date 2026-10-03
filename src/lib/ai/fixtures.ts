// Fixed answers instead of Claude for tests (AI_FIXTURES=1, never in production). They must pass
// the same wire schemas as real answers; a test checks that.

export const FIXTURE_USAGE = { input_tokens: 9_000, output_tokens: 2_400, cache_read_input_tokens: 0, cache_creation_input_tokens: 0 }

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
