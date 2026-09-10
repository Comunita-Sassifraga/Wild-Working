/**
 * The dormancy warning — SPEC §7, §12 step 11.
 *
 * "Account senza accessi da 24 mesi: avviso via email a 23 mesi;
 * cancellazione a 24." This is that one email, and it is the only notice a
 * person gets: the closing itself sends nothing, for the same reason the
 * erasure of art. 17 sends nothing — afterwards there is no address left to
 * write to.
 *
 * So the message has to do the whole job on its own: say when they were last
 * here, say what will disappear, and say the one thing that stops it. The
 * way out is a plain sign-in: entering moves ultimo_accesso, and the
 * database clears the warning with it.
 *
 * The rows come from `avvisi_dormienza_da_inviare()`, which marks them taken
 * in the same statement that returns them. Nothing here decides who is
 * warned: this file only turns rows into words.
 *
 * No address is logged, returned or thrown (rule 4) — the outcome is counts.
 */

import { URL_APP } from "@/config/limits";
import { dataBreve, dataRoma } from "@/lib/dates";
import { conValori, m } from "@/lib/messaggi";
import { invia, type EsitoInvio } from "./trasporto";

export type RigaDormienza = {
  utente_id: string;
  email: string;
  ultimo_accesso: string;
};

/**
 * Warns one person. The date is written with its year: the last sign-in is
 * two years back, and "3 ottobre" alone would read as a date just past.
 */
export async function avvisaDormienza(riga: RigaDormienza): Promise<EsitoInvio> {
  const dormienza = m.posta.dormienza;
  return invia({
    a: riga.email,
    oggetto: dormienza.oggetto,
    testo: conValori(dormienza.testo, {
      data: dataBreve(dataRoma(new Date(riga.ultimo_accesso))),
      url: `${URL_APP}/accedi`,
    }),
  });
}
