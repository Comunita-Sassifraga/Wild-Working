/**
 * Diritti dell'interessato — SPEC §7, §12 step 10.
 *
 * Two rights the person exercises alone: access and portability (art. 15 and
 * art. 20, "Scarica i miei dati") and erasure (art. 17).
 *
 * Everything here runs under the caller's own session. Reading somebody
 * else's data is impossible not because this file avoids it but because the
 * access policies and views do (§8.3): the queries below carry no filter on
 * the person at all — the database puts it there.
 *
 * No email address is ever logged or thrown (rule 4). The address does travel
 * inside the exported file, which is the whole point of art. 15: it goes to
 * the person it belongs to and nowhere else.
 */

import type { Client } from "./client";
import type { Database } from "./types";
import { colonneProfilo } from "./utenti";

type RigaConsenso = Pick<
  Database["public"]["Tables"]["consensi"]["Row"],
  "tipo" | "valore" | "data_ora"
>;

/** The columns the export selects — the view's own `id` is of no use to anyone. */
type RigaPrenotazione = Omit<Database["public"]["Views"]["miei_dati_prenotazioni"]["Row"], "id">;

/**
 * The file "Scarica i miei dati" hands over — SPEC §7.
 *
 * `generato_il` says when the picture was taken: a file with no date says
 * nothing about how current it is, and this one is a snapshot of a moment.
 */
export type MieiDati = {
  generato_il: string;
  profilo: Profilo;
  prenotazioni: Prenotazione[];
  consensi: Consenso[];
};

type Profilo = {
  email: string;
  nome_pubblico: string | null;
  mostra_nome_pubblico: boolean;
  eta: string | null;
  genere: string | null;
  professione: string | null;
  motivo_visita: string | null;
  residenza: string | null;
  lingua: string;
  creato_il: string;
  ultimo_accesso: string;
};

type Prenotazione = {
  data: string;
  fascia: string;
  ora_inizio: string | null;
  ora_fine: string | null;
  sede: string | null;
  comune: string | null;
  indirizzo: string | null;
  stato: string;
  giornata_intera: boolean;
  prenotata_il: string;
};

type Consenso = { tipo: string; valore: string; data_ora: string };

/**
 * Everything the app holds about the person, ready to be written out.
 *
 * Three sources, and nothing else exists: the profile, the bookings still
 * linked to them, and their own rows of the consent register — which §7 names
 * explicitly ("anche in «Scarica i miei dati»").
 *
 * Deliberately absent:
 *   * `posto_progressivo`, internal and never shown to a user (§8.1). It is
 *     not in the view, so it could not come out even by mistake;
 *   * the five `stat_` columns of anonymised bookings: after the copy they
 *     are nobody's data, and there is no way to tell which ones were theirs
 *     (§5.3);
 *   * the moderation register (§5.9), which stays the amministratore's
 *     (decision of 2026-09-11).
 *
 * Returns null when the profile cannot be read, which in practice means the
 * session is gone.
 */
export async function mieiDati(client: Client, utenteId: string): Promise<MieiDati | null> {
  const [profilo, prenotazioni, consensi] = await Promise.all([
    client.from("utenti").select(colonneProfilo).eq("id", utenteId).single(),
    client
      .from("miei_dati_prenotazioni")
      // One literal: the client reads the column list at compile time.
      // prettier-ignore
      .select("data, fascia, gruppo_id, stato, creata_il, sede_nome, comune, indirizzo, ora_inizio, ora_fine")
      .order("data")
      .order("fascia"),
    client.from("consensi").select("tipo, valore, data_ora").order("data_ora"),
  ]);

  if (profilo.error || !profilo.data) return null;
  const p = profilo.data;

  return {
    generato_il: new Date().toISOString(),
    profilo: {
      email: p.email,
      nome_pubblico: p.nome_pubblico,
      mostra_nome_pubblico: p.mostra_nome_pubblico,
      eta: p.eta,
      genere: p.genere,
      professione: p.professione,
      motivo_visita: p.motivo_visita,
      residenza: p.residenza,
      lingua: p.lingua,
      creato_il: p.creato_il,
      ultimo_accesso: p.ultimo_accesso,
    },
    prenotazioni: (prenotazioni.data ?? []).flatMap(rigaPrenotazione),
    consensi: (consensi.data ?? []).map((c: RigaConsenso) => ({
      tipo: c.tipo,
      valore: c.valore,
      data_ora: c.data_ora,
    })),
  };
}

/**
 * A view column is nullable to the type generator even when the query cannot
 * produce a null. The rows that would be unreadable are dropped rather than
 * exported half empty.
 */
function rigaPrenotazione(r: RigaPrenotazione): Prenotazione[] {
  if (r.data === null || r.fascia === null || r.stato === null || r.creata_il === null) return [];
  return [
    {
      data: r.data,
      fascia: r.fascia,
      ora_inizio: r.ora_inizio,
      ora_fine: r.ora_fine,
      sede: r.sede_nome,
      comune: r.comune,
      indirizzo: r.indirizzo,
      stato: r.stato,
      // The gruppo_id links the two halves of a giornata intera (§3). The
      // identifier itself says nothing to the person; that it was a whole
      // day does.
      giornata_intera: r.gruppo_id !== null,
      prenotata_il: r.creata_il,
    },
  ];
}

/**
 * Erasure, art. 17 — SPEC §7, §8.4.
 *
 * The whole thing happens inside `cancella_mio_account()`: bookings freed and
 * cut loose, consents revoked in the register, account gone. This function
 * only reports whether it happened. It takes no id, so there is nothing here
 * that could be pointed at somebody else.
 *
 * Nothing is written to a log either way (rule 4).
 */
export async function cancellaMioAccount(client: Client): Promise<{ ok: boolean }> {
  const { error } = await client.rpc("cancella_mio_account");
  return { ok: error === null };
}
