# Cockpit

Al je projecten en bedrijven op één plek, als app op je Mac of Windows-pc. De cockpit leest je GitHub, houdt je cijfers bij en maakt van marketing een spel met quests, XP, levels en streaks. **Claude Code is het brein:** het draait op je eigen Claude-abonnement, dus zonder API-kosten.

**Niets gaat zonder jou naar buiten.** Claude maakt concepten. Jij keurt goed. Mails die je goedkeurt, verstuurt de cockpit daarna zelf vanaf je eigen mailbox, binnen je daglimiet. Posts zet je zelf online, met één klik.

## Zo werkt het

1. Je drukt in de cockpit op een knop, bijvoorbeeld **Maak het profiel**, **Maak 5 posts** of **Zoek kansen op het web**.
2. De cockpit opent Claude Code in een eigen venster, met een ticket voor die taak. Heeft het project een **lokale map**, dan start Claude daar en kan hij ook de code lezen.
3. Claude haalt via de cockpit (MCP) alles op wat hij moet weten: de intake, de rode lijnen, README en docs, cijfers, en wat je van eerdere concepten vond. Dan doet hij het werk en zet hij het resultaat terug in de cockpit.
4. De pagina ververst vanzelf zodra het binnen is. In het venster van Claude Code kun je meepraten en bijsturen.

Of je vraagt het gewoon: typ in **Vraag Claude** (op Vandaag en op elk project) of in de **opdrachtbalk** (⌘K, op Windows Ctrl+K) wat je wilt weten of laten doen. Claude krijgt je vraag via de cockpit, met al je projecten, cijfers en contacten erbij, en zet wat hij maakt meteen terug.

Je kunt ook gewoon zelf met Claude Code praten. De cockpit is daar een gereedschapskist, met tools als `list_projects`, `get_project`, `get_task` en `save_posts`, en prompts als `/mcp__cockpit__profile Rondje`.

| Plek | Wat je er doet |
|---|---|
| **Vandaag** | **Klaarzetten** (wat er nog moet tot alles werkt), **Vraag Claude**, **Nu doen**: per project de stap die het meest oplevert, met één klik naar Claude Code; dan de focus van de week, je quests, en per project de gezondheid (0–100) |
| **⌘K** | De opdrachtbalk: naar elke plek of elk project, elke Claude-klus voor elk project, of een vraag aan Claude |
| **Zijbalk** | Je plekken, al je actieve projecten met hun kleur, en of Claude Code gekoppeld is |
| **Projecten** | Per project: intake (vijf vragen), activiteit uit GitHub, repo’s, cijfers per maand, en of de site online is |
| **Cijfers** (per project) | Het **groeimodel**: één doelcijfer met een deadline (bijvoorbeeld MRR naar €3.000 vóór februari) en de **trechter** ernaartoe (bezoekers → aanvragen → gesprekken → klanten). Claude stelt het voor, jij neemt het over. De cockpit ziet of je op schema ligt en **waar de trechter lekt**, en daar kiest “Nu doen” de klus voor. Cijfers komen vanzelf binnen uit **bronnen** (Plausible, Stripe, Mollie) met sleutels die alleen kunnen lezen, of vul je zelf in. Per week een tabel, met per cijfer de bron. En de **lessen** van afgeronde experimenten |
| **Marketingbrein** | Profiel (doelgroepen, kanalen, KPI’s, quick wins) en een plan voor 90 dagen; acties worden quests |
| **Marketing** | Overzicht met de cijfers van deze week en “wat nu?” voor organische groei; concepten, mails (wachtrij en verzonden), SEO-artikelen, groei-experimenten met een bord, een kalender, het idee-lab en kansen van het web |
| **Contacten** | Organisaties met hun wettelijke basis om te mailen; per contact een persoonlijke mail met twee opvolgmails, of in één keer voor alle nieuwe contacten; één keer goedkeuren en het gaat vanzelf. De pijplijn: antwoord → gesprek → offerte → gewonnen of verloren, met de waarde van de deal en de volgende stap; elke stap telt mee in de trechter |
| **Prospectie** (onder Contacten) | Claude zoekt elke werkdag zelf bedrijven die passen bij het project (op de achtergrond, zolang de app open is). Per bedrijf: wat hij op hun eigen site zag, wat je zegt als je belt, en de infomail voor als ze erom vragen. De cockpit haalt hun telefoonnummer en algemene adres zelf van hun site; Claude ziet die nooit. Jij zegt per bedrijf **Ja** (een belkaart bij je quests), **Nee** (nooit meer, met een reden) of **Later**. Op Vandaag staat het bovenaan |
| **Experimenten** (onder Marketing) | Elk experiment meet een cijfer: waar het stond bij de start, waar het nu staat, en of het doel gehaald is. Bij het afronden stelt de cockpit voor of het werkte; jij beslist. Wat eruit kwam wordt een les die Claude bij elke volgende klus leest |
| **LinkedIn** (op het brein) | Je kop, een about-tekst, met wie je moet connecten (met een bericht), een weekritme en posts met de knop “Post op LinkedIn” |
| **Quests** | Quests van regels, van het plan, van de weekfocus of van jezelf; terugkerende quests; badges |
| **GitHub** | **Alles binnenhalen**: al je repo’s, gegroepeerd tot projecten; of kies zelf wat waar hoort |
| **Bedrijven** | Omzet, kosten en winst per maand, per bedrijf en in totaal; alles als CSV voor je boekhouder |

## Installeren

1. **Claude Code:** op de Mac open je Terminal en typ je `curl -fsSL https://claude.ai/install.sh | bash`; op Windows in PowerShell `irm https://claude.ai/install.ps1 | iex`. Start daarna `claude` één keer om in te loggen met je Claude-account (Pro of Max).
2. **Cockpit op de Mac (Apple-chip):** open Terminal, plak deze regel en druk op Enter:

   ```bash
   curl -fsSL https://raw.githubusercontent.com/laurensbs/cockpit/downloads/install-mac.sh -o /tmp/cockpit-install.sh && bash /tmp/cockpit-install.sh
   ```

   Het script ([`install-mac.sh`](https://github.com/laurensbs/cockpit/blob/downloads/install-mac.sh) op de branch `downloads`) downloadt de app en controleert of de download compleet is. Dan zet het Cockpit in Apps en opent het hem. Je gegevens blijven staan. Is er een nieuwe versie, dan zegt de app dat zelf en werkt **Bijwerken** hem met dezelfde regel bij. De eerste keer dat een knop Claude Code opent, vraagt macOS of Cockpit **Terminal** mag bedienen: kies OK. Staat er een dmg bij de Releases, dan kan dat ook: sleep Cockpit naar Apps en kies de eerste keer Systeeminstellingen → Privacy en beveiliging → **Toch openen**.
3. **Cockpit op Windows:** start `Cockpit-Setup-….exe` (installeert) of `Cockpit-…-portable.exe` (draait zonder installatie). Windows SmartScreen vraagt de eerste keer om bevestiging: **Meer info → Toch uitvoeren**.
4. **Instellingen** in de cockpit:
   - je naam;
   - een GitHub-token, alleen-lezen. Maak er een via GitHub → Settings → Developer settings → Fine-grained tokens. Kies je eigen account en *All repositories*, en zet bij Permissions alleen **Contents: Read-only**;
   - Claude Code koppelt de app vanzelf zodra hij het vindt (en opnieuw als het adres verandert). De knop **Koppel aan Claude Code** doet hetzelfde met de hand.
5. **Projecten:** ga naar GitHub → **Alles binnenhalen**, of zet je projecten er zelf in. Wat nog niet op GitHub staat, werkt ook: dan is de intake de bron.

Gebruik je liever de Claude-desktop-app? Onder Instellingen → *Zelf koppelen* staat de configuratie om te plakken.

6. **Mails versturen (optioneel):** onder Instellingen → *Mails versturen* kies je je provider (Gmail, Microsoft 365, TransIP, Strato of een eigen server), vul je je adres en een app-wachtwoord in, stel je een daglimiet in (standaard 20, hoogstens 50), en zet je *Automatisch versturen* aan. Met **Stuur een testmail naar mezelf** controleer je of het werkt.
7. **Autopilot (optioneel):** zet onder Instellingen → Claude Code *Autopilot* aan. Dan maakt Claude Code elke maandagochtend zelf de weekfocus, op de achtergrond. Dat telt mee in je Claude-limieten.
8. **Cijfers koppelen (per project, onder Cijfers → Bronnen):**
   - **Plausible:** een API-sleutel (Account → API keys), de site zoals hij in Plausible heet, en eventueel het doel dat een lead is (bijvoorbeeld *Contact*).
   - **Stripe:** alleen een **beperkte** sleutel (`rk_…`, Developers → API keys → Create restricted key) met Read op Charges, Subscriptions en Customers. Een geheime sleutel (`sk_…`) weigert de cockpit.
   - **Mollie:** alleen een **organisatietoken** (`access_…`) met payments.read en subscriptions.read, plus het profiel-ID (`pfl_…`). Een API-sleutel (`live_…`) weigert de cockpit.

   De cockpit haalt de cijfers elke dag zelf op (en met **Nu ophalen**). Daarna: **Laat Claude een groeimodel voorstellen**, kijk het na en kies **Overnemen**.

## Automatische mails: de regels

- **Koude mail aan bedrijven staat standaard uit.** In Spanje (LSSI art. 21) en Nederland (Telecommunicatiewet 11.7) mag reclame per mail aan bedrijven alleen met toestemming of bij een bestaande relatie. Daarom eerst bellen of langsgaan; vraagt een bedrijf om informatie, dan tik je op **Ze willen info** en gaat de mail. Je kunt het onder Instellingen → Mails versturen aanzetten; laat dat eerst nakijken.
- Alleen mails die jij goedkeurt, naar contacten met een e-mailadres en een wettelijke basis: een zakelijk adres van een organisatie, een bestaande relatie, of toestemming.
- Op werkdagen tussen 9 en 17 uur (Amsterdamse tijd), één tegelijk, minstens 3 minuten na elkaar, nooit meer dan je daglimiet.
- Opvolgmails gaan 4 dagen na de eerste mail en daarna nog eens 7 dagen later, alleen als er geen antwoord is. Zet je een contact op *Antwoord!* of *Geen interesse*, dan stopt de rest meteen. Antwoorden lees je in je eigen mailbox; de cockpit leest je mail niet.
- Elke mail heeft een afmeldregel (die wordt toegevoegd als Claude hem vergat) en een `List-Unsubscribe`-header.
- Je kunt een geplande reeks altijd stoppen onder Marketing → Mails. Dit is geen juridisch advies; voor particulieren heb je in de EU altijd toestemming nodig.

## Veiligheid en privacy

- Alles staat op je eigen computer: op de Mac in `~/Library/Application Support/Cockpit`, op Windows in `%APPDATA%\Cockpit`. Daar staan de database (PGlite), de GitHub-token en de toegangscode van deze installatie.
- De lokale server luistert alleen op `127.0.0.1` en antwoordt alleen aan de app zelf en aan Claude Code, met de toegangscode van deze installatie. Andere websites kunnen er niet bij, ook niet via een omweg met DNS.
- De cockpit **leest** GitHub; hij schrijft er nooit iets. Wat op een sleutel lijkt, wordt weggepoetst voordat het wordt opgeslagen of naar Claude gaat. Per repo kun je Claude uitzetten (bijvoorbeeld voor code van een klant).
- Tekst uit repo’s en contacten gaat als gegevens naar Claude, nooit als instructie. Claude ziet de namen en je notities bij contacten, nooit hun e-mailadres.
- Om te zien of er een nieuwe versie is, haalt de Mac-app elke zes uur `version.json` van de branch `downloads` op GitHub; hij stuurt daarbij niets mee.
- Sleutels van bronnen (Plausible, Stripe, Mollie) staan alleen in de lokale database, kunnen alleen lezen, en komen nooit in de pagina, bij Claude of in een foutmelding. De cockpit bewaart alleen tellingen per dag, geen klantgegevens.
- Claude legt alleen cijfers vast die jij hem gaf of die hij zelf las uit een bron die hij noemt; nooit schattingen. En hij zet nooit zelf je doelen: een groeimodel van Claude is een voorstel.
- Claude krijgt geen gereedschap om te mailen of te posten. Hij schrijft concepten; versturen doet de cockpit pas nadat jij hebt goedgekeurd.
- Het wachtwoord van je mailbox staat alleen in de lokale database op je computer. Gebruik een app-wachtwoord, dan kun je het altijd intrekken.

## Ontwikkelen

```bash
npm install
npm run dev                 # http://127.0.0.1:3000/auth?token=dev
npm run lint && npm run typecheck && npm test
npx next build && E2E_SERVER_CMD="npx next start --port 3300" npx playwright test
```

Met `GITHUB_FIXTURES=1` werkt GitHub met vaste antwoorden, zonder token. De e2e-tests spelen de rol van Claude Code: ze praten via MCP met de cockpit, precies zoals Claude dat doet.

**De desktop-app:**

```bash
npm run electron:build      # next build → release/server → dist-electron → release/dist (Windows: .exe; op een Mac: npm run electron:build:mac)
npm run test:electron       # rooktest van de app (onder Linux: xvfb-run -a …)
bash scripts/install-mac-local.sh   # op je eigen Mac (Apple-chip): controles, bouwen, rooktest, kopie van je database, en in Apps zetten
```

Het lokale script heeft GitHub niet nodig: het werkt ook als GitHub Actions niet draait. De oude app gaat naar de prullenmand. Een kopie van je database komt in `~/Library/Application Support/Cockpit-backups`. Met `--quick` sla je de controles over; met `--open` gaat Cockpit daarna open.

Op elke computer (ook Linux) bouwt `scripts/build-mac.sh` de Mac-app voor de branch `downloads`. Alleen de app en zijn helpers krijgen een nieuwe ad-hoc-handtekening (met `rcodesign`); de Electron-frameworks blijven zoals Electron ze levert. Daarna gaan de twee delen, `install-mac.sh` (met de nieuwe checksum) en `version.json` naar `downloads`.

Bij elke push naar `main` bouwt de workflow `.github/workflows/release.yml` de Mac-app (dmg en zip, voor Apple Silicon en Intel) op macOS en de installer en portable versie op Windows, en start hij op beide systemen de verpakte app één keer. Daarna hangt hij alles aan de GitHub Release van de versie in `package.json` (bijvoorbeeld `v0.3.0`); verhoog de versie voor een nieuwe release.

## Database

Migraties staan in `drizzle/` en worden in `src/db/migrations.json` ingebed; de app migreert zichzelf bij de start. Na een schemawijziging:

```bash
npx drizzle-kit generate --name <wat> && node scripts/embed-migrations.mjs
```

Na de eerste migratie alleen toevoegen: nooit kolommen of tabellen verwijderen of hernoemen (de test bewaakt dat). Elke tabel heeft een `owner_id`, zodat de cockpit later ook voor anderen kan werken.
