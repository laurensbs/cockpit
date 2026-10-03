# Cockpit

Al je projecten en bedrijven op één plek: gekoppeld aan GitHub, met AI-marketing (profiel, plan voor 90 dagen, mails, posts, ideeën en kansen van het web), quests met XP, levels en streaks, en een overzicht per bedrijf met omzet, kosten en winst.

Privé en voor één eigenaar. **Niets gaat vanzelf naar buiten:** Claude maakt concepten; jij kopieert, plant, verstuurt en post zelf.

## Wat er in zit

| Plek | Wat je er doet |
|---|---|
| **Vandaag** | Level, XP en streaks, de focus van de week, je quests, en per project de gezondheid (0–100) met de reden als die laag is |
| **Projecten** | Je projecten per bedrijf of per fase. Per project: intake (vijf vragen), activiteit uit GitHub, repo’s, cijfers per maand, en of de site online is |
| **Marketingbrein** (per project) | Profiel: doelgroepen en waar ze zitten, kanalen met een eerste stap, KPI’s, risico’s, quick wins. Plan voor 90 dagen: acties die je met een vinkje quests maakt |
| **Studio** | Mails (outreach, partners, pers, nieuwsbrief, lancering, opvolgreeks), 5 posts per platform, een weekkalender, het idee-lab (zes manieren van denken, met een impact/moeite-matrix) en kansen zoeken op het web |
| **Contacten** (per project) | Organisaties met hun wettelijke basis om te mailen, een persoonlijke mail per contact, en de status tot en met “antwoord” |
| **Quests** | Quests van regels, van het plan, van de weekfocus of van jezelf; terugkerende quests (btw, domeinen); badges en XP-historie |
| **Bedrijven** | Omzet, kosten en winst per maand, per bedrijf en in totaal; KvK/btw, land en notities |
| **GitHub** | Alle repo’s, slim gegroepeerd; kies wat bij welk project hoort |

## Zo zet je hem aan

1. **Vercel-project** gekoppeld aan deze repo, met **Fluid compute aan** (AI-taken mogen tot 5 minuten duren).
2. **Database:** een Postgres-database (Neon, gratis) in `DATABASE_URL`. Een database van neon.new moet je binnen 72 uur claimen, anders verdwijnt hij.
3. **Inloggen:** zet `OWNER_EMAILS` (jouw adres), `OWNER_SETUP_CODE` (een eenmalige code) en `BETTER_AUTH_SECRET` (lang en willekeurig). Open de site, kies **Eerste keer**, vul de code in, en voeg daarna Face ID toe. Zonder de code kan niemand de cockpit claimen, ook niet met jouw adres.
4. **GitHub:** maak een *fine-grained token*, alleen-lezen: GitHub → Settings → Developer settings → Fine-grained tokens → Generate. Eigen account, *All repositories*, en bij Permissions alleen **Contents: Read-only** (Metadata komt vanzelf mee). Zet hem in `GITHUB_TOKEN`. Laat hem na een jaar verlopen en maak dan een nieuwe.
5. **Claude:** maak in de Anthropic Console een eigen workspace “Cockpit” met een **maandlimiet van $10**, en daarin een API-key → `ANTHROPIC_API_KEY`. De cockpit heeft zelf ook een harde limiet (`AI_MONTHLY_BUDGET_USD`, standaard 10) en geeft per dag hooguit een vijfde uit. Elke run reserveert vooraf het slechtste geval en toont na afloop wat hij echt kostte. Server-side fallbacks staan aan: weigert het model een verzoek, dan probeert Anthropic het met een ander model.
6. **Dagelijkse taak:** zet `CRON_SECRET` (lang en willekeurig). Elke dag om 05:00 UTC: GitHub opnieuw lezen, sites controleren, quests maken. Op maandag ook de weekmail (met `RESEND_API_KEY` en `EMAIL_FROM` van een geverifieerd domein) en, met `WEEKLY_AI=1`, de weekfocus.
7. **Op je iPhone:** open de site in Safari → Deel → **Zet op beginscherm**.

Alle instellingen staan in [`.env.example`](.env.example). `/api/health` laat zien wat er gekoppeld is, zonder sleutels.

## Kosten

- **Claude:** een profiel of plan ongeveer $0,10–0,30, mails of posts een paar cent, kansen zoeken (met web search) ongeveer $0,20–0,60. Binnen de limiet die je zelf zet.
- **Vercel:** het gratis Hobby-plan is bedoeld voor niet-commercieel gebruik. Gebruik je de cockpit voor je bedrijven, dan is Pro (ongeveer $20 per maand) de nette keuze.
- **Neon:** de gratis laag is ruim genoeg.

## Veiligheid en privacy

- De cockpit **leest** GitHub (README, docs, stack, commits); hij schrijft er nooit iets. Wat op een sleutel lijkt, wordt weggepoetst voordat het wordt opgeslagen of naar de AI gaat. Per repo kun je de AI uitzetten (bijvoorbeeld voor code van een klant).
- Tekst uit repo’s en contacten gaat als gegevens naar Claude, in tags die hij niet kan openbreken, met de regel dat er nooit instructies uit worden opgevolgd. Claude heeft geen gereedschap behalve (bij kansen) web search; alles wat terugkomt is een concept.
- Alleen echte webadressen (http/https) worden klikbaar. Een mail opent in je eigen mailapp; ontvangers komen alleen uit je contacten.
- Strikte CSP met nonce, `noindex` overal, sleutels alleen in Vercel.
- Contacten: alleen organisaties, zakelijke adressen of mensen met wie je al contact hebt. Elke mail krijgt een afmeldregel. Dit is geen juridisch advies.

## Ontwikkelen

```bash
npm install
npm run dev        # http://localhost:3000, met een lokale database in .pglite
```

Zet `OWNER_EMAILS` (en eventueel `OWNER_SETUP_CODE`) in `.env.local` om in te loggen. Met `AI_FIXTURES=1` en `GITHUB_FIXTURES=1` werkt alles met vaste antwoorden, zonder sleutels en zonder kosten (in productie worden die altijd genegeerd).

```bash
npm run lint && npm run typecheck && npm test
npx next build && E2E_SERVER_CMD="npx next start --port 3300" npx playwright test
```

De e2e-tests lopen in volgorde (01–06) door één verhaal: claimen, spelen, projecten, brein, studio, cron.

## Database

Migraties staan in `drizzle/` en worden in `src/db/migrations.json` ingebed; de app migreert zichzelf bij de eerste request. Na een schemawijziging:

```bash
npx drizzle-kit generate --name <wat> && node scripts/embed-migrations.mjs
```

Na de eerste migratie alleen toevoegen: nooit kolommen of tabellen verwijderen of hernoemen (de test bewaakt dat). Elke tabel heeft een `owner_id`, zodat de cockpit later ook voor anderen kan werken.
