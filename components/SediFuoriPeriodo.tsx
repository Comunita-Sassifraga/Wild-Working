import { Mappa } from "@/components/Mappa";
import { dataBreve } from "@/lib/dates";
import type { AperturaFutura, SedePubblica } from "@/lib/db/disponibilita";
import { conValori, m } from "@/lib/messaggi";

/**
 * SPEC §6.2 — "Sedi non disponibili in questo periodo".
 *
 * A sede outside its periodo di attività leaves the grid, but is listed
 * here with the label of its next season and the reopening date when known.
 * Making it disappear altogether would lead people to believe it closed for
 * good.
 */

type Proprieta = {
  sedi: SedePubblica[];
  aperture: AperturaFutura[];
};

export function SediFuoriPeriodo({ sedi, aperture }: Proprieta) {
  if (sedi.length === 0) return null;
  const t = m.disponibilita.fuoriPeriodo;

  return (
    <section className="mt-12 border-t border-linea pt-8">
      <h2 className="text-titolo-sezione font-grassetto">{t.titolo}</h2>
      <ul className="mt-4 flex flex-col gap-4">
        {sedi.map((sede) => {
          const apertura = aperture.find((a) => a.sedeId === sede.id);
          return (
            <li key={sede.id}>
              <span className="font-grassetto">{sede.nome}</span>
              <span className="block text-nota text-testo-secondario">
                {apertura
                  ? conValori(t.riapre, {
                      data: dataBreve(apertura.data),
                      etichetta: apertura.etichetta,
                    })
                  : t.riaperturaSconosciuta}
              </span>
              {/* Knowing where Pigna is matters out of season too (§6.2). */}
              <Mappa sede={sede} />
            </li>
          );
        })}
      </ul>
    </section>
  );
}
