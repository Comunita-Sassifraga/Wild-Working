/**
 * The reminder of the evening before — SPEC §6.3, §12 step 9, §15.10.
 *
 * Decision of 2026-09-10: booking sends no confirmation. What a person gets
 * is one message the evening before, when they can still change their mind
 * and free the seat for somebody else.
 *
 * One message per person and not per booking: whoever took a giornata intera,
 * or two sedi on the same day, reads one email with everything in it.
 *
 * The rows come from `promemoria_da_inviare()`, which marks them taken in the
 * same statement that returns them (see the migration). Nothing here decides
 * what to send: this file only turns rows into words.
 *
 * **Step 19 adds a second reminder below, for the activities of §15.10, and
 * changes nothing above it.** §15.10 is exact about the shape: *"Il promemoria
 * delle attività non è un secondo giro notturno: si aggiunge a quello che
 * parte già alle ORA_PROMEMORIA. Una sola esecuzione, due elenchi."* Two
 * lists means two messages: somebody who tomorrow has both a desk and an
 * activity gets the desk reminder and the activity reminder separately.
 * Merging them would have meant rewriting the composition of §6.3, which is
 * in service and which §15.14 names as what step 19 can break, and the gain —
 * one send fewer for the few people who have both — does not pay for it.
 *
 * No address is logged, returned or thrown (rule 4) — the outcome is counts.
 */

import { URL_APP } from "@/config/limits";
import type { Client } from "@/lib/db/client";
import type { Fascia } from "@/lib/db/prenotazioni";
import { dataEstesa, ora, type DataISO } from "@/lib/dates";
import { conValori, m } from "@/lib/messaggi";
import { righeAttivita, type SchedaPerEmail } from "./abitanti";
import { invia } from "./trasporto";

type RigaPromemoria = {
  utente_id: string;
  email: string;
  data: string;
  fascia: Fascia;
  sede_nome: string;
  comune: string;
  indirizzo: string | null;
  note: string | null;
  ora_inizio: string;
  ora_fine: string;
};

export type EsitoPromemoria = {
  /** Bookings taken in charge by this run. */
  prenotazioni: number;
  /** Messages the provider accepted. */
  inviati: number;
  /** Messages it refused. Those reminders are lost, never sent twice (§6.3). */
  falliti: number;
};

/**
 * Sends the reminders for one day and reports what happened.
 *
 * `giorno` is for the tests alone: in production nothing is passed and the
 * database picks tomorrow, in Europe/Rome (§8.4).
 */
export async function inviaPromemoria(
  client: Client,
  opzioni: { giorno?: DataISO } = {},
): Promise<EsitoPromemoria> {
  const { data, error } = await client.rpc(
    "promemoria_da_inviare",
    opzioni.giorno ? { p_giorno: opzioni.giorno } : {},
  );
  if (error || !data) return { prenotazioni: 0, inviati: 0, falliti: 0 };

  const righe = data as RigaPromemoria[];
  let inviati = 0;
  let falliti = 0;
  for (const persona of raggruppaPerPersona(righe)) {
    const esito = await invia(componi(persona));
    if (esito.ok) inviati += 1;
    else falliti += 1;
  }
  return { prenotazioni: righe.length, inviati, falliti };
}

/** The rows arrive ordered by person, day and fascia: one group per person. */
function raggruppaPerPersona(righe: RigaPromemoria[]): RigaPromemoria[][] {
  const gruppi = new Map<string, RigaPromemoria[]>();
  for (const riga of righe) {
    const gruppo = gruppi.get(riga.utente_id);
    if (gruppo) gruppo.push(riga);
    else gruppi.set(riga.utente_id, [riga]);
  }
  return [...gruppi.values()];
}

function componi(prenotazioni: RigaPromemoria[]): { a: string; oggetto: string; testo: string } {
  const prima = prenotazioni[0];
  const sedi = new Set(prenotazioni.map((p) => p.sede_nome));
  const promemoria = m.posta.promemoria;

  const blocchi = [
    conValori(promemoria.apertura, { data: dataEstesa(prima.data) }),
    prenotazioni.map(descrivi).join("\n\n"),
    promemoria.invito,
    conValori(promemoria.collegamento, { url: `${URL_APP}/prenotazioni` }),
    promemoria.chiusura,
  ];

  return {
    a: prima.email,
    oggetto:
      sedi.size === 1
        ? conValori(promemoria.oggettoUno, { sede: prima.sede_nome })
        : promemoria.oggettoPiu,
    testo: blocchi.join("\n\n"),
  };
}

/** One booking: where, when, and the practical notes of the sede (§5.2). */
function descrivi(p: RigaPromemoria): string {
  const promemoria = m.posta.promemoria;
  const righe = [
    conValori(promemoria.riga, {
      sede: p.sede_nome,
      comune: p.comune,
      fascia: m.disponibilita.fasce[p.fascia],
      orario: conValori(m.disponibilita.orario, {
        inizio: ora(p.ora_inizio),
        fine: ora(p.ora_fine),
      }),
    }),
  ];
  if (p.indirizzo) righe.push(conValori(promemoria.indirizzo, { indirizzo: p.indirizzo }));
  if (p.note) righe.push(conValori(promemoria.note, { note: p.note }));
  return righe.join("\n");
}

// ---------------------------------------------------------------------------
// The second list — «Prenota un abitante», SPEC §15.10, §15.14 step 19
// ---------------------------------------------------------------------------

/**
 * One activity somebody holds a place on tomorrow, as the job claims it.
 *
 * Level 2 of §15.8 is in here — surname, telephone, exact address — and it
 * belongs here: everybody in this list holds an ATTIVA iscrizione on the
 * activity, which is precisely the condition §15.8 puts on level 2, and the
 * evening before is when the address to walk to is worth having.
 */
type RigaAttivita = {
  iscrizione_id: string;
  utente_id: string;
  email: string;
  attivita_id: string;
  titolo: string | null;
  data: string | null;
  ora_inizio: string | null;
  ora_fine: string | null;
  luogo_generico: string | null;
  luogo_esatto: string | null;
  abitante_nome: string | null;
  abitante_cognome: string | null;
  abitante_telefono: string | null;
  cosa_portare: string | null;
  lingua_attivita: string | null;
};

export type EsitoPromemoriaAttivita = {
  /** Iscrizioni taken in charge by this run. */
  iscrizioni: number;
  /** Messages the provider accepted. */
  inviati: number;
  /** Messages it refused. Those reminders are lost, never sent twice (§6.3). */
  falliti: number;
};

/**
 * Sends the activity reminders for one day — SPEC §15.10.
 *
 * A twin of `inviaPromemoria` above, deliberately: same claim-and-read in one
 * statement, same one-message-per-person, same accepted cost of a failed send
 * being a reminder lost rather than a reminder doubled (§6.3). It is called
 * from the same nightly run and never from one of its own (§15.10).
 *
 * `giorno` is for the tests alone: in production nothing is passed and the
 * database picks tomorrow, in Europe/Rome (§8.4).
 */
export async function inviaPromemoriaAttivita(
  client: Client,
  opzioni: { giorno?: DataISO } = {},
): Promise<EsitoPromemoriaAttivita> {
  const { data, error } = await client.rpc(
    "promemoria_attivita_da_inviare",
    opzioni.giorno ? { p_giorno: opzioni.giorno } : {},
  );
  if (error || !data) return { iscrizioni: 0, inviati: 0, falliti: 0 };

  const righe = data as RigaAttivita[];
  let inviati = 0;
  let falliti = 0;
  for (const persona of raggruppaAttivitaPerPersona(righe)) {
    const esito = await invia(componiAttivita(persona));
    if (esito.ok) inviati += 1;
    else falliti += 1;
  }
  return { iscrizioni: righe.length, inviati, falliti };
}

/** The rows arrive ordered by person and hour: one group per person. */
function raggruppaAttivitaPerPersona(righe: RigaAttivita[]): RigaAttivita[][] {
  const gruppi = new Map<string, RigaAttivita[]>();
  for (const riga of righe) {
    const gruppo = gruppi.get(riga.utente_id);
    if (gruppo) gruppo.push(riga);
    else gruppi.set(riga.utente_id, [riga]);
  }
  return [...gruppi.values()];
}

/**
 * One message for one person, with every activity they have tomorrow in it —
 * the same rule as §6.3: one per person and per day, not one per place held.
 *
 * The words of each activity are built by `righeAttivita`, the same builder
 * the confirmation of §15.10 uses, so the two messages say the same things in
 * the same order and cannot drift apart.
 */
function componiAttivita(iscrizioni: RigaAttivita[]): {
  a: string;
  oggetto: string;
  testo: string;
} {
  const prima = iscrizioni[0];
  const promemoria = m.posta.promemoriaAttivita;
  const una = iscrizioni.length === 1;

  const blocchi = [
    conValori(una ? promemoria.aperturaUna : promemoria.apertura, {
      data: prima.data ? dataEstesa(prima.data as DataISO) : "",
    }),
    iscrizioni.map((i) => righeAttivita(scheda(i)).join("\n")).join("\n\n"),
    promemoria.invito,
    conValori(promemoria.collegamento, { url: `${URL_APP}/abitanti` }),
    promemoria.chiusura,
  ];

  return {
    a: prima.email,
    oggetto: una
      ? conValori(promemoria.oggettoUno, { attivita: prima.titolo ?? m.posta.abitanti.senzaTitolo })
      : promemoria.oggettoPiu,
    testo: blocchi.join("\n\n"),
  };
}

/** The claimed row, in the shape every message of the module is built from. */
const scheda = (i: RigaAttivita): SchedaPerEmail => ({
  id: i.attivita_id,
  titolo: i.titolo,
  data: i.data,
  ora_inizio: i.ora_inizio,
  luogo_generico: i.luogo_generico,
  luogo_esatto: i.luogo_esatto,
  abitante_nome: i.abitante_nome,
  abitante_cognome: i.abitante_cognome,
  abitante_telefono: i.abitante_telefono,
  cosa_portare: i.cosa_portare,
  lingua_attivita: i.lingua_attivita,
});
