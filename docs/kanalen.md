# Kanalen koppelen: LinkedIn, Instagram en TikTok

De Cockpit plaatst alleen wat jij in de **Contentweek** goedkeurt, op je eigen accounts, op de dag en tijd van de post, tussen 7 en 22 uur, met hoogstens 2 (LinkedIn) of 3 (Instagram, TikTok) posts per dag per kanaal en minstens een halfuur ertussen. Met **Plaatsen op pauze** (Instellingen → Kanalen) staat alles stil. Zonder koppeling plaats je zelf: kopieer de tekst, download de beelden en druk op **Geplaatst**.

Alle sleutels en tokens blijven op je computer. Je maakt de apps hieronder zelf aan; de Cockpit maakt geen accounts en geeft geen geld uit.

## LinkedIn (je eigen profiel)

1. Ga naar <https://www.linkedin.com/developers/apps> → **Create app**. LinkedIn vraagt een bedrijfspagina; gebruik die van Webstability.
2. Tab **Products**: vraag **Share on LinkedIn** en **Sign In with LinkedIn using OpenID Connect** aan. Beide zijn gratis en meestal direct actief.
3. Tab **Auth**: zet bij *Authorized redirect URLs* het adres dat de Cockpit toont onder Instellingen → Kanalen (`http://localhost:41414/api/oauth/linkedin/callback`).
4. Kopieer **Client ID** en **Primary Client Secret** naar de Cockpit en druk op **Koppel LinkedIn**. Log in in je browser; de Cockpit ziet de koppeling vanzelf.
5. Na 60 dagen druk je op **Opnieuw koppelen** (LinkedIn verlengt zelfbedienings-apps niet automatisch).

De Cockpit plaatst tekstposts, een afbeelding, een PDF-carrousel (document) of een video.

## Instagram (per project een zakelijk of creator-account)

1. Zet het Instagram-account om naar een **professioneel account** (Instellingen in de Instagram-app → Accounttype).
2. Ga naar <https://developers.facebook.com/apps> → **Create app** → type **Business**. Voeg het product **Instagram** toe en kies **API setup with Instagram login**.
3. Voeg je Instagram-account toe als tester (Roles → Instagram Testers) en accepteer de uitnodiging in de Instagram-app (Instellingen → Apps en websites).
4. Zet bij de permissies ook `instagram_business_manage_insights` aan (voor de cijfers per post). Druk bij je account op **Generate token** en plak het token in de Cockpit, bij het juiste project. De Cockpit verlengt het token elke week, zolang de app gebruikt wordt.
5. **Vercel Blob:** Instagram haalt beelden en video’s van een openbaar adres. Maak in Vercel een Blob-store (Storage → Create → Blob) en plak het **read-write-token** (`vercel_blob_rw_…`) in de Cockpit. Elk bestand staat er maar een paar minuten; daarna haalt de Cockpit het weg. Binnen de gratis limieten van Vercel kost dit niets.

De Cockpit plaatst losse foto’s, carrousels (tot 10 dia’s), reels en stories.

## TikTok (per project)

1. Ga naar <https://developers.tiktok.com/apps> → **Connect an app**.
2. Voeg de producten **Login Kit** (platform *Desktop*), **Content Posting API** en **Display API** toe, met de scopes `user.info.basic`, `user.info.stats`, `video.upload` en `video.list`. De laatste twee zijn voor de cijfers: volgers, en weergaven en likes per video.
3. Zet als **redirect URI** het adres uit de Cockpit (`http://127.0.0.1:41414/api/oauth/tiktok/callback`).
4. Kopieer **Client key** en **Client secret** naar de Cockpit, kies het project en druk op **Koppel TikTok**.

Zolang TikTok je app niet heeft goedgekeurd, zet de Cockpit video’s in je **TikTok-concepten**: je krijgt een melding, kiest in de app een geluid en plaatst hem. Dat is ook wat het beste werkt (trending geluid). Voor de review vraagt TikTok een website, voorwaarden, een privacyverklaring en een demovideo; de teksten hieronder kun je op de site van Webstability zetten.

### Privacyverklaring (voor de TikTok-review)

> **Privacy – Cockpit (een tool van Webstability)**
>
> Cockpit is een programma dat alleen op de computer van de eigenaar draait. Het gebruikt TikTok om video’s die de eigenaar zelf heeft gemaakt en goedgekeurd naar zijn eigen TikTok-account te sturen, en om het aantal volgers en weergaven van zijn eigen video’s te tonen.
>
> - We verwerken alleen gegevens van het eigen account van de eigenaar: de weergavenaam, het aantal volgers en de cijfers van zijn eigen video’s.
> - Toegangstokens en cijfers worden alleen op de computer van de eigenaar bewaard. We sturen niets naar eigen servers en delen niets met derden.
> - Je kunt de koppeling altijd intrekken in TikTok (Instellingen → Beveiliging → Apps) of in Cockpit (Instellingen → Kanalen → Weg). Dan wissen we de tokens direct.
> - Vragen: [jouw e-mailadres bij Webstability].

### Gebruiksvoorwaarden (voor de TikTok-review)

> **Voorwaarden – Cockpit**
>
> Cockpit is een persoonlijk hulpmiddel voor de eigenaar van de gekoppelde accounts. Het plaatst alleen content die de eigenaar zelf heeft goedgekeurd, op zijn eigen accounts, en houdt zich aan de regels van TikTok, waaronder de Community Guidelines. Het plaatst geen reacties, berichten of volgacties en koopt geen interactie. De eigenaar blijft verantwoordelijk voor wat hij plaatst. Er wordt geen garantie gegeven op beschikbaarheid van de koppeling met TikTok.

### Demovideo

Neem je scherm op: in de Cockpit een video goedkeuren, op **Nu plaatsen** drukken, en in de TikTok-app laten zien dat hij in je concepten staat.

## Cijfers per post: leren wat werkt

- **Instagram en TikTok:** de Cockpit haalt elke dag (of als je op **Cijfers ophalen** drukt, onder Contentweek → Wat werkt) de cijfers op van posts uit de laatste 30 dagen: weergaven, bereik, likes, reacties, gedeeld en bewaard, en het aantal volgers per project.
- **TikTok-concepten:** zolang een video in je concepten staat, heeft hij nog geen cijfers. Plaats je hem in de app, dan ziet de Cockpit bij de volgende ronde welke video het werd. Lukt dat niet, plak dan de link van je TikTok bij de post.
- **LinkedIn** geeft de cijfers van je eigen posts alleen aan goedgekeurde partners. Vul ze dus zelf in, een paar dagen na het plaatsen: open de post op LinkedIn, kies Statistieken, en neem de getallen over onder **Nog in te vullen**. Je volgers op LinkedIn kun je bij Cijfers invoeren (Volgers LinkedIn).
- Claude krijgt bij elke contentweek per project wat werkte: per kanaal de middenwaarde, per vorm het bereik en de interactie, en de beste en zwakste posts. Met minder dan vijf gemeten posts per kanaal zegt hij dat het nog te vroeg is, en blijft hij variëren.

## Forums

Forumantwoorden plaats je altijd zelf. Reddit en de meeste fora verbieden automatisch posten, en een antwoord van jezelf, met de vermelding dat het je eigen product is, werkt beter.
