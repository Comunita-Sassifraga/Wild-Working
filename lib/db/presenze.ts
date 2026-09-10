/**
 * Public presences — SPEC §6.6, §12 step 7.
 *
 * The one door in the whole app through which a `nome_pubblico` reaches a
 * visitor. Everything that decides whether a name may come out lives in the
 * `presenze_pubbliche` view: the switch (`mostra_nome_pubblico`), the
 * window, the active sede, the active booking (rules 3 and 8, §8.3). Nothing
 * is filtered again here — a second filter in TypeScript would be a second
 * answer waiting to disagree with the first.
 *
 * The view carries no identifier of any kind: sede, day, fascia and the name.
 * Nothing links a name back to a row, an account or an email.
 */

import type { DataISO } from "@/lib/dates";
import type { Client } from "./client";
import type { Fascia } from "./prenotazioni";

/** One person who chose to be seen, in one sede, on one day, in one fascia. */
export type Presenza = {
  sedeId: string;
  data: DataISO;
  fascia: Fascia;
  nomePubblico: string;
};

/**
 * Every public presence of the bookable window, in one query.
 *
 * Ordered by name so the same slot always reads the same way: the order of a
 * list of people is not information, and letting the database return it as it
 * pleases would reshuffle the page at every reload.
 */
export async function presenzePubbliche(client: Client): Promise<Presenza[]> {
  const { data, error } = await client
    .from("presenze_pubbliche")
    .select("sede_id, data, fascia, nome_pubblico")
    .order("nome_pubblico");
  if (error || !data) return [];
  return data.flatMap((r) =>
    r.sede_id === null || r.data === null || r.fascia === null || r.nome_pubblico === null
      ? []
      : [{ sedeId: r.sede_id, data: r.data, fascia: r.fascia, nomePubblico: r.nome_pubblico }],
  );
}
