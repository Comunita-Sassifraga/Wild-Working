/**
 * Configurable parameters — SPEC §10.
 *
 * Single source of truth for every limit the app enforces. Nothing in
 * `app/`, `lib/` or `tests/` may hardcode one of these values.
 *
 * FINESTRA_GIORNI has a mirror in the database (`public.finestra_giorni()`,
 * see supabase/migrations/*_base.sql) because the referente access policy
 * runs inside Postgres. tests/rls.test.ts asserts the two copies match.
 * Change both together.
 */

/** Days bookable beyond today, inclusive (D8). Today + 14 → 15 bookable days. */
export const FINESTRA_GIORNI = 14;

/** Local time (Europe/Rome) at which the new day enters the window. */
export const ORA_APERTURA_FINESTRA = "00:00";

/** Maximum active bookings per user. `null` = no limit (D7). */
export const MAX_PRENOTAZIONI_ATTIVE: number | null = null;

/** Maximum bookings per user per week. `null` = no limit (D7). */
export const MAX_PRENOTAZIONI_SETTIMANA: number | null = null;

/** Validity of the sign-in link, in minutes (§6.1). */
export const VALIDITA_LINK_MINUTI = 15;

/** Session duration, in days, counted from the last use (§6.1). */
export const DURATA_SESSIONE_GIORNI = 30;

/** Link requests allowed per email address per hour (§6.1). */
export const MAX_LINK_PER_EMAIL_ORA = 5;

/** Link requests allowed per network address per hour (§6.1). */
export const MAX_LINK_PER_RETE_ORA = 20;

/** Days after which a booking is anonymised (§5.3, §7). */
export const GIORNI_ANONIMIZZAZIONE = 30;

/** Months of inactivity before a dormant account is deleted (§7). */
export const MESI_ACCOUNT_DORMIENTE = 24;

/**
 * Months of inactivity after which the dormant account is warned (§7:
 * "Avviso via email a 23 mesi; cancellazione a 24"). Missing from the §10
 * table and added there together with this constant.
 *
 * The distance between the two values is also the notice a person is owed:
 * the cleanup never deletes an account that was not warned at least
 * MESI_ACCOUNT_DORMIENTE - MESI_AVVISO_DORMIENZA months earlier. A run that
 * was off for a while therefore warns first and deletes a month later,
 * instead of catching up by deleting everybody at once.
 */
export const MESI_AVVISO_DORMIENZA = 23;

/**
 * Hours after which a link request that was never opened is removed (§6.1
 * point 4, §7). Such an address has no profile: only the Auth stub created
 * when the link was asked for. Missing from the §10 table and added there.
 */
export const ORE_RICHIESTE_INCOMPLETE = 24;

/**
 * Months the consent register is kept after an account is closed (§7).
 * The rows carry an internal id that no longer resolves to anyone; what
 * makes the rule applicable is the closing date, noted by the erasure
 * itself (§5.5). Missing from the §10 table and added there.
 */
export const MESI_CONSERVAZIONE_CONSENSI = 24;

/**
 * Free seats from which a cell warns "ultimo posto" instead of showing the
 * plain count (§6.2, §13.7). The threshold was missing from the §10 table
 * and has been added there together with this constant.
 */
export const SOGLIA_ULTIMI_POSTI = 1;

/** Public-name changes allowed per user per day (§6.5). */
export const MAX_CAMBI_NOME_GIORNO = 3;

/**
 * Minutes after which what is on screen is announced as no longer current
 * (§8.4 "Sede senza connessione", §12 step 13, §10).
 *
 * A page that has just been produced by the server is seconds old; one that
 * the browser took out of its own copy, with no connection, is hours or days
 * old. The distance between the two is what the notice is built on, so the
 * value only has to sit well clear of a live render — and low enough that a
 * page left open long enough to be wrong says so.
 */
export const MINUTI_COPIA_VECCHIA = 30;

/**
 * Hour at which the reminder of the evening before goes out (§6.3, §10).
 *
 * Declared here as the intent; what actually fires the job is the schedule in
 * vercel.json, which is expressed in universal time — so the message leaves at
 * 18:00 Italian time in summer and 17:00 in winter. For an evening reminder
 * that hour of difference changes nothing, and it costs one daily run instead
 * of twenty-four. Whoever moves this value must move the schedule with it.
 *
 * It also draws the line of §8.4: a booking made after the job has run for
 * tomorrow gets no reminder at all — the next run is already looking at the
 * day after.
 */
export const ORA_PROMEMORIA = "18:00";

/**
 * Hour at which the nightly cleanups run (§7, §12 step 11, §10).
 *
 * An intention, exactly like ORA_PROMEMORIA: the schedule in vercel.json is
 * in universal time, so the run happens at 03:00 Italian time in summer and
 * 02:00 in winter. Nothing here depends on the minute — every cleanup is
 * expressed in whole days or months, computed in Europe/Rome (§8.4).
 * Whoever moves this value must move the schedule with it.
 */
export const ORA_PULIZIE = "03:00";

/** Sender of every outbound email (D12, §14.2). Never the apex domain. */
export const EMAIL_MITTENTE = "noreply@coworking.sassifraga.org";

/**
 * Recipient of public-name moderation notices (§6.5). A board mailbox,
 * never a personal address. Read from the environment; undefined until set.
 */
export const EMAIL_MODERAZIONE: string | undefined = process.env.EMAIL_MODERAZIONE;

/**
 * Privacy notice linked above the sign-in button (§6.1, §14.4). The notice
 * is a new page on the institutional site, still to be written: placeholder
 * address, to confirm.
 */
export const URL_INFORMATIVA_PRIVACY = "https://www.sassifraga.org/privacy-coworking";

/**
 * Institutional site, linked from the header logo and the footer (§13.8,
 * §14.3). Not in the §10 table: it is the destination of a link, not a
 * limit, but it belongs with the other addresses.
 */
export const URL_SITO = "https://www.sassifraga.org";

/**
 * Where the app answers (§14.1). Emails carry absolute links and have no
 * request to take an origin from, so the address is configuration and not
 * something computed. `URL_APP` overrides it in development, where the same
 * links have to point at the local server.
 */
export const URL_APP = process.env.URL_APP ?? "https://prenota.sassifraga.org";

/** IANA timezone in which "today" is always computed (§8.4). */
export const FUSO_ORARIO = "Europe/Rome";
