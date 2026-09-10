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

/** Public-name changes allowed per user per day (§6.5). */
export const MAX_CAMBI_NOME_GIORNO = 3;

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

/** IANA timezone in which "today" is always computed (§8.4). */
export const FUSO_ORARIO = "Europe/Rome";
