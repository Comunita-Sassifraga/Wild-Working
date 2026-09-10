/**
 * The reminder of the evening before — SPEC §6.3, §12 step 9.
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
 * No address is logged, returned or thrown (rule 4) — the outcome is counts.
 */

import { URL_APP } from "@/config/limits";
import type { Client } from "@/lib/db/client";
import type { Fascia } from "@/lib/db/prenotazioni";
import { dataEstesa, ora, type DataISO } from "@/lib/dates";
import { conValori, m } from "@/lib/messaggi";
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
