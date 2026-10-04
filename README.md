# Cockpit

Al je projecten en bedrijven op één plek, als app op je Windows-pc. De cockpit leest je GitHub, houdt je cijfers bij en maakt van marketing een spel met quests, XP, levels en streaks. **Claude Code is het brein:** het draait op je eigen Claude-abonnement, dus zonder API-kosten.

**Niets gaat vanzelf naar buiten.** Claude maakt concepten; jij kopieert, plant, verstuurt en post zelf.

## Zo werkt het

1. Je drukt in de cockpit op een knop, bijvoorbeeld **Maak het profiel**, **Maak 5 posts** of **Zoek kansen op het web**.
2. De cockpit opent Claude Code in een eigen venster, met een ticket voor die taak. Heeft het project een **lokale map**, dan start Claude daar en kan hij ook de code lezen.
3. Claude haalt via de cockpit (MCP) alles op wat hij moet weten: de intake, de rode lijnen, README en docs, cijfers, en wat je van eerdere concepten vond. Dan doet hij het werk en zet hij het resultaat terug in de cockpit.
4. De pagina ververst vanzelf zodra het binnen is. In het venster van Claude Code kun je meepraten en bijsturen.

Je kunt ook gewoon zelf met Claude Code praten. De cockpit is daar een gereedschapskist, met tools als `list_projects`, `get_project`, `get_task` en `save_posts`, en prompts als `/mcp__cockpit__profile Rondje`.

| Plek | Wat je er doet |
|---|---|
| **Vandaag** | Level, XP en streaks, de focus van de week, je quests, en per project de gezondheid (0–100) |
| **Projecten** | Per project: intake (vijf vragen), activiteit uit GitHub, repo’s, cijfers per maand, en of de site online is |
| **Marketingbrein** | Profiel (doelgroepen, kanalen, KPI’s, quick wins) en een plan voor 90 dagen; acties worden quests |
| **Studio** | Mails, posts per platform, een weekkalender, het idee-lab en kansen van het web |
| **Contacten** | Organisaties met hun wettelijke basis om te mailen, een persoonlijke mail per contact, en de status tot en met “antwoord” |
| **Quests** | Quests van regels, van het plan, van de weekfocus of van jezelf; terugkerende quests; badges |
| **Bedrijven** | Omzet, kosten en winst per maand, per bedrijf en in totaal; alles als CSV voor je boekhouder |

## Installeren

1. **Claude Code:** open PowerShell, typ `irm https://claude.ai/install.ps1 | iex` en start daarna `claude` één keer om in te loggen met je Claude-account (Pro of Max).
2. **Cockpit:** start `Cockpit-Setup-….exe` (installeert) of `Cockpit-…-portable.exe` (draait zonder installatie). De app is niet digitaal ondertekend, dus Windows SmartScreen vraagt de eerste keer om bevestiging: **Meer info → Toch uitvoeren**.
3. **Instellingen** in de cockpit:
   - je naam;
   - een GitHub-token, alleen-lezen. Maak er een via GitHub → Settings → Developer settings → Fine-grained tokens. Kies je eigen account en *All repositories*, en zet bij Permissions alleen **Contents: Read-only**;
   - **Koppel aan Claude Code**. Dat registreert de cockpit bij Claude Code voor jouw account op deze pc.
4. **Projecten:** zet je projecten erin. Wat nog niet op GitHub staat, werkt ook: dan is de intake de bron.

Gebruik je liever de Claude-desktop-app? Onder Instellingen → *Zelf koppelen* staat de configuratie om te plakken.

## Veiligheid en privacy

- Alles staat op je pc, in `%APPDATA%\Cockpit`: de database (PGlite), de GitHub-token en de toegangscode van deze installatie.
- De lokale server luistert alleen op `127.0.0.1` en antwoordt alleen aan de app zelf en aan Claude Code, met de toegangscode van deze installatie. Andere websites kunnen er niet bij, ook niet via een omweg met DNS.
- De cockpit **leest** GitHub; hij schrijft er nooit iets. Wat op een sleutel lijkt, wordt weggepoetst voordat het wordt opgeslagen of naar Claude gaat. Per repo kun je Claude uitzetten (bijvoorbeeld voor code van een klant).
- Tekst uit repo’s en contacten gaat als gegevens naar Claude, nooit als instructie. Claude ziet de namen en je notities bij contacten, nooit hun e-mailadres.
- Claude krijgt geen gereedschap om te mailen of te posten. Een mail opent in je eigen mailapp.

## Ontwikkelen

```bash
npm install
npm run dev                 # http://127.0.0.1:3000/auth?token=dev
npm run lint && npm run typecheck && npm test
npx next build && E2E_SERVER_CMD="npx next start --port 3300" npx playwright test
```

Met `GITHUB_FIXTURES=1` werkt GitHub met vaste antwoorden, zonder token. De e2e-tests spelen de rol van Claude Code: ze praten via MCP met de cockpit, precies zoals Claude dat doet.

**De Windows-app:**

```bash
npm run electron:build      # next build → release/server → dist-electron → release/dist/*.exe
npm run test:electron       # rooktest van de app (onder Linux: xvfb-run -a …)
```

Bij elke push naar `main` bouwt de workflow `.github/workflows/windows.yml` op Windows de installer en de portable versie. Bij een tag `v*` hangt hij ze aan een GitHub Release.

## Database

Migraties staan in `drizzle/` en worden in `src/db/migrations.json` ingebed; de app migreert zichzelf bij de start. Na een schemawijziging:

```bash
npx drizzle-kit generate --name <wat> && node scripts/embed-migrations.mjs
```

Na de eerste migratie alleen toevoegen: nooit kolommen of tabellen verwijderen of hernoemen (de test bewaakt dat). Elke tabel heeft een `owner_id`, zodat de cockpit later ook voor anderen kan werken.
