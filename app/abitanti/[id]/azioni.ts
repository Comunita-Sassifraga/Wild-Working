"use server";

/**
 * Taking a place and giving it up — SPEC §15.7, and since step 19 the two
 * emails §15.10 puts beside them (rows one and two).
 *
 * Both actions are one call to `lib/db/iscrizioni.ts`, one message, and one
 * redirect. No condition is examined here: whether there is a place left,
 * whether the caller may take it, whether the activity has begun and whose
 * row this is are all decided inside the database, which is the only place a
 * page cannot fail to have consulted (rule 5, rule 22, §8.3).
 *
 * The message is sent after the write and its outcome does not undo it: a
 * place taken is taken even if the post office is down, and telling somebody
 * their sign-up failed when their seat is real would be worse than silence.
 * What the screen says is what was done — and the page itself carries the
 * same level 2 data the confirmation carries (§15.6).
 *
 * Nothing personal travels in the address, in either direction: what comes
 * back is one word out of a closed list, the page re-reads everything else
 * from the database under the caller's own identity, and the email address
 * is read by lib/posta/abitanti.ts with the backend client (rule 4).
 */

import { redirect } from "next/navigation";
import { utenteAttuale } from "@/lib/auth/sessione";
import {
  annullaIscrizione,
  attivitaConLivelli,
  iscrivitiAttivita,
  type AttivitaElencata,
  type DatiIscritto,
} from "@/lib/db/iscrizioni";
import { clientServer } from "@/lib/db/server";
import { confermaAnnullamento, confermaIscrizione, type SchedaPerEmail } from "@/lib/posta/abitanti";

/**
 * The card as the messages want it, from the two windows the page already
 * reads (§15.8). Level 2 is whatever the database chose to hand this caller:
 * absent, the lines that would carry it are simply not written, which is the
 * same thing the page does.
 */
function scheda(
  id: string,
  attivita: AttivitaElencata,
  livello2: DatiIscritto | null,
): SchedaPerEmail {
  return {
    id,
    titolo: attivita.titolo,
    data: attivita.data,
    ora_inizio: attivita.oraInizio,
    luogo_generico: attivita.luogoGenerico,
    luogo_esatto: livello2?.luogoEsatto ?? null,
    abitante_nome: attivita.abitanteNome,
    abitante_cognome: livello2?.abitanteCognome ?? null,
    abitante_telefono: livello2?.abitanteTelefono ?? null,
    cosa_portare: attivita.cosaPortare,
    lingua_attivita: attivita.linguaAttivita,
  };
}

export async function iscrivitiAzione(formData: FormData): Promise<void> {
  const attivitaId = String(formData.get("attivita") ?? "");
  if (!attivitaId) redirect("/abitanti");

  const client = await clientServer();
  const esito = await iscrivitiAttivita(client, attivitaId);

  if (esito.ok) {
    // Read AFTER the write, and under the caller's own identity: the place is
    // theirs now, so `attivita_iscritto` answers with level 2 and the message
    // carries the address to walk to (§15.8, §15.10). Nothing here decides
    // that — the view does, and it would answer empty for anybody else.
    const persona = await utenteAttuale();
    const letta = await attivitaConLivelli(client, attivitaId);
    if (persona && letta) {
      await confermaIscrizione(persona.id, scheda(attivitaId, letta.attivita, letta.livello2));
    }
  }

  redirect(
    esito.ok
      ? `/abitanti/${attivitaId}?esito=iscritto`
      : `/abitanti/${attivitaId}?esito=${esito.motivo}`,
  );
}

export async function annullaAzione(formData: FormData): Promise<void> {
  const attivitaId = String(formData.get("attivita") ?? "");
  const iscrizioneId = String(formData.get("iscrizione") ?? "");
  if (!attivitaId || !iscrizioneId) redirect("/abitanti");

  const client = await clientServer();

  // Read BEFORE the write. Cancelling takes level 2 away in the same instant
  // (§15.8, §15.12), and it can take the whole row away — an activity of an
  // edition since switched off is no longer in the elenco either. What the
  // message needs is the title and the day, and this is the last moment they
  // are certain to be readable. Level 2 is dropped on purpose: the place has
  // been given up, and a message sent afterwards must not hand it back.
  const persona = await utenteAttuale();
  const letta = await attivitaConLivelli(client, attivitaId);

  const esito = await annullaIscrizione(client, iscrizioneId);

  if (esito.ok && persona && letta) {
    await confermaAnnullamento(persona.id, scheda(attivitaId, letta.attivita, null));
  }

  // The policy changes no row once the activity has begun, and none at all on
  // somebody else's: one refusal covers both, and it says what to do next.
  redirect(`/abitanti/${attivitaId}?esito=${esito.ok ? "annullata" : "TARDI"}`);
}
