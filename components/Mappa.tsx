import { collegamentoMappa, type LuogoSede } from "@/lib/mappa";
import { conValori, m } from "@/lib/messaggi";

/**
 * "Dove si trova" — SPEC §6.2, §11.B.
 *
 * Next to every sede of the availability grid, and of the list of sedi out
 * of season underneath it, a link that opens the position on Google Maps.
 * Visible to anyone, signed in or not: whoever does not know the valley has
 * to be able to see where the spaces are before deciding whether to register.
 *
 * A link, never a map drawn into the page: an embedded map writes
 * third-party cookies and would oblige the app to ask for a consent it is
 * built to do without (rule 7, §14.3). `rel="noreferrer"` so the page it
 * starts from does not travel with it either; `target="_blank"` so the grid
 * somebody was reading is still there when they come back.
 *
 * A sede with no position and no address gets nothing: a link that opens the
 * wrong place is worse than no link (§11.A).
 *
 * The visible words are the same on every row, so the accessible name
 * carries the sede: read out of context, "Dove si trova" alone would not say
 * which of six.
 */

type Proprieta = { sede: LuogoSede & { nome: string } };

export function Mappa({ sede }: Proprieta) {
  const indirizzo = collegamentoMappa(sede);
  if (!indirizzo) return null;
  const t = m.disponibilita;

  return (
    <a
      href={indirizzo}
      target="_blank"
      rel="noreferrer"
      aria-label={conValori(t.mappaEtichetta, { sede: sede.nome })}
      className="inline-flex min-h-tocco items-center text-nota font-regolare text-verde-testo underline"
    >
      {t.mappa}
    </a>
  );
}
