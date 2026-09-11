# CLAUDE.md

Booking system for the coworking spaces in Valle Soana (Piedmont, Italy).
Built and operated by **Comunità Sassifraga APS**, which is the sole data
controller. Spaces are municipally managed (Ingria, Ronco Canavese, Valprato
Soana), and **no personal data is ever transmitted to a municipality** — only
aggregate statistics. See SPEC D10.

**Read `docs/SPEC.md` before any non-trivial change. It is the source of truth.**
The spec is written in Italian and is maintained by a non-technical stakeholder.
If code and spec disagree, the spec wins — flag the discrepancy, do not silently
"fix" the spec to match the code.

---

## Stack

- Next.js (App Router) + TypeScript + Tailwind CSS
- Supabase (Postgres + Auth), **eu-central-1 / Frankfurt**
- Auth: **magic link only**. No passwords, no OAuth, no social login.
- Resend for transactional email, sending from `noreply@coworking.sassifraga.org`
- Deployed on Vercel, served at **`prenota.sassifraga.org`**
- PWA: installable, read-only offline cache of availability

The app lives on its own subdomain, never under `www.sassifraga.org/...` — the
institutional site is Google Sites and cannot route a path to an external app.
Never render the app inside an iframe on that site either: third-party cookie
blocking on Safari/iOS would kill the session cookie and break login for every
iPhone user. See SPEC §14.

Outbound mail always uses the dedicated subdomain, never the apex domain — the
apex carries Google Workspace records for `info@sassifraga.org`, and a botched
second sender there can send the association's own mail to spam. See SPEC §14.2.

---

## Hard rules — never violate these

1. **Email is the only mandatory personal field.** Public name, age, gender,
   job title, reason for visit, residence, language are optional.
   The list is closed: **never add any other personal field** — name, surname,
   phone, address, date of birth, fiscal code — to the schema, a form, or a
   validation, on your own initiative. If a feature seems to require one,
   stop and ask.

2. **Every table has Row Level Security enabled**, with explicit policies.
   A migration that creates a table without RLS is incomplete. RLS is the
   enforcement layer; application-level checks are a convenience on top, never
   a substitute.

3. **Public name visibility is enforced in the database.** A row where
   `mostra_nome_pubblico = false` must be unreachable from any public query.
   Never filter public names in a React component or an API handler alone.

4. **Never log email addresses, magic-link tokens, or any personal data** —
   not in `console.log`, not in error messages, not in Sentry-style capture,
   not in analytics events. Use user IDs.

   *Scope note, so this is not misread:* this rule is about logs, diagnostics
   and analytics. It does not forbid the transactional emails the spec requires.
   In particular the **moderation notice** of SPEC §6.5 is a deliberate,
   specified email that carries another user's `nome_pubblico` and `utente_id`
   to `EMAIL_MODERAZIONE`. It is correct and must not be "fixed" or removed.
   What it must never carry is that user's **email address** — the internal id
   is what the admin acts on.

5. **Concurrency on booking is enforced by a database constraint**, never by a
   read-then-write check in application code. See SPEC §8.1: unique index on
   `(sede_id, data, fascia, posto_progressivo)`. Any change to booking logic
   requires the concurrency test to still pass.

6. **Never auto-cancel someone else's booking.** Capacity reductions and
   closures surface a list for a human to act on. See SPEC §8.2.

7. **No cookies except the session cookie.** No analytics cookies, no ad
   pixels, no third-party embeds that set cookies. This is what keeps the app
   free of a consent banner. If a dependency sets a cookie, do not add it.

8. **The public "who's here" page never shows the past.** Today plus the next
   `FINESTRA_GIORNI` days only — the same constant as everywhere else, never a
   hardcoded number. See SPEC §6.6.

   It is also the **only** page that shows `nome_pubblico`. The availability
   grid of SPEC §6.2 shows counts — free seats out of total, and how many
   people made their presence public — never the names themselves. The two
   pages split the work: the grid answers *how many*, "Chi c'è" answers *who*.
   Each links to the other, above its own content, with the note SPEC §6.2 and
   §6.6 spell out. Do not "improve" the grid by adding names to it.

9. **No payments, no membership management, no messaging.** These are out of
   scope by design, not by omission.

10. **The booking window is a single source of truth.** One constant
    `FINESTRA_GIORNI` in `config/limits.ts` (currently `14`) drives booking
    validation, the availability view, and the public page. Never hardcode a
    day count anywhere else, and never let the three diverge. "Today" is always
    computed in the `Europe/Rome` timezone, never in UTC — a UTC server is still
    on the previous day until 02:00 Italian summer time, which would open or
    close the window on the wrong day. The window is re-evaluated at write time,
    not at page load.

11. **Site availability is data, not code.** Seasonal opening is expressed as
    rows in `periodi_attivita`, editable from the admin panel. Never encode a
    season, a month, or a specific site's schedule as a condition in code, a
    feature flag, or an environment variable. Making a site appear or disappear
    must take a non-technical admin under a minute and require no deploy.

12. **No hardcoded visual values, anywhere.** Every colour, font, size, radius
    and spacing comes from `config/tokens.ts` (mirrored into the Tailwind
    theme). No hex value, no `px` literal, no `text-gray-500` or any other
    stock Tailwind palette class in a component — the palette is the one in
    SPEC §13 and nothing else. This is what makes a future rebrand a one-file
    change instead of a rewrite, and it is the rule most likely to get quietly
    broken around the third screen.

13. **Never white text on `verde`.** `#FFFFFF` on `#3FB75A` is 2.6:1 and fails.
    Text on green fills is always `testo` (`#1C1C1C`). Likewise never use
    `verde` (`#3FB75A`) for text or links on `sfondo` — that pairing is 2.1:1.
    Links use `verde-testo` (`#1A6B31`). See SPEC §13.7.

14. **Colour never carries meaning alone.** Availability, "last places",
    sold out and closed always have a text label as well as a colour. Applies
    to the availability grid, the public page and every status badge.

15. **Statistics are aggregate-only, and enforced as such.** No statistics view
    or CSV export ever contains an email address, a `nome_pubblico`, or a
    `utente_id` — not as a column, not as a filter, not in a drill-down. No row
    may correspond to one person: views expose counts per category and nothing
    else. Never build an admin screen that lists users alongside their optional
    fields. Counts are never suppressed, rounded or thresholded — every optional
    value collected is included, small categories included. See SPEC §6.8.

16. **The optional fields are never public.** `eta`, `genere`, `professione`,
    `motivo_visita` and `residenza` must be unreachable from any unauthenticated
    query, from the public "chi c'è" page, and from the referente view. The only
    user datum that can ever become public is `nome_pubblico`. Enforce this in
    RLS, not in components. See SPEC §6.5.

    The same applies to the `stat_*` columns on `prenotazioni`: readable by the
    aggregate statistics engine only, never in a per-booking view, never in a
    non-aggregate export, never on a page.

17. **Optional means non-blocking.** The registration flow must complete with
    every optional field empty. Never mark one required, never gate the booking
    flow on them, never re-prompt with a recurring banner. The "Salta" control
    carries the same visual weight as the save control. Consent obtained as a
    condition of service is not freely given (art. 7.4 GDPR).

18. **Public-name moderation is after the fact, not before.** A new or changed
    `nome_pubblico` goes live immediately; the admin is notified and can clear
    it. Do not build an approval queue. Do build all three layers of SPEC §6.5:
    the editable blocklist checked at write time, the notification email, and
    the admin clear action — which must also email the affected user. Clearing
    a name never cancels bookings and never closes the account.

19. **The `stat_*` copy happens once, at anonymisation, and only then.**
    SPEC §5.3 is exact: when a `prenotazione` is anonymised, the user's five
    optional values are copied into its `stat_*` columns — but only if the
    `DATI_FACOLTATIVI` consent is active at that moment, and **never** when the
    anonymisation is triggered by an art. 17 erasure request, where the copy
    must be skipped entirely. Do not copy at booking time: before anonymisation
    the data must live in exactly one place. Do not re-copy or back-fill.

---

## Domain vocabulary

Use these Italian terms in database identifiers, types, and UI. Do not
translate them, do not mix languages within an identifier.

| Term                   | Meaning                                                                                                                                 |
| ---------------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| `sede`                 | One of the coworking locations                                                                                                          |
| `capienza`             | Bookable seats per sede per fascia                                                                                                      |
| `fascia`               | Time block. Enum: `MATTINA`, `POMERIGGIO`                                                                                               |
| `prenotazione`         | A booking                                                                                                                               |
| `giornata intera`      | UI shorthand only — creates two `prenotazione` sharing a `gruppo_id`. Never a third enum value.                                         |
| `nome_pubblico`        | Optional display label, max 40 chars                                                                                                    |
| `chiusura`             | Punctual exception *inside* an active period — a day or fascia when an in-season sede is not bookable                                   |
| `periodo_attivita`     | Seasonal availability range for a sede. Multiple allowed, may overlap (union wins), may recur yearly. Distinct from `chiusura`.         |
| `finestra_prenotabile` | Bookable window: today through today + `FINESTRA_GIORNI`, inclusive. Rolling — a new day opens at `ORA_APERTURA_FINESTRA`, Europe/Rome. |
| `referente`            | Site steward, sees own sede only, today + `FINESTRA_GIORNI` — never a hardcoded day count                                               |
| `incarico`             | Role assignment. `REFERENTE` always has a `sede_id`; `AMMINISTRATORE` never does — admins are global (SPEC §5.6).                       |
| `giorni_apertura`      | Weekdays a sede is open, default LUN–SAB, admin-editable per sede. Fifth bookability condition of SPEC §5.2.                            |
| `sedi.note`            | Practical info (Wi-Fi, keys). Authenticated users only — never in a public view, never contains passwords.                              |
| `posto_progressivo`    | Internal seat number 1..capienza. **Never shown to users.**                                                                             |
| `dati_facoltativi`     | The five consent-based statistical fields: `eta`, `genere`, `professione`, `motivo_visita`, `residenza`. Never public, never per-user in admin. |
| `stat_*`               | Snapshot of the five fields copied onto a `prenotazione` at anonymisation time (SPEC §5.3). No longer personal data — nothing links them back to a person. |
| `consenso`             | Append-only log. Two independent types: `NOME_PUBBLICO` and `DATI_FACOLTATIVI`. Either can be given or revoked without touching the other.      |
| `moderazione`          | After-the-fact clearing of an offensive `nome_pubblico` by an admin, plus the blocklist and notification around it. See SPEC §6.5.              |
| `impronta`             | Keyed hash of an email or network address, used only by the link request limit (`richieste_link`, SPEC §6.1). Never reversible, expires after one hour. No address of either kind is ever stored. |

Code comments and commit messages: English.
Anything a user reads: Italian, in `messages/it.json` — never hardcoded in JSX,
even for the MVP.

---

## Visual identity

The app must be visually continuous with `www.sassifraga.org` (Google Sites).
Full definition in **SPEC §13** — read it before building any screen.

Single source of truth: `config/tokens.ts`, mirrored into the Tailwind theme
by `tailwind.config.ts`, which `app/globals.css` loads through `@config`
(Tailwind v4). Every theme namespace set there **replaces** the Tailwind
default: the stock palette, sizes, weights, radii, breakpoints and shadows do
not exist — only the token classes do (`bg-sfondo`, `text-verde-testo`,
`text-corpo`, `font-grassetto`, `rounded-controllo`, `min-h-tocco`,
`max-w-contenuto`, `grande:`…). Font sizes are named `corpo`, `nota`,
`titolo-*`, so `text-testo` is always the colour. Config values are inlined
by Tailwind, not exposed as CSS variables: the base rules in `globals.css`
use `@apply` on token classes, never `var()` and never a literal.
`tests/tokens.test.ts` compiles the theme and fails on any stock class or
literal in `app/` or `components/` — comments included, so do not write
"4px" even in a comment there.

Shared controls (`bottonePrimario`, `bottoneSecondario`, `bottoneDistruttivo`,
`campo`) live in `components/controlli.ts`; header and footer in
`components/`. The font is declared once in `app/font.ts` (`next/font/local`,
files in `app/fonts/`) and reaches the theme as `--font-inclusive`. The header
logo is `public/logo.png` until the SVG of SPEC §13.10 arrives.

```
sfondo             #EBE8DD   page background
testo              #1C1C1C   headings and body
verde              #3FB75A   fills, logo, Stile 2 bands — NEVER text on sfondo
verde-testo        #1A6B31   links and green text on light backgrounds
testo-secondario   #5A564C   labels, helper text
linea              #D6D2C4   1px rules and input borders
superficie         #F3F1E9   grid cells
superficie-scura   #E0DCCD   unbookable cells, closed days
avviso             #8A5410   "last places", non-blocking warnings
errore             #A32020   validation errors, destructive actions
```

**Two registers.** *Stile 1* (cream) is the default for every operational
screen. *Stile 2* (solid `verde` background, `testo` text) is for occasional
full-width blocks only: primary action button, the public "chi c'è" band,
empty states, booking confirmation. Never for the availability grid, tables,
lists or forms.

**Type.** Inclusive Sans for everything, **self-hosted** — never loaded from
Google's CDN, which would send every visitor's IP to Google and undo the
no-third-parties position that keeps this app free of a cookie banner. Use only
the weights present in the font files (regular, bold, plus italics); no design
may depend on intermediate weights. The font's slashed zero is intentional —
do not disable it.

**Form.** Flat. No shadows, no cards, no heavy borders. Separation comes from
whitespace and 1px `linea` rules. Radius 4px on buttons and inputs, 0 on rules.
Spacing on a 4px scale, generous vertical rhythm. Touch targets ≥ 44×44px.

**Header and footer** carry the continuity: logo plus "Comunità Sassifraga" on
the left, logo links to `www.sassifraga.org`; footer repeats the site's
institutional details and links to the privacy notice.

**Voice.** Direct, plain, unhurried — the site's register. Informal "tu". No
exclamation marks, no emoji, no jargon leaking to users ("sessione scaduta",
"token", "autenticazione" are all forbidden in user-facing text). Errors say
what to do next, not what went wrong internally.

---

## Conventions

- Server Components by default. `"use client"` only where interaction requires it.
- `app/layout.tsx` mounts header, `<main>` (one text column) and footer. Pages
  return their content only, never their own `<main>`.
- All database access through typed helpers in `lib/db/`. No raw Supabase calls
  scattered in components.
- Every schema change is a migration file in `supabase/migrations/`. Never edit
  the database by hand.
- Dates: store as `date` + `fascia` enum. Do not store booking slots as
  timestamps — DST changes would shift them. See SPEC §8.4. All "today" and
  window computations go through a single helper in `lib/dates.ts` that pins the
  timezone to `Europe/Rome`; never call `new Date()` directly for window logic.
- Bookability of a sede on a date and fascia is decided by one shared
  function, `public.sede_prenotabile(sede_id, data, fascia)` in the database
  (`supabase/migrations/*_disponibilita.sql`), applied identically in the
  availability view, the public page, and the booking write path. It lives in
  SQL because it must also hold where application code cannot be trusted to
  have run. Do not reimplement the five conditions of SPEC §5.2 (including
  `giorni_apertura`) in more than one place, and never in TypeScript.
  The four conditions that describe the sede itself — everything but the
  booking window — are `public.sede_aperta(sede_id, data, fascia)`, and
  `sede_prenotabile` is defined as "in the window **and** `sede_aperta`".
  Use `sede_aperta` for a day already gone, where the window is always false
  and the question is whether the sede was open: that is what the nightly
  `posti_offerti` record of SPEC §5.10 asks. Never a third copy of the rules.
- Configurable values from SPEC §10 live in `config/limits.ts`, not inline.
- Errors shown to users are in plain Italian, no technical jargon, and always
  say what to do next.
- **Supabase runs server-side only.** Pages, Server Actions and Route Handlers
  get their client from `clientServer()` in `lib/db/server.ts`, bound to the
  session cookie; `proxy.ts` refreshes that cookie on every request. There is
  no browser Supabase client and no `NEXT_PUBLIC_` variable: keys never reach
  the browser. Server-side env vars are read once in `lib/env.ts`.
- **Sign-in logic lives in `lib/auth/`** as pure functions over a client
  (`richiediLink`, `verificaLink`, `esci`), shared by the pages and the tests.
  The hourly link limit is enforced by `consenti_richiesta_link()` in the
  database on `impronta` values, never in application memory.
- **The link token travels in the URL of `/auth/conferma`.** Never print that
  URL. `next.config.ts` excludes it from the dev request log; keep it out of
  any other log, error message or analytics event (rule 4).
- **Outbound email leaves through `lib/posta/` and nowhere else.** Plain text,
  always from `EMAIL_MITTENTE` on the dedicated subdomain (§14.2), never
  logging or throwing an address (rule 4). Booking sends **no confirmation**:
  what a person receives is the reminder of the evening before (SPEC §6.3,
  decision of 2026-09-10). Do not add a confirmation email back.
- **Automatic jobs are Route Handlers under `app/api/mestieri/`**, protected by
  the shared secret `CRON_SECRET` and scheduled in `vercel.json` — one daily
  run, in universal time, which is why `ORA_PROMEMORIA` is an intent and not a
  clock (§10). The RLS-bypassing client is built in `lib/db/servizio.ts` alone;
  never reach for it from a page or from an action serving a person's request.
- The first sign-in is reported by `registra_accesso()` (`primoAccesso` in
  `verificaLink`). Step 6 uses it to show the one-time optional-fields screen
  of SPEC §6.1 point 5; until then the route sends everyone to `/`.

---

## Commands

```bash
npm run dev          # local dev server
npm run typecheck    # tsc --noEmit — must pass before any commit
npm run lint
npm run test         # unit + integration
npm run test:rls     # RLS policy tests — must pass before any commit
npm run test:e2e     # Playwright
npx supabase db reset # rebuild local db from migrations + seed
npm run db:types     # regenerate lib/db/types.ts after a migration
```

After editing `supabase/config.toml` (auth settings, email templates) run
`npx supabase stop` then `npx supabase start`: `db reset` does not reload
the Auth service. Local emails land in Mailpit at http://127.0.0.1:54324.

---

## Required tests

These exist and must never be deleted or weakened to make a build pass:

- `tests/concurrency.test.ts` — N simultaneous bookings on a sede with capacity
  M must produce exactly min(N, M) successes.
- `tests/rls.test.ts` — an authenticated user must not be able to read another
  user's `prenotazioni` rows, or the `email` of any other user.
- `tests/public-name.test.ts` — a user with `mostra_nome_pubblico = false` must
  not appear in any query reachable without authentication.
- `tests/retention.test.ts` — the nightly job anonymises bookings older than 30
  days and leaves newer ones intact; on anonymisation it copies the five
  optional values into `stat_*` when consent is active, copies nothing when it
  is absent or revoked, and copies nothing when the trigger is an art. 17
  erasure; `stat_*` is empty on every booking not yet anonymised.
- `tests/posti-offerti.test.ts` — the nightly record of SPEC §5.10 writes one
  row per giorno, sede and fascia; a day the sede was shut is `0` and not a
  missing row; a day already written never changes, whatever the capienza or
  the calendar does afterwards; a day outside the booking window is still
  recorded for what it offered (`sede_aperta`, not `sede_prenotabile`); two
  overlapping runs write once and a skipped night is caught up; the table and
  `registra_posti_offerti()` are unreachable by anon and authenticated.
- `tests/booking-window.test.ts` — with `FINESTRA_GIORNI = 14` and the clock
  frozen at 2026-08-15 (Europe/Rome), a booking for 2026-08-29 succeeds and one
  for 2026-08-30 is rejected. The same assertions must hold with the system
  clock set to UTC, and at 23:59 and 00:01 local time.
- `tests/prenotazione.test.ts` — a slot the availability grid calls closed
  cannot be booked by calling the write path directly (out of season, closed
  weekday, chiusura on one fascia only); a "giornata intera" creates two rows
  sharing a `gruppo_id` and creates nothing at all when one of the two fasce
  is full; cancelling a whole day cancels both fasce and cancelling one leaves
  the other; nobody can cancel someone else's booking; a booking whose fascia
  has already begun can no longer be cancelled (§6.4); `mie_prenotazioni`
  never carries `posto_progressivo`, never another person's row, never the
  past, and is unreachable without signing in.
- `tests/promemoria.test.ts` — the reminder of the evening before (SPEC §6.3)
  goes out once per person per day, carries both fasce of a giornata intera and
  the link to "Le mie prenotazioni"; nothing goes out for a cancelled booking,
  nothing goes out twice even from two overlapping runs, and nothing goes out
  to somebody who booked after that day's run. `promemoria_da_inviare()` is
  unreachable by anon and authenticated, and `promemoria_inviato_il` is
  readable by neither.
- `tests/statistiche.test.ts` — no statistics view or CSV export returns an
  `email`, a `nome_pubblico` or a `utente_id`; no returned row maps to a single
  user; a category containing one person is still reported with its real count.
- `tests/dati-facoltativi.test.ts` — the five optional fields are unreachable
  from any anonymous query, from the public page and from the referente view;
  registration completes with all of them empty; revocation clears all five and
  writes a `DATI_FACOLTATIVI` revocation row.
- `tests/moderazione.test.ts` — a blocklisted name is refused at write time;
  a saved or changed name sends exactly one email to `EMAIL_MODERAZIONE`
  containing `nome_pubblico` and `utente_id` and **no email address**; the
  `MAX_CAMBI_NOME_GIORNO + 1`-th change in a day is refused and sends nothing;
  an admin clear empties the name, sets `mostra_nome_pubblico` to false, emails
  the user, and leaves that user's `prenotazioni` untouched.
- `tests/diritti.test.ts` — "Scarica i miei dati" carries the profile, the
  bookings still linked to the person and their own `consensi` rows, and never
  another person's row, never `posto_progressivo`, never a `stat_` column;
  erasure (art. 17) frees the bookings whose fascia has not begun, anonymises
  every booking of that person with `stat_*` left **empty**, writes the
  revocation rows, removes profile, sign-in identity, incarichi, moderazioni
  and `cambi_nome`, keeps the `consensi` rows, and can only ever touch the
  caller's own account.
- `tests/tokens.test.ts` — a lint-style check that no component file contains a
  hex colour, a raw `px` value, or a stock Tailwind palette class; and that
  every foreground/background pair declared in `tokens.ts` reaches 4.5:1.
- `tests/periodi-attivita.test.ts` — a sede outside all its `periodi_attivita`
  is not bookable and does not appear in the availability grid; a sede with
  `sempre_disponibile = true` ignores periods entirely; overlapping periods
  behave as a union; shortening a period does not delete existing bookings.
- `tests/disponibilita.test.ts` — the availability view covers exactly today
  through today + `FINESTRA_GIORNI` and never the past; a switched-off sede
  does not appear; `giorni_apertura` and `chiusure` decide bookability per
  day and per fascia, a chiusura on one fascia leaving the other open; the
  view carries counts only — no email, no `nome_pubblico`, no `utente_id`.
- `tests/accesso.test.ts` — the real sign-in flow through the local mailbox:
  the `utenti` row does not exist before the link is opened and holds only
  the email afterwards; the same link opens nothing a second time; the first
  sign-in is reported as such and later ones are not; the
  `MAX_LINK_PER_EMAIL_ORA + 1`-th request for an email and the
  `MAX_LINK_PER_RETE_ORA + 1`-th from a network send nothing; `richieste_link`
  is unreadable by anon and authenticated; `otp_expiry` in `config.toml` and
  the templates agree with `VALIDITA_LINK_MINUTI`.

If a change breaks one of these, the change is wrong. Do not adjust the test.

---

## How to work on this repo

- **Plan first.** Propose the plan and wait for approval before writing code.
  The maintainer is non-technical: explain the plan in plain language, and
  state explicitly what will change and what could break.
- **One feature per session**, one commit per feature, small diffs.
- **Ask instead of assuming**, especially about: personal data fields, who can
  see what, and anything touching the consent flow. A wrong guess in those
  areas is expensive to undo.
- After any change touching schema, auth, or visibility, run `npm run test:rls`
  and report the result explicitly.
- When something in SPEC.md turns out to be ambiguous or wrong, say so and
  propose a specific wording change. Do not resolve the ambiguity silently.

---
