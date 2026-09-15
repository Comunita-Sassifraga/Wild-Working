/**
 * The sedi a referente looks after — SPEC §4, §5.2, D26.
 *
 * Since D26 the practical information of a sede is read only by somebody
 * with an active booking there. A referente looks after the space and needs
 * the keys and the Wi-Fi password whether or not they booked a desk that
 * day, so the database gives them a door of their own: `sedi_referente`,
 * which returns their sedi and nobody else's. Which sedi those are is
 * decided there by `is_referente_di()`, not here (§8.3): for a person with
 * no incarico the view is simply empty.
 */

import type { Client } from "./client";

export type SedeSeguita = {
  id: string;
  nome: string;
  comune: string;
  indirizzo: string | null;
  note: string | null;
};

export async function sediSeguite(client: Client): Promise<SedeSeguita[]> {
  const { data, error } = await client
    .from("sedi_referente")
    .select("id, nome, comune, indirizzo, note")
    .order("nome");
  if (error || !data) return [];
  return data.flatMap((r) =>
    r.id === null
      ? []
      : [
          {
            id: r.id,
            nome: r.nome ?? "",
            comune: r.comune ?? "",
            indirizzo: r.indirizzo,
            note: r.note,
          },
        ],
  );
}
