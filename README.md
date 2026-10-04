# Cockpit

Al je projecten en bedrijven op één plek, als app op je Windows-pc. De cockpit leest je GitHub, houdt je cijfers bij en maakt van marketing een spel met quests, XP, levels en streaks. **Claude Code is het brein:** het draait op je eigen Claude-abonnement, dus zonder API-kosten.

**Niets gaat zonder jou naar buiten.** Claude maakt concepten. Jij keurt goed. Mails die je goedkeurt, verstuurt de cockpit daarna zelf vanaf je eigen mailbox, binnen je daglimiet. Posts zet je zelf online, met één klik.

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
| **Marketing** | Overzicht met de cijfers van deze week en “wat nu?” voor organische groei; concepten, mails (wachtrij en verzonden), SEO-artikelen, groei-experimenten met een bord, een kalender, het idee-lab en kansen van het web |
| **Contacten** | Organisaties met hun wettelijke basis om te mailen; per contact een persoonlijke mail met twee opvolgmails, of in één keer voor alle nieuwe contacten; één keer goedkeuren en het gaat vanzelf |
| **LinkedIn** (op het brein) | Je kop, een about-tekst, met wie je moet connecten (met een bericht), een weekritme en posts met de knop “Post op LinkedIn” |
| **Quests** | Quests van regels, van het plan, van de weekfocus of van jezelf; terugkerende quests; badges |
| **GitHub** | **Alles binnenhalen**: al je repo’s, gegroepeerd tot projecten; of kies zelf wat waar hoort |
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

5. **Mails versturen (optioneel):** onder Instellingen → *Mails versturen* kies je je provider (Gmail, Microsoft 365, TransIP, Strato of een eigen server), vul je je adres en een app-wachtwoord in, stel je een daglimiet in (standaard 20, hoogstens 50), en zet je *Automatisch versturen* aan. Met **Stuur een testmail naar mezelf** controleer je of het werkt.
6. **Autopilot (optioneel):** zet onder Instellingen → Claude Code *Autopilot* aan. Dan maakt Claude Code elke maandagochtend zelf de weekfocus, op de achtergrond. Dat telt mee in je Claude-limieten.

## Automatische mails: de regels

- Alleen mails die jij goedkeurt, naar contacten met een e-mailadres en een wettelijke basis: een zakelijk adres van een organisatie, een bestaande relatie, of toestemming.
- Op werkdagen tussen 9 en 17 uur (Amsterdamse tijd), één tegelijk, minstens 3 minuten na elkaar, nooit meer dan je daglimiet.
- Opvolgmails gaan 4 dagen na de eerste mail en daarna nog eens 7 dagen later, alleen als er geen antwoord is. Zet je een contact op *Antwoord!* of *Geen interesse*, dan stopt de rest meteen. Antwoorden lees je in je eigen mailbox; de cockpit leest je mail niet.
- Elke mail heeft een afmeldregel (die wordt toegevoegd als Claude hem vergat) en een `List-Unsubscribe`-header.
- Je kunt een geplande reeks altijd stoppen onder Marketing → Mails. Dit is geen juridisch advies; voor particulieren heb je in de EU altijd toestemming nodig.

## Veiligheid en privacy

- Alles staat op je pc, in `%APPDATA%\Cockpit`: de database (PGlite), de GitHub-token en de toegangscode van deze installatie.
- De lokale server luistert alleen op `127.0.0.1` en antwoordt alleen aan de app zelf en aan Claude Code, met de toegangscode van deze installatie. Andere websites kunnen er niet bij, ook niet via een omweg met DNS.
- De cockpit **leest** GitHub; hij schrijft er nooit iets. Wat op een sleutel lijkt, wordt weggepoetst voordat het wordt opgeslagen of naar Claude gaat. Per repo kun je Claude uitzetten (bijvoorbeeld voor code van een klant).
- Tekst uit repo’s en contacten gaat als gegevens naar Claude, nooit als instructie. Claude ziet de namen en je notities bij contacten, nooit hun e-mailadres.
- Claude krijgt geen gereedschap om te mailen of te posten. Hij schrijft concepten; versturen doet de cockpit pas nadat jij hebt goedgekeurd.
- Het wachtwoord van je mailbox staat alleen in de lokale database op je pc. Gebruik een app-wachtwoord, dan kun je het altijd intrekken.

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
