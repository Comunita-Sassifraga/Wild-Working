/**
 * Class sets for the controls of SPEC §13.6, so that every button and
 * field in the app is drawn the same way. Only token classes: no literal
 * value here or in the components that use them (CLAUDE.md rule 12).
 *
 * Every control is at least `tocco` on both axes: the app is used from
 * a phone, often outdoors.
 */

const bottone =
  "inline-flex min-h-tocco min-w-tocco items-center justify-center rounded-controllo px-6 py-2 font-grassetto no-underline";

/** Primary action (Prenota, Conferma): verde fill, testo text — never white. */
export const bottonePrimario = `${bottone} bg-verde text-testo`;

/** Secondary action: testo outline, transparent background. */
export const bottoneSecondario = `${bottone} border border-testo bg-trasparente text-testo`;

/** Destructive action (Annulla prenotazione, Cancella account): errore text, no fill. */
export const bottoneDistruttivo = `${bottone} bg-trasparente text-errore`;

/**
 * The line of explanation that stands **above** a control — the note of the
 * two Rimando of §6.2 and §6.6, the line of §15.5 above the module entry.
 *
 * One class set, so "the same distance" stays true: the three pairs on the
 * availability page and the public one are built from this single value, and
 * moving it moves all of them at once. Above and not below since 2026-09-15:
 * the reader meets the sentence first and then the control it describes, and
 * the same shape serves both blocks instead of one being the mirror of the
 * other.
 */
export const notaControllo = "mb-2 block text-nota text-testo-secondario";

/** Text field: linea hairline border, superficie background, controllo radius. */
export const campo =
  "block w-full min-h-tocco rounded-controllo border border-linea bg-superficie px-3 py-2 text-testo";
