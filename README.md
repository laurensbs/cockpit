# Cockpit

Al je projecten en bedrijven op één plek: gekoppeld aan GitHub, met AI-marketing (plannen, mails, posts, ideeën), quests, XP en streaks, en een overzicht per bedrijf.

Privé en voor één eigenaar. Niets gaat vanzelf naar buiten: de AI maakt concepten, jij verstuurt en post zelf.

## Starten

```bash
npm install
npm run dev        # http://localhost:3000, met een lokale database in .pglite
```

Zet `OWNER_EMAILS` (en eventueel `OWNER_SETUP_CODE`) in `.env.local` om in te loggen. Alle instellingen staan in [`.env.example`](.env.example).

## Controles

```bash
npm run lint && npm run typecheck && npm test
npx next build && E2E_SERVER_CMD="npx next start --port 3300" npx playwright test
```

De e2e-tests draaien met vaste antwoorden in plaats van Claude en GitHub (`AI_FIXTURES=1`, `GITHUB_FIXTURES=1`): ze kosten niets. In productie (Vercel) worden die fixtures altijd genegeerd.

## Database

Migraties staan in `drizzle/` en worden in `src/db/migrations.json` ingebed; de app migreert zichzelf bij de eerste request. Na een schemawijziging:

```bash
npx drizzle-kit generate --name <wat> && node scripts/embed-migrations.mjs
```

Na de eerste migratie alleen toevoegen: nooit kolommen of tabellen verwijderen of hernoemen (de test bewaakt dat).
