import { dataEstesa, type DataISO } from "@/lib/dates";
import { statoCella, type Cella } from "@/lib/disponibilita";
import type { SedePubblica } from "@/lib/db/disponibilita";
import type { Fascia } from "@/lib/db/prenotazioni";
import { conValori, m } from "@/lib/messaggi";

/**
 * The chosen day, sede by sede — SPEC §6.2: sedi on the rows, the two fasce
 * on the columns, free seats out of total, and the NUMBER of people who made
 * their presence public.
 *
 * Never the names: those live only on the "Chi c'è in Valle" page (rule 8).
 * Every state also carries its word, so nothing is told by colour alone
 * (rule 14). Stile 1 throughout: a grid is dense information, and Stile 2 is
 * an accent register (§13.2).
 */

type Proprieta = {
  data: DataISO;
  sedi: SedePubblica[];
  celle: Cella[];
};

const FASCE: Fascia[] = ["MATTINA", "POMERIGGIO"];

const cellaBase = "border border-linea px-3 py-3 align-top";

function orarioDi(sede: SedePubblica, fascia: Fascia): string {
  return fascia === "MATTINA" ? sede.orarioMattina : sede.orarioPomeriggio;
}

function Contenuto({ cella, orario }: { cella: Cella; orario: string }) {
  const t = m.disponibilita.celle;
  const stato = statoCella(cella);

  if (stato === "CHIUSA") {
    return <span className="text-testo-secondario">{t.chiuso}</span>;
  }

  const conteggio = conValori(t.liberi, { liberi: cella.liberi, capienza: cella.capienza });
  const etichetta =
    stato === "ESAURITA"
      ? t.esaurito
      : stato === "ULTIMI"
        ? cella.liberi === 1
          ? t.ultimi
          : conValori(t.ultimiAlPlurale, { liberi: cella.liberi })
        : cella.liberi === 1
          ? t.unPostoLibero
          : t.postiLiberi;

  return (
    <>
      <span className="block text-nota text-testo-secondario">{orario}</span>
      <span className="mt-1 block font-grassetto">{conteggio}</span>
      <span className={`block ${stato === "ULTIMI" ? "text-avviso" : "text-testo-secondario"}`}>
        {etichetta}
      </span>
      {cella.pubbliche > 0 ? (
        <span className="mt-2 block text-nota text-testo-secondario">
          {cella.pubbliche === 1
            ? t.unaPubblica
            : conValori(t.pubbliche, { numero: cella.pubbliche })}
        </span>
      ) : null}
    </>
  );
}

export function TabellaGiorno({ data, sedi, celle }: Proprieta) {
  const t = m.disponibilita;
  const per = (sedeId: string, fascia: Fascia) =>
    celle.find((c) => c.sedeId === sedeId && c.fascia === fascia);

  return (
    // Fixed layout: the three columns share the width evenly, so the two
    // fasce are drawn the same and the orari do not wrap on a phone.
    <table className="mt-6 w-full table-fixed border-collapse text-left">
      <caption className="mb-4 text-left text-titolo-sezione font-grassetto">
        {dataEstesa(data)}
      </caption>
      <thead>
        <tr>
          <th scope="col" className={`${cellaBase} bg-superficie-scura`}>
            {t.sede}
          </th>
          {FASCE.map((fascia) => (
            <th key={fascia} scope="col" className={`${cellaBase} bg-superficie-scura`}>
              {t.fasce[fascia]}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {sedi.map((sede) => (
          <tr key={sede.id}>
            <th scope="row" className={`${cellaBase} bg-superficie font-grassetto`}>
              {sede.nome}
              <span className="mt-1 block text-nota font-regolare text-testo-secondario">
                {sede.comune}
              </span>
            </th>
            {FASCE.map((fascia) => {
              const cella = per(sede.id, fascia);
              const chiusa = !cella || !cella.prenotabile;
              return (
                <td
                  key={fascia}
                  className={`${cellaBase} ${chiusa ? "bg-superficie-scura" : "bg-superficie"}`}
                >
                  {cella ? (
                    <Contenuto cella={cella} orario={orarioDi(sede, fascia)} />
                  ) : (
                    <span className="text-testo-secondario">{t.celle.chiuso}</span>
                  )}
                </td>
              );
            })}
          </tr>
        ))}
      </tbody>
    </table>
  );
}
