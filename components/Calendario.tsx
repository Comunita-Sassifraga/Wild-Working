import Link from "next/link";
import { dataEstesa, giornoDelMese, meseBreve, type DataISO } from "@/lib/dates";
import { giornoApribile, type Giorno, type StatoGiorno } from "@/lib/disponibilita";
import { m } from "@/lib/messaggi";

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
// Children stretch to the column width — not `items-center`, which would let
// a long word grow past the cell instead of wrapping inside it.
const cella = "flex h-full min-h-tocco flex-col justify-center px-0 py-2 text-center";
const sfondoSpento = "bg-superficie-scura text-testo-secondario";
const sfondoAperto = "bg-superficie text-testo";
const sfondoScelto = "bg-verde text-testo";

/**
 * The word under the day number, and the empty string when there is none.
 * One word, never a count: the calendar says whether the day is open, the
 * table below says how many places are left and where (§6.2).
 */
function etichetta(giorno: Giorno): string {
  const t = m.disponibilita.calendario;
  switch (giorno.stato) {
    case "LIBERO":
      return t.libero;
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
      {/* A calendar column is narrower than the word: let it hyphenate, and
          break it anyway where the browser has no Italian dictionary. */}
      {testo ? <span className="hyphens-auto break-words text-nota">{testo}</span> : null}
    </>
  );

  if (scelto) {
    return (
      // Not bolded as a whole: the day number is already bold everywhere, and
      // bold widens the label past the column. The chosen day is told apart by
      // the verde fill, by not being a link, and by the heading right below.
      <span
        aria-current="date"
        aria-label={`${nome}, ${m.disponibilita.calendario.scelto}`}
        className={cella}
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
              const giorno = giorni.get(data) ?? { data, stato: "OLTRE" as StatoGiorno };
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
