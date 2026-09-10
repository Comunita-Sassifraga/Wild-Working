import { FINESTRA_GIORNI } from "@/config/limits";
import { dataEstesa } from "@/lib/dates";
import { orarioDi } from "@/lib/disponibilita";
import { rigaPersone, type SedePresente } from "@/lib/presenze";
import { conValori, m } from "@/lib/messaggi";

/**
 * One sede on "Chi c'è in Valle" — SPEC §6.6.
 *
 * Days with somebody in them, and inside each day one line per fascia: a
 * booking is a fascia, not a day, and whoever arrives after lunch has to be
 * able to tell who they will find. Somebody who booked the whole day appears
 * in both lines.
 *
 * A sede where nobody has booked yet keeps its place in the list with a
 * single line: making it disappear would say it had closed.
 *
 * Stile 1 throughout. The green band of §13.2 belongs to the head of the
 * page: a list of names is content, and Stile 2 does not carry data.
 */

export function PresenzeSede({ presenza }: { presenza: SedePresente }) {
  const t = m.chiCe;
  const { sede, giorni } = presenza;

  return (
    <section className="mt-10 border-t border-linea pt-6">
      <h2 className="text-titolo-sezione font-grassetto">{sede.nome}</h2>
      <p className="mt-1 text-nota text-testo-secondario">{sede.comune}</p>

      {giorni.length === 0 ? (
        <p className="mt-4 text-testo-secondario">
          {conValori(t.nessunoInSede, { giorni: FINESTRA_GIORNI })}
        </p>
      ) : (
        <ul className="mt-6 flex flex-col gap-6">
          {giorni.map((giorno) => (
            <li key={giorno.data}>
              <h3 className="font-grassetto">{dataEstesa(giorno.data)}</h3>
              <ul className="mt-2 flex flex-col gap-3">
                {giorno.fasce.map((f) => (
                  <li key={f.fascia}>
                    <span className="block text-nota text-testo-secondario">
                      {conValori(t.fascia, {
                        fascia: m.disponibilita.fasce[f.fascia],
                        orario: orarioDi(sede, f.fascia),
                      })}
                    </span>
                    <span className="block">{rigaPersone(f.nomi, f.senzaNome)}</span>
                  </li>
                ))}
              </ul>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
