# CLAUDE.md

Booking platform for Valle Soana (Piedmont, Italy), hosting **two services**:

- **Wild Working** — coworking desk booking. SPEC §1–§14.
- **«Prenota un abitante»** — activities offered by valley residents to VIHTA
  temporary residents, access-restricted and time-boxed. SPEC §15.

They share one codebase, one database, one login and one visual identity.
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
- Resend for transactional email, sending from `noreply@wildworking.sassifraga.org`
- Deployed on Vercel, served at **`wildworking.sassifraga.org`**
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

   *Scope note, so this is not misread:* the closed list is about **the data
   of platform users** — people who sign in. The **abitanti** who offer an
   activity are not users and never will be (SPEC §15.8): their name, surname,
   phone and exact address live on `attivita`, are entered by an admin against
   a consent signed on paper or received by email, and are fixed by the table
   of SPEC §15.3.2. That table is closed too — nothing gets added there on
   your own initiative either. What the rule forbids is giving a *user* a
   name field, and that stays forbidden even when a screen would read better
   with one: SPEC §15.9 is explicit that an activity's host gets public names
   plus a count, and that the association matches emails to real names in its
   own VIHTA register, outside this software.

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

   The one place an address does travel in a message is the **iscrizione
   notice** of SPEC §15.10, added on 2026-09-15: it goes to the association's
   own mailbox (`EMAIL_ASSISTENZA_ABITANTI`) and carries the email of whoever
   just took a place. That is the same datum §15.9 already shows the same
   person in the panel, for the same purpose — writing to whoever is coming.
   It is specified, and it is the only one: no other mailbox receives it, and
   no log, error or analytics event ever does.

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

   `nome_pubblico` appears on **exactly two pages**, and nowhere else:
   "Chi c'è in Valle" (§6.6), public; and the detail of an activity (§15.6),
   reachable only with an active `abilitazione`. Both show it only for users
   who switched it on, through the same consent of §5.5.

   The availability grid of SPEC §6.2 shows counts — free seats out of total,
   and how many people made their presence public — never the names
   themselves. The grid answers *how many*, "Chi c'è" answers *who*. Each
   links to the other, above its own content, with the note SPEC §6.2 and
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

    *Minors, so this is not guessed at later:* **the service is open to people
    under 18** (SPEC D24, §7). Never add an age gate, an age declaration
    checkbox, or a date of birth — verifying an age means collecting one more
    personal field from everybody, which rule 1 forbids and which is the
    opposite of minimisation. The 14-year threshold that art. 8 GDPR sets on
    the two optional **consents** (art. 2-quinquies of the Italian Codice
    Privacy lowered it from 16) lives **in the privacy notice, not in the
    code**: registration and booking rest on art. 6.1.b and have no age
    threshold at all. `eta` therefore has six values, the first being
    `Meno di 18`. «Prenota un abitante» is outside this: its participants are
    adults (SPEC §15.4).

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

20. **The activities module is additive. Never alter an existing table for it.**
    SPEC §15 adds five tables — `edizioni`, `attivita`, `iscrizioni`,
    `abilitazioni`, `codici_invito` — plus the service table `tentativi_codice`,
    and changes none of the nine that already exist. Access rights live in
    `abilitazioni`, not as a column on `utenti`; consent reuses the two existing
    `consenso` types; admins are already global. If a task seems to require a
    column on an existing table, stop and ask: it almost certainly does not,
    and the migration would run against live data.

    Additive does not mean nothing else moves. **Seven things already in
    service are touched**, each with its own tests to extend — never to weaken
    (SPEC §15.1): the availability page (§6.2), `/le-mie-prenotazioni` (§15.6),
    the panel's "Prenotazioni da controllare" list (§15.12), the nightly
    reminder run (§15.10), the nightly cleanup run (§15.11), account erasure
    (§15.12), and the privacy notice. Anyone who reads "additive" and plans one
    session for the module is out by a factor of five.

21. **Activities never use `FINESTRA_GIORNI`.** An edition runs 29 days and a
    resident must see the whole programme on arrival. The activity list is
    bounded by the active `edizione`, not by the rolling window. Never apply
    the window to `attivita` or `iscrizioni`, and never widen the window for
    the coworking side to accommodate them.

22. **Access to the module is enforced in the database.** Every read of
    `attivita` and `iscrizioni` requires an active `abilitazione` for the active
    `edizione`, imposed by RLS. A user without one must not be able to retrieve
    a title, an `abitante_nome`, or a `luogo_generico` — not through a direct
    link, not through an id guessed by hand, not through the offline cache.

23. **Invite codes exist only as hashes, and carry a number.** Store `impronta`
    with the same keyed hash already used for `richieste_link`
    (`CHIAVE_IMPRONTE_ACCESSO`). Never store, log, email or return a code in
    clear text after the generation screen. The rejection message is identical
    for a code that is unknown, already used, or revoked.

    Each row also carries `progressivo`, unique within the edition and printed
    small on the card. It is the only handle the panel has: without it, "I lost
    my code" faces forty-five indistinguishable rows. **Numbers are never
    reused**, not even after a revocation — the pairing between number and
    person lives on the paper list of whoever hands out the keys, and a reissued
    number would make that list lie. No name and no email ever go on the card or
    into `codici_invito`.

    The hourly attempt limit of §15.4 uses `tentativi_codice`, keyed by
    `utente_id` — **not** a fingerprint. Fingerprints exist in §6.1 because
    there the person has no identity yet and only an email address is known.
    Here the caller has already signed in and their id is already in the
    database; hashing it would protect nothing and make the count unreadable.

24. **The abitante's data has three visibility levels, enforced by three views.**
    SPEC §15.8 is exact. Level 1, every abilitated user: `abitante_nome` (first
    name only), `titolo`, `luogo_generico`, `descrizione`. Level 2, **only users
    holding an `ATTIVA` `iscrizione` on that activity**: `abitante_cognome`,
    `abitante_telefono`, `luogo_esatto`. Level 3, admin only and in no export:
    `abitante_note_interne`.

    **Do not try to express level 2 as a column grant.** The requirement is
    "these columns, only for the rows you are enrolled in" — row-dependent
    column visibility, which Postgres cannot state in one rule: `GRANT` is per
    role, RLS is per row, and neither combines with the other. The table
    `attivita` is therefore revoked from everyone, and three views stand over
    it: `attivita_elenco` (level 1, abilitated users, published rows of the
    active edition), `attivita_iscritto` (levels 1+2, only rows where the caller
    holds an `ATTIVA` iscrizione), `attivita_amministrazione` (everything,
    admin only). Writes go through functions. A `SELECT *` by an abilitated
    non-enrolled user must not return a level 2 column — and cancelling an
    iscrizione takes level 2 away in the same instant.

25. **An activity cannot be published without the consent checkbox.**
    `consenso_raccolto` is an admin attestation that a signed consent is held by
    the Direttivo — the abitante has no account and signs nothing digitally.
    Enforce the constraint in the database, not only in the form.
    `consenso_raccolto_il` and `consenso_raccolto_da` are written by the system,
    never by the user. Clearing the checkbox returns the activity to `BOZZA`.
    Never invent a digital consent flow for abitanti: they are not users and
    will not become ones.

    `consenso_modalita` is a **closed list of two**, mandatory whenever the box
    is ticked: `MODULO_CARTACEO_FIRMATO` or `EMAIL_DI_CONSENSO`. Never widen it
    — a verbal agreement minuted in a meeting proves the association said
    something, not that the abitante consented, and SPEC §15.8 rests entirely on
    the paper being real. An abitante who can give neither a signature nor an
    email simply does not get published: that activity is organised outside the
    app.

26. **`descrizione` is a third party's own words.** It is written by the
    abitante and transcribed by the admin, up to 4000 characters, and published
    to every abilitated user. No automatic filter can vet it — it may contain a
    phone number, a home address, a relative's name. Do not add one; do surface
    the re-read reminder on the publish screen (SPEC §15.9). Never rewrite,
    summarise or truncate it on display.

27. **One entry point, no navigation item.** The module is reached from the
    **top** of the availability page: a **Stile 2** button labelled "Prenota un
    abitante", **below the "Chi c'è in Valle" button and its note**, shown
    only to signed-in users and only while an `edizione` is
    active (SPEC §15.5, §6.2). Do not add a header nav item, do not add a link
    on the "Chi c'è in Valle" page, and do not promote the module anywhere
    else.

    The two buttons carry the **same weight**, both filled `verde` with `testo`
    text — never white on green (rule 13). A first draft made this one Stile 1,
    outlined, so as not to compete; reversed on 2026-09-13. The hierarchy is
    the reading order, not a paler outline: "Chi c'è in Valle" comes first,
    with its note **above** it, and "Prenota un abitante" comes below them
    both, with its own line above it in the same way and at the same distance
    (§6.2, 2026-09-15). That distance is `notaControllo` in
    `components/controlli.ts` and is written nowhere else — "the same" has to
    stay true without anybody checking.
    Still no full-width Stile 2 **band** above the grid (§13.2).

    **One line stands above the button** — *"Sei un partecipante a VIHTA?
    Premi qui sotto per entrare in «Prenota un abitante»."* — the same for
    everyone whether or not they hold an `abilitazione`, and it appears and
    disappears with the button: no active `edizione`, no line, so the line is
    never left standing above a button that is no longer there. A line like it
    was removed on 2026-09-12 and reinstated on 2026-09-15, and the button
    itself sat beside "Chi c'è in Valle" from 2026-09-13 until it moved below
    it on 2026-09-15. The line only says who the button is for; the explaining
    is still done on `/abitanti`, behind the button, where it costs nothing to
    the people who came to book a desk.

    `/abitanti` is **one address that shows two things**: the code form to
    someone without an abilitazione, the activity list to someone with one.
    There is no `/abitanti/accesso` — it was in an earlier draft and was merged
    away on 2026-09-12, because the button cannot know in advance who will
    press it.

28. **Nothing travels in the sign-in link, and the module must not need it.**
    The card's QR points at `/abitanti`; a signed-out visitor who scans it signs
    in normally and lands on the availability page, where the button of rule 27
    is at the top where they cannot miss it. That is the whole mechanism, and it
    is why `richiediLink`, the two email templates and `/auth/conferma` are not
    touched by this module. Carrying a destination through the link was
    considered and rejected on 2026-09-12 (SPEC §15.4): do not reintroduce it,
    and never add a `next` parameter to the authentication path to make some
    later screen more convenient.

29. **The module has no waiting list, and adding one is not a small change.**
    `iscrizioni.stato` has two values, `ATTIVA` and `ANNULLATA` (D22, SPEC
    §15.7). A full activity says "Completa" and offers nothing else. When a
    place frees up the swap is closed by a human: the admin cancels one
    iscrizione and creates another from the panel (SPEC §15.9). Those two admin
    actions are **the only place in this codebase where somebody may act on
    another person's row**, they exist only for `iscrizioni` and never for
    `prenotazioni`, they are recorded in `creata_da` / `annullata_da`, and both
    send the affected person an email. Rule 6 is intact: it forbids *automatic*
    cancellation, not a decision a person takes and signs.

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
| `dati_facoltativi`     | The five consent-based statistical fields: `eta`, `genere`, `professione`, `motivo_visita`, `residenza`. Never public, never per-user in admin. `eta` is a bracket, never a date of birth, and its first value is `Meno di 18` (rule 17). |
| `stat_*`               | Snapshot of the five fields copied onto a `prenotazione` at anonymisation time (SPEC §5.3). No longer personal data — nothing links them back to a person. |
| `consenso`             | Append-only log. Two independent types: `NOME_PUBBLICO` and `DATI_FACOLTATIVI`. Either can be given or revoked without touching the other.      |
| `moderazione`          | After-the-fact clearing of an offensive `nome_pubblico` by an admin, plus the blocklist and notification around it. See SPEC §6.5.              |
| `edizione`             | The period during which the activities module is visible. At most one active at a time. Time switch for the module, same idea as `periodo_attivita` (SPEC §15.3.1). |
| `attivita`             | A one-off event proposed by a valley resident: own date, time, place, capacity. Not a `prenotazione` — never repeats, never fits the grid.      |
| `abitante`             | The person offering an activity. **Not a platform user**: no account, no digital consent, data entered by the admin against a hand-signed paper form (SPEC §15.8). Their fields sit at three visibility levels — see rule 24. |
| `iscrizione`           | A VIHTA participant's place on an `attivita`. Two states only: `ATTIVA`, `ANNULLATA` — there is no waiting list (rule 29). Same `posto_progressivo` and `stat_*` pattern as `prenotazione`. |
| `abilitazione`         | A user's permission to use the module for one `edizione`. The real authorisation — the code only creates it (SPEC §15.3.4).                    |
| `codice_invito`        | One-time card handed to a VIHTA participant on arrival, carrying a `progressivo` unique within the edition. Consumed on first use. Only its `impronta` is stored, never the code (SPEC §15.3.5). |
| `VIHTA`                | The temporary residency in Valle Soana. Its participants are the only people who reach «Prenota un abitante»; outside the module they are ordinary users. Never a role, never a column: what grants access is the `abilitazione`. |
| `impronta`             | Keyed hash, never reversible, of a value the app must recognise without storing. Two independent uses, with two different lifetimes: the link request limit of SPEC §6.1 (`richieste_link`, hashes of an email or a network address, **expiring after one hour**) and the invite codes of SPEC §15.3.5 (`codici_invito`, **living as long as the edition plus `GIORNI_CHIUSURA_EDIZIONE`**). Neither an address nor a code is ever stored in clear. The hourly limit on code attempts is *not* an impronta: see rule 23. |

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
`campo`, `notaControllo`) live in `components/controlli.ts`; header and footer
in `components/`. The **back link at the foot of a page is a
`bottoneSecondario`**, never a plain link (SPEC §13.6, 2026-09-15) — with the
two exceptions written there: inside a Stile 2 band, and the offline courtesy
page, where it stays the primary button it is. A link that goes *forward*, or
one inside a sentence, stays a link. The font is declared once in `app/font.ts` (`next/font/local`,
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
- **The offline copy keeps the availability page and nothing else.**
  `public/sw.js` is the only place that decides what a browser may keep, and
  it may keep `/`, the courtesy page `/senza-collegamento`, and the files
  those are drawn with. Never "Chi c'è in Valle" — §6.5 promises a public
  name switched off disappears from every booking at once, and a copy on
  somebody else's phone would outlive that promise — and never a page of a
  person's own. Pages are asked of the network first, so online what is on
  screen is always the server's. `app/manifest.ts` carries the installation,
  with its names from `messages/it.json` and its colours from `tokens.ts`;
  the icons are provisional and rebuilt by `strumenti/genera-icone.mjs`.
  `tests/installabilita.test.ts` runs `sw.js` and enforces all of it.
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
npm run db:reset     # rebuild local db from migrations + seed
npm run db:types     # regenerate lib/db/types.ts after a migration
```

There is **no end-to-end suite and no Playwright** in this repo, and an earlier
version of this file listed a `test:e2e` that never existed. `npm run test`
already drives the real database and the real local mailbox — `accesso` opens
a sign-in link out of Mailpit, `promemoria` reads the messages that went out —
so what an e2e suite would add is the browser, and nothing has needed it yet.
Do not write a command into this list before the script is in `package.json`.

After editing `supabase/config.toml` (auth settings, email templates) run
`npx supabase stop` then `npx supabase start`: `db reset` does not reload
the Auth service. Local emails land in Mailpit at http://127.0.0.1:54324.

---

## Required tests

These exist and must never be deleted or weakened to make a build pass —
except the one marked as still to come:

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
- `tests/statistiche.test.ts` — **not written yet: it arrives with step 12,
  postponed to after the prototype release (SPEC §12).** When it does: no
  statistics view or CSV export returns an `email`, a `nome_pubblico` or a
  `utente_id`; no returned row maps to a single user; a category containing
  one person is still reported with its real count.
- `tests/chi-ce.test.ts` — the public page of §6.6: the line of people reads
  exactly as the spec words it, only the days and fasce with somebody in them
  are listed, a giornata intera appears in both, a sede with nobody keeps its
  line; and, through the anonymous client, a name comes out only with the
  switch on and only inside the window, never with an id, an email or an
  optional field beside it.
- `tests/amministrazione.test.ts` — nobody but an amministratore reaches any
  table, view or action of the panel (§6.7); the moderation screen carries no
  email address; a clear empties the name, notifies and leaves the bookings
  alone; and a capienza lowered, a chiusura added, a sede suspended or a
  weekday removed produce a list to act on and never a cancellation (rule 6).
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
- `tests/installabilita.test.ts` — the manifest carries the names of
  `messages/it.json` and the colours of `tokens.ts`; every declared icon
  exists and is square at the size it declares; and — the point of the file —
  `public/sw.js` is actually run and asked, address by address, what it would
  keep offline: the availability page and the files it is drawn with, never
  `chi-ce-in-valle`, never a person's own pages, never another origin, and
  nothing at all for a request that writes.
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

### Activities module (SPEC §15)

- `tests/abilitazioni.test.ts` — a user without an active `abilitazione` for the
  active `edizione` cannot read any row of `attivita` or `iscrizioni`, by any
  route: list, direct id, joined query, or cached response. A revoked
  `abilitazione` blocks new and changed `iscrizioni` but leaves existing ones
  readable by their owner.
- `tests/codici.test.ts` — a code is accepted once and creates exactly one
  `abilitazione`; the second attempt is refused; the rejection message is
  byte-identical for unknown, used and revoked codes; no clear-text code is
  ever persisted or returned after generation; the
  `MAX_TENTATIVI_CODICE_ORA + 1`-th attempt in an hour is refused and the
  attempts are counted in `tentativi_codice`, which is unreadable by anon and
  authenticated; `progressivo` is unique within an edition and is never reused
  after a revocation; a code from a closed edition does not work.
- `tests/iscrizioni.test.ts` — N simultaneous sign-ups on an activity with
  capacity M produce exactly min(N, M) `ATTIVA` rows and **nothing else** —
  there is no waiting list, so the rest simply fail — enforced by the unique
  constraint and not by application code; a user cannot hold two non-cancelled
  `iscrizioni` on the same activity; nobody can cancel another person's
  iscrizione except an amministratore, and an iscrizione whose activity has
  already begun can no longer be cancelled.
- `tests/iscrizioni-amministratore.test.ts` — an amministratore can cancel
  another person's `iscrizione` and create one on their behalf; both write
  `annullata_da` / `creata_da` and send exactly one email to the person
  concerned; neither action can touch a `prenotazione`, whatever it is asked
  to do; an admin sign-up on a full activity is refused by the same capacity
  constraint as everyone else; no non-admin can call either.
- `tests/attivita-consenso.test.ts` — an `attivita` with `consenso_raccolto`
  false cannot be set to `PUBBLICATA`, rejected at database level; a
  `consenso_raccolto` true without a `consenso_modalita` from the closed list
  of two is rejected too; clearing the flag on a published activity returns it
  to `BOZZA`; `consenso_raccolto_il` and `consenso_raccolto_da` are written by
  the system and cannot be set from a request.
- `tests/livelli-abitante.test.ts` — an abilitated user who is **not** enrolled
  cannot retrieve `abitante_cognome`, `abitante_telefono` or `luogo_esatto` by
  any route, including `SELECT *` on every view and on the table itself;
  enrolling grants them and cancelling removes them again in the same instant;
  `abitante_note_interne` is unreachable for every non-admin and absent from
  every export; `descrizione` is returned whole, never truncated.
- `tests/edizione.test.ts` — activating an edition deactivates any other;
  outside an active edition the module is unreachable and the availability-page
  entry of §15.5 is absent; that entry is also absent for a visitor who has not
  signed in; an activity dated outside its edition is refused.

**Existing tests the module extends** — extends, never relaxes. Step 20 of
SPEC §15.14 is the one that touches them, and every assertion already in them
must still hold afterwards:

- `tests/diritti.test.ts` — erasure now also cancels the person's future
  `iscrizioni` and frees their seats, anonymises the past ones with `stat_*`
  left empty, and removes their `abilitazione` and `tentativi_codice`. Of the
  `codice_invito` it removes the **link to the person and not the row**: the
  `progressivo` stays burnt, because rule 23 forbids reissuing it (§15.12).
  The export still carries no `posto_progressivo` and no `stat_` column, for
  iscrizioni as for prenotazioni — and no level 2 column of §15.8 either: the
  abitante's surname, telephone and exact address are somebody else's data,
  they reached the person by email at sign-up, and a file kept for years is
  not where they go.
- `tests/retention.test.ts` — the nightly run now also anonymises iscrizioni
  30 days past the **activity's** date, deletes abilitazioni and code
  fingerprints of an edition closed for `GIORNI_CHIUSURA_EDIZIONE`, clears the
  abitante's data of a closed edition **including `titolo`, `descrizione`,
  `cosa_portare` and `lingua_attivita`**,
  and drops code attempts older than an hour.
- `tests/installabilita.test.ts` — `sw.js` must refuse to keep **any** page of
  the module offline: not the list, not a detail, not the code form. Same
  reason as `chi-ce-in-valle`, and one more: a cached activity page would
  outlive the `abilitazione` that entitled someone to read it.
- `tests/promemoria.test.ts` — one nightly run, now two lists. Everything the
  file already asserts about bookings must still pass unchanged.
- `tests/disponibilita.test.ts` — the entry of §15.5 appears only for a
  signed-in user with an active edition, and the view still carries counts
  only.
- `tests/amministrazione.test.ts` — the new panel section is unreachable by
  anyone who is not an amministratore, like every other part of it. "Prenotazioni
  da controllare" now also lists the **iscrizioni** a change left behind, for
  the two reasons §15.12 names — a capienza lowered under the number signed up,
  and an activity returned to `BOZZA` when the consent tick was cleared — and,
  like the bookings beside them, it never cancels one (rule 6).

If a change breaks one of these, the change is wrong. Do not adjust the test.

---

## How to work on this repo

- **Plan first.** Propose the plan and wait for approval before writing code.
  The maintainer is non-technical: explain the plan in plain language, and
  state explicitly what will change and what could break.
- **One feature per session**, one commit per feature, small diffs. For the
  activities module this is not a figure of speech: SPEC §15.14 divides it into
  seven steps, 14 to 20, one per session, in that order. Do not start a step
  before the previous one's tests pass, and do not merge two of them because
  they look small.
- **Ask instead of assuming**, especially about: personal data fields, who can
  see what, and anything touching the consent flow. A wrong guess in those
  areas is expensive to undo.
- After any change touching schema, auth, or visibility, run `npm run test:rls`
  and report the result explicitly.
- When something in SPEC.md turns out to be ambiguous or wrong, say so and
  propose a specific wording change. Do not resolve the ambiguity silently.

---
