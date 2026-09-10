import Link from "next/link";
import { dataEstesa, giornoDelMese, meseBreve, type DataISO } from "@/lib/dates";
import { giornoApribile, type Giorno, type StatoGiorno } from "@/lib/disponibilita";
import { conValori, m } from "@/lib/messaggi";

/**
 * The calendar of SPEC §6.2 — whole weeks, from the Monday of the current
 * week to the Sunday of the week the last bookable day falls in.
 *
 * Days outside the window stay in the grid, switched off, so the weeks
 * remain whole. Only the days that are closed say why: a day already gone
 * or not yet open needs no explanation, the calendar itself shows where
 * today is.
 *
 * No state is told by colour alone (rule 14): every day carries its count
 * or its word, and the chosen day is bold and is not a link.
 */

type Proprieta = {
  settimane: DataISO[][];
  giorni: ReadonlyMap<DataISO, Giorno>;
  scelto: DataISO;
};

// The background lives on the cell itself, so that a short day and a tall one
// in the same week are filled to the same height.
const cella = "flex h-full min-h-tocco flex-col items-center justify-center px-1 py-2 text-center";
const sfondoSpento = "bg-superficie-scura text-testo-secondario";
const sfondoAperto = "bg-superficie text-testo";
const sfondoScelto = "bg-verde text-testo";

/** The word or count under the day number, and the empty string when there is none. */
function etichetta(giorno: Giorno): string {
  const t = m.disponibilita.calendario;
  switch (giorno.stato) {
    case "LIBERO":
      return conValori(t.liberi, { liberi: giorno.liberi });
    case "ESAURITO":
      return t.esaurito;
    case "CHIUSO":
      return t.chiuso;
    default:
      return "";
  }
}

function Numero({ data }: { data: DataISO }) {
  const giorno = giornoDelMese(data);
  return (
    <span className="font-grassetto">
      {giorno === 1 ? `${giorno} ${meseBreve(data)}` : giorno}
    </span>
  );
}

/** The background a day is drawn on, and what sits inside it. */
function Casella({ giorno, scelto }: { giorno: Giorno; scelto: boolean }) {
  const testo = etichetta(giorno);
  const nome = testo ? `${dataEstesa(giorno.data)}, ${testo}` : dataEstesa(giorno.data);
  const contenuto = (
    <>
      <Numero data={giorno.data} />
      {testo ? <span className="text-nota">{testo}</span> : null}
    </>
  );

  if (scelto) {
    return (
      <span
        aria-current="date"
        aria-label={`${nome}, ${m.disponibilita.calendario.scelto}`}
        className={`${cella} font-grassetto`}
      >
        {contenuto}
      </span>
    );
  }

  if (!giornoApribile(giorno.stato)) {
    return (
      <span aria-label={nome} className={cella}>
        {contenuto}
      </span>
    );
  }

  return (
    // A whole cell is the target, so it is not drawn as a run of link text:
    // `testo`, not underlined, like the header logo (§13.6).
    <Link
      href={`/?data=${giorno.data}`}
      aria-label={nome}
      className={`${cella} text-testo no-underline`}
    >
      {contenuto}
    </Link>
  );
}

function sfondoDi(giorno: Giorno, scelto: boolean): string {
  if (scelto) return sfondoScelto;
  return giornoApribile(giorno.stato) ? sfondoAperto : sfondoSpento;
}

const fuoriFinestra: StatoGiorno[] = ["PASSATO", "OLTRE"];

export function Calendario({ settimane, giorni, scelto }: Proprieta) {
  const t = m.disponibilita.calendario;
  return (
    <table className="mt-8 w-full table-fixed border-collapse">
      <caption className="mb-4 text-left text-titolo-sezione font-grassetto">{t.titolo}</caption>
      <thead>
        <tr>
          {t.giorniSettimana.map((nome) => (
            <th key={nome} scope="col" className="pb-2 text-nota font-regolare text-testo-secondario">
              {nome}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {settimane.map((settimana) => (
          <tr key={settimana[0]}>
            {settimana.map((data) => {
              const giorno = giorni.get(data) ?? { data, stato: "OLTRE" as StatoGiorno, liberi: 0 };
              const evidenziato = data === scelto && !fuoriFinestra.includes(giorno.stato);
              return (
                <td
                  key={data}
                  className={`h-full border border-linea p-0 ${sfondoDi(giorno, evidenziato)}`}
                >
                  <Casella giorno={giorno} scelto={evidenziato} />
                </td>
              );
            })}
          </tr>
        ))}
      </tbody>
    </table>
  );
}
