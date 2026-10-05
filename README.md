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
| **Cijfers** (per project) | Het **groeimodel**: één doelcijfer met een deadline (bijvoorbeeld MRR naar €3.000 vóór februari) en de **trechter** ernaartoe (bezoekers → aanvragen → gesprekken → klanten). Claude stelt het voor, jij neemt het over. De cockpit ziet of je op schema ligt en **waar de trechter lekt**, en daar kiest “Nu doen” de klus voor. Cijfers komen vanzelf binnen uit **bronnen** (Plausible, Google Analytics 4, Search Console, Stripe, Mollie, Discord en je eigen apps) met sleutels die alleen kunnen lezen, of vul je zelf in. Per week een tabel, met per cijfer de bron. En de **lessen** van afgeronde experimenten |
| **Marketingbrein** | Profiel (doelgroepen, kanalen, KPI’s, quick wins) en een plan voor 90 dagen; acties worden quests |
| **Marketing** | Overzicht met de cijfers van deze week en “wat nu?” voor organische groei; concepten, mails (wachtrij en verzonden), SEO-artikelen, groei-experimenten met een bord, een kalender, het idee-lab en kansen van het web |
| **Contentweek** | Elke week (op knopdruk of automatisch op maandag) maakt Claude voor al je projecten de posts, carrousels, PDF-carrousels, video-scripts en forumantwoorden, volgens een spelboek per kanaal: **LinkedIn** geeft waarde, **Instagram** doet wat werkt (reels en carrousels die bewaard worden), **TikTok** pakt in de eerste seconde, en op **forums** help je eerst. De cockpit tekent de beelden zelf in de **huisstijl** van elk project (kleuren, letters, @handle), richt alles op het lek in je trechter en leert van eerdere lessen. Reels en TikToks maakt de cockpit zelf als video (1080×1920, met een tekstkaart per beat) uit **je eigen clips en foto’s** (onder Contentweek → Je media) of in je huisstijl; een carrousel wordt voor TikTok een slideshow. Voor video’s waarin je zelf praat of filmt maakt hij een **CapCut-pakket**: een map met script, shotlijst, ondertitels (SRT), tekstkaarten, cover en je clips; exporteer daar `final.mp4` en de cockpit neemt hem over. Jij keurt de week in één keer goed, past een dia aan of laat Claude één item opnieuw maken. Wat je goedkeurt, **plaatst de cockpit zelf** op LinkedIn (je profiel), Instagram (per project) en TikTok (in je concepten), op de dag en tijd van de post, overdag, met een maximum per kanaal per dag en een noodstop; zie [docs/kanalen.md](docs/kanalen.md) voor het koppelen. Forumantwoorden plaats je altijd zelf |
| **Contacten** | Organisaties met hun wettelijke basis om te mailen; per contact een persoonlijke mail met twee opvolgmails, of in één keer voor alle nieuwe contacten; één keer goedkeuren en het gaat vanzelf. De pijplijn: antwoord → gesprek → offerte → gewonnen of verloren, met de waarde van de deal en de volgende stap; elke stap telt mee in de trechter |
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
   **Aan laten staan:** onder Instellingen → *Aan laten staan* (standaard aan) gaat je computer niet slapen zolang de cockpit openstaat en hij aan de stroom zit; het scherm mag wel uit. Zo lopen de dagelijkse ronde, je goedgekeurde mails en de koppeling met Claude Code door terwijl jij weg bent. Op een MacBook: laat de klep open (of gebruik een extern scherm).
8. **Cijfers koppelen (per project, onder Cijfers → Bronnen):**
   - **Plausible:** een API-sleutel (Account → API keys), de site zoals hij in Plausible heet, en eventueel het doel dat een lead is (bijvoorbeeld *Contact*).
   - **Stripe:** alleen een **beperkte** sleutel (`rk_…`, Developers → API keys → Create restricted key) met Read op Charges, Subscriptions en Customers. Een geheime sleutel (`sk_…`) weigert de cockpit.
   - **Mollie:** alleen een **organisatietoken** (`access_…`) met payments.read en subscriptions.read, plus het profiel-ID (`pfl_…`). Een API-sleutel (`live_…`) weigert de cockpit.
   - **Google Analytics 4 en Search Console:** één keer een service-account, onder Instellingen → *Bronnen*. In de Google Cloud Console: IAM → Serviceaccounts → Account maken → Sleutels → Sleutel toevoegen → JSON, en zet in dat project de *Google Analytics Data API* en de *Google Search Console API* aan. Plak de inhoud van het JSON-bestand in de cockpit (daarna toont hij alleen het e-mailadres). Geef dat e-mailadres leesrechten: in GA4 als *Kijker*, in Search Console als *beperkte* gebruiker. Per project vul je daarna het property-ID van GA4 in (met eventueel een sleutelgebeurtenis die als lead of aanmelding telt) of de Search Console-property (`sc-domain:jouwsite.nl`).
   - **Discord:** een uitnodiging die niet verloopt. Geen sleutel nodig; de cockpit leest het aantal leden en wie er online is.
   - **Eigen app:** een stats-adres (https) dat antwoordt met `{ "metrics": { "users": 412, "signups": 9 } }`, of met een `series` per dag. Elk cijfer uit de lijst van de cockpit mag; wat hij niet kent, noemt hij bij **Test**. Met een geheim gaat dat mee als `Authorization: Bearer …`.

   De cockpit haalt de cijfers elke dag zelf op (en met **Nu ophalen**, of voor alles tegelijk onder Instellingen → *Bronnen*). Daarna: **Laat Claude een groeimodel voorstellen**, kijk het na en kies **Overnemen**.

## Automatische mails: de regels

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
- Sleutels van bronnen (Plausible, Stripe, Mollie, het Google-service-account, geheimen van je apps) staan alleen in de lokale database, kunnen alleen lezen, en komen nooit in de pagina, bij Claude of in een foutmelding. De cockpit bewaart alleen tellingen per dag, geen klantgegevens.
- Claude legt alleen cijfers vast die jij hem gaf of die hij zelf las uit een bron die hij noemt; nooit schattingen. En hij zet nooit zelf je doelen: een groeimodel van Claude is een voorstel.
- Tokens van LinkedIn, Instagram en TikTok, het Blob-token en de geheimen van je apps staan alleen in de lokale database en komen nooit in de pagina, bij Claude of in een foutmelding. Instagram-bestanden staan maar een paar minuten in je eigen Vercel Blob-store. De cockpit plaatst alleen wat je goedkeurde, reageert, volgt en DM’t nooit, en koopt geen interactie.
- Claude krijgt geen gereedschap om te mailen of te posten. Hij schrijft concepten; versturen en plaatsen doet de cockpit pas nadat jij hebt goedgekeurd. Forumantwoorden plaats je zelf, altijd met de vermelding dat het je eigen product is.
- De beelden en video’s van de contentweek, en je eigen clips en foto’s, staan in de map `media` naast je database, alleen op je computer. CapCut-pakketten komen in `~/Movies/Cockpit` (Windows: `Video's\Cockpit`).
- Video’s maakt de app met de meegeleverde **ffmpeg** (een build van ffmpeg-static, GPL; licentie en herkomst staan in de app onder `Resources/ffmpeg`). Ontbreekt die, dan gebruikt hij een ffmpeg op je computer (`brew install ffmpeg`), en anders maak je de video in CapCut. De lettertypen die de cockpit gebruikt (Space Grotesk, Inter, Instrument Sans, Fraunces) vallen onder de SIL Open Font License; zie `assets/fonts/OFL.txt`.
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
```

Op elke computer (ook Linux) bouwt `scripts/build-mac.sh` de Mac-app voor de branch `downloads`. Alleen de app en zijn helpers krijgen een nieuwe ad-hoc-handtekening (met `rcodesign`); de Electron-frameworks blijven zoals Electron ze levert. Daarna gaan de twee delen, `install-mac.sh` (met de nieuwe checksum) en `version.json` naar `downloads`.

Bij elke push naar `main` bouwt de workflow `.github/workflows/release.yml` de Mac-app (dmg en zip, voor Apple Silicon en Intel) op macOS en de installer en portable versie op Windows, en start hij op beide systemen de verpakte app één keer. Daarna hangt hij alles aan de GitHub Release van de versie in `package.json` (bijvoorbeeld `v0.3.0`); verhoog de versie voor een nieuwe release.

## Database

Migraties staan in `drizzle/` en worden in `src/db/migrations.json` ingebed; de app migreert zichzelf bij de start. Na een schemawijziging:

```bash
npx drizzle-kit generate --name <wat> && node scripts/embed-migrations.mjs
```

Na de eerste migratie alleen toevoegen: nooit kolommen of tabellen verwijderen of hernoemen (de test bewaakt dat). Elke tabel heeft een `owner_id`, zodat de cockpit later ook voor anderen kan werken.
