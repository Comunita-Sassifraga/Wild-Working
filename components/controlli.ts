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

/** Text field: linea hairline border, superficie background, controllo radius. */
export const campo =
  "block w-full min-h-tocco rounded-controllo border border-linea bg-superficie px-3 py-2 text-testo";
