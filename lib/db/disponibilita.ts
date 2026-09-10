/**
 * Availability reads — SPEC §6.2.
 *
 * Three public views, readable without signing in, all of them counts only:
 * no email, no nome_pubblico, no identifier of a person (rules 8, 15, 16).
 * The bookability of a sede is decided inside the database by
 * sede_prenotabile(); nothing is recomputed here.
 *
 * The views declare every column nullable, as views do. The mapping below
 * settles that once, so the page works with plain values.
 */

import type { Cella } from "@/lib/disponibilita";
import type { DataISO } from "@/lib/dates";
import type { Client } from "./client";
import type { Fascia } from "./prenotazioni";
import type { Database } from "./types";

type GiornoApertura = Database["public"]["Enums"]["giorno_settimana"];

/** A sede as a visitor sees it: no `note`, which is for registered users only. */
export type SedePubblica = {
  id: string;
  nome: string;
  comune: string;
  indirizzo: string | null;
  capienza: number;
  /** Start and end of each fascia, as real times (§5.2). The label is composed from them. */
  orari: Record<Fascia, { inizio: string; fine: string }>;
  giorniApertura: GiornoApertura[];
};

/** Next opening of a seasonal sede, for the list under the grid. */
export type AperturaFutura = {
  sedeId: string;
  etichetta: string;
  data: DataISO;
};

/**
 * The practical notes of a sede — Wi-Fi, keys, access (§5.2). Readable by
 * registered users only: the grant exists for `authenticated` alone, so a
 * visitor gets nothing here, and the booking page asks only when someone is
 * signed in. Never contains passwords or codes.
 */
export async function noteSede(client: Client, sedeId: string): Promise<string | null> {
  const { data, error } = await client.from("sedi").select("note").eq("id", sedeId).maybeSingle();
  if (error || !data) return null;
  return data.note;
}

export async function sediPubbliche(client: Client): Promise<SedePubblica[]> {
  const { data, error } = await client
    .from("sedi_pubbliche")
    // One literal: the client reads the column list at compile time to type the rows.
    // prettier-ignore
    .select("id, nome, comune, indirizzo, capienza, ora_inizio_mattina, ora_fine_mattina, ora_inizio_pomeriggio, ora_fine_pomeriggio, giorni_apertura")
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
            capienza: r.capienza ?? 0,
            orari: {
              MATTINA: { inizio: r.ora_inizio_mattina ?? "", fine: r.ora_fine_mattina ?? "" },
              POMERIGGIO: {
                inizio: r.ora_inizio_pomeriggio ?? "",
                fine: r.ora_fine_pomeriggio ?? "",
              },
            },
            giorniApertura: r.giorni_apertura ?? [],
          },
        ],
  );
}

/** Every sede/day/fascia of the bookable window, in one query. */
export async function disponibilitaPubblica(client: Client): Promise<Cella[]> {
  const { data, error } = await client
    .from("disponibilita_pubblica")
    .select("sede_id, data, fascia, capienza, prenotati, liberi, pubbliche, in_stagione, prenotabile");
  if (error || !data) return [];
  return data.flatMap((r) =>
    r.sede_id === null || r.data === null || r.fascia === null
      ? []
      : [
          {
            sedeId: r.sede_id,
            data: r.data,
            fascia: r.fascia,
            capienza: r.capienza ?? 0,
            prenotati: r.prenotati ?? 0,
            liberi: r.liberi ?? 0,
            pubbliche: r.pubbliche ?? 0,
            inStagione: r.in_stagione ?? false,
            prenotabile: r.prenotabile ?? false,
          },
        ],
  );
}

export async function apertureFuture(client: Client): Promise<AperturaFutura[]> {
  const { data, error } = await client
    .from("aperture_future")
    .select("sede_id, etichetta, data_apertura");
  if (error || !data) return [];
  return data.flatMap((r) =>
    r.sede_id === null || r.data_apertura === null
      ? []
      : [{ sedeId: r.sede_id, etichetta: r.etichetta ?? "", data: r.data_apertura }],
  );
}
