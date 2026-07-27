# CRM

CRM om leads op te volgen en verkoop-/opvolgprocessen te optimaliseren, met
rolgebaseerde toegang, geplande opvolgacties (bv. telefoongesprekken) die
automatisch in Google Agenda verschijnen, en aparte funnels voor **Leads FA**
en **Leads RG**.

## Stack

- Next.js (App Router) + TypeScript + Tailwind CSS
- PostgreSQL + Prisma ORM
- Auth.js (NextAuth v5) met e-mail/wachtwoord login
- Google Calendar API (googleapis) voor het automatisch aanmaken van
  agenda-items bij geplande gesprekken

## Rollen & rechten

| Rol | Toegang |
|---|---|
| **Beheerder** | Alle rechten: gebruikers, teams, alle leads/activiteiten, systeeminstellingen |
| **Admin** | Veel rechten: alle leads/activiteiten, gebruikers/teams beheren (behalve Beheerder-accounts) |
| **Coach** | Zichzelf + zijn team (de teamleden die aan hem/haar rapporteren) |
| **User** | Enkel zichzelf |

De logica hiervoor zit in `src/lib/permissions.ts`.

## Funnels: Leads FA & Leads RG

Elke lead hoort bij één van de twee productlijnen (`FA` = Financiële Analyse
/ Financieel Advies, `RG` = Rechtsbijstand/Groep) en doorloopt een eigen,
configureerbare reeks funnel-stages (`FunnelStage` model, per `leadType`).
De seed (`prisma/seed.ts`) zet alvast een standaardset stages klaar:

- **Leads FA**: Nieuwe lead → Eerste contact → Afspraak gepland → Financiële
  analyse uitgevoerd → Voorstel verzonden → Klant / Verloren
- **Leads RG**: Nieuwe lead → Eerste contact → Behoefte in kaart gebracht →
  Offerte verzonden → Contract getekend / Verloren

De Kanban-boards hiervoor staan op `/funnel/FA` en `/funnel/RG`. Stages zijn
aanpasbaar via de `FunnelStage`-tabel (later uit te breiden met een
instellingenscherm).

## Opvolging & Google Agenda

Op een leaddetailpagina (`/leads/[id]`) kan je een activiteit (telefoongesprek,
afspraak, e-mail, notitie) inplannen. Zodra de toegewezen gebruiker zijn
Google Agenda gekoppeld heeft (via **Instellingen**), wordt er automatisch een
agenda-item aangemaakt/bijgewerkt/verwijderd (`src/lib/googleCalendar.ts`).

## Aan de slag

1. Installeer dependencies:

   ```bash
   npm install
   ```

2. Kopieer `.env.example` naar `.env` en vul in:

   ```bash
   cp .env.example .env
   ```

   - `DATABASE_URL`: connectiestring naar je PostgreSQL-database
   - `AUTH_SECRET`: genereer met `npx auth secret`
   - `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` / `GOOGLE_REDIRECT_URI`:
     OAuth-client uit de Google Cloud Console (voeg de redirect-URI toe als
     "Authorized redirect URI"; Calendar API moet ingeschakeld zijn)

3. Migreer en seed de database:

   ```bash
   npm run db:migrate
   npm run db:seed
   ```

   De seed maakt 4 voorbeeldaccounts aan (wachtwoord:
   `Wijzig-Dit-Wachtwoord!1`, wijzig dit meteen):

   - `beheerder@ceuppensconsulting.com` (Beheerder)
   - `admin@ceuppensconsulting.com` (Admin)
   - `coach@ceuppensconsulting.com` (Coach, met een team)
   - `user@ceuppensconsulting.com` (User, lid van het team van de coach)

4. Start de dev-server:

   ```bash
   npm run dev
   ```

   Open [http://localhost:3000](http://localhost:3000).

## Deployen naar Vercel

De app is klaar om te deployen op Vercel; er is geen `vercel.json` nodig
(Next.js wordt automatisch gedetecteerd). Wat wel nodig is:

1. **Database**: maak in het Vercel-project onder **Storage → Create Database
   → Neon** (of Supabase) een gratis PostgreSQL-database aan — de
   `DATABASE_URL` wordt dan automatisch als env var ingesteld.
2. **Overige environment variables** instellen bij **Settings →
   Environment Variables**:

   | Naam | Waarde | Opmerking |
   |---|---|---|
   | `DATABASE_URL` | (automatisch via Neon/Supabase-integratie) | — |
   | `AUTH_SECRET` | output van `npx auth secret` | verplicht |
   | `NEXTAUTH_URL` | *(mag leeg blijven op Vercel)* | de app vertrouwt de Vercel-host automatisch (`trustHost`) |
   | `GOOGLE_CLIENT_ID` | uit Google Cloud Console | enkel nodig voor de Agenda-koppeling |
   | `GOOGLE_CLIENT_SECRET` | uit Google Cloud Console | idem |
   | `GOOGLE_REDIRECT_URI` | `https://<jouw-deploy-domein>/api/google/callback` | moet exact overeenkomen met de "Authorized redirect URI" in Google Cloud Console |

3. **Deploy**: elke deploy voert automatisch `prisma migrate deploy` uit vóór
   de build (zie `build`-script in `package.json`), zodat het databaseschema
   altijd up-to-date is.
4. **Seed-data (eenmalig)**: de seed draait niet automatisch mee in de build.
   Zet lokaal je `.env` z'n `DATABASE_URL` tijdelijk op dezelfde
   Neon/Supabase-connectiestring als op Vercel, en voer dan éénmalig uit:

   ```bash
   npm run db:seed
   ```

   zodat de voorbeeldaccounts (Beheerder/Admin/Coach/User) ook in de
   productie-database staan. Wijzig hun wachtwoorden meteen nadien.

5. **Google Cloud Console**: vergeet niet de definitieve
   `GOOGLE_REDIRECT_URI` (met je echte Vercel-domein) toe te voegen als
   "Authorized redirect URI" bij je OAuth-client, anders slaagt het koppelen
   van Google Agenda niet.

## Scripts

- `npm run dev` — dev-server
- `npm run build` / `npm run start` — productiebuild
- `npm run db:migrate` — Prisma-migraties toepassen (`prisma migrate dev`)
- `npm run db:seed` — seed-data laden
- `npm run db:studio` — Prisma Studio (database-GUI)

## Volgende stappen (niet in deze eerste versie)

- Instellingenscherm om funnel-stages zelf te beheren (nu via de database)
- E-mailopvolging/templates, taken/reminders naast telefoongesprekken
- Rapportage/dashboards per coach/team (conversieratio's, doorlooptijden)
- Drag-and-drop op de funnel-boards (nu een dropdown per lead-kaart)
