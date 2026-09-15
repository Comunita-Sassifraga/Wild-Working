import Link from "next/link";
import { redirect } from "next/navigation";
import { bottoneDistruttivo } from "@/components/controlli";
import { utenteAttuale } from "@/lib/auth/sessione";
import { dataEstesa } from "@/lib/dates";
import { miePrenotazioni, type MiaPrenotazione } from "@/lib/db/prenotazioni";
import { sediSeguite, type SedeSeguita } from "@/lib/db/sedi";
import { clientServer } from "@/lib/db/server";
import { orarioTesto } from "@/lib/disponibilita";
import { m } from "@/lib/messaggi";
import { annullaAzione } from "./azioni";

/**
 * "Le mie prenotazioni" — the page SPEC §6.4 calls "la propria pagina",
 * described there as part of this step: the active bookings from today to the
 * end of the window, each with the click that cancels it.
 *
 * The rows come from the `mie_prenotazioni` view, which pins them to the
 * caller inside the database: no filter in this file is what keeps another
 * person's booking out (§8.3). A booking whose fascia has already begun is
 * shown without its button, and the policy refuses it anyway.
 *
 * The green register is used twice, and only as an accent (§13.2): the
 * confirmation of a booking just made, and the empty state.
 */

type Proprieta = {
  searchParams: Promise<{ confermata?: string | string[]; annullata?: string | string[]; errore?: string | string[] }>;
};

const uno = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

/** A giornata intera is one entry, not two: it was asked for as one (§6.4). */
type Voce = { chiave: string; giornataIntera: boolean; righe: MiaPrenotazione[] };

function raggruppa(prenotazioni: MiaPrenotazione[]): Voce[] {
  const voci: Voce[] = [];
  for (const riga of prenotazioni) {
    const gruppo = riga.gruppoId
      ? voci.find((v) => v.chiave === riga.gruppoId && v.righe[0].data === riga.data)
      : undefined;
    if (gruppo) {
      gruppo.righe.push(riga);
      gruppo.giornataIntera = true;
    } else {
      voci.push({ chiave: riga.gruppoId ?? riga.id, giornataIntera: false, righe: [riga] });
    }
  }
  return voci;
}

function Annulla({
  etichetta,
  campo,
  valore,
}: {
  etichetta: string;
  campo: "prenotazione" | "gruppo";
  valore: string;
}) {
  return (
    <form action={annullaAzione}>
      <input type="hidden" name={campo} value={valore} />
      <button type="submit" className={bottoneDistruttivo}>
        {etichetta}
      </button>
    </form>
  );
}

function Prenotazione({ voce }: { voce: Voce }) {
  const t = m.prenotazioni;
  const prima = voce.righe[0];
  const annullabili = voce.righe.filter((r) => r.annullabile);

  return (
    <li className="border-b border-linea py-6">
      <h2 className="text-titolo-sezione font-grassetto">{dataEstesa(prima.data)}</h2>
      <p className="mt-2 font-grassetto">{prima.sedeNome}</p>
      <p className="text-testo-secondario">
        {prima.indirizzo ? `${prima.comune} · ${prima.indirizzo}` : prima.comune}
      </p>

      <ul className="mt-4">
        {voce.righe.map((riga) => (
          <li key={riga.id}>
            {m.disponibilita.fasce[riga.fascia]}{" "}
            <span className="text-testo-secondario">
              {orarioTesto(riga.oraInizio, riga.oraFine)}
            </span>
          </li>
        ))}
      </ul>
      {voce.giornataIntera && <p className="mt-2 text-nota">{t.giornataIntera}</p>}

      {/*
        The practical information of the sede (§5.2, D26). It is read here
        and not before booking, because here there is the booking that gives
        the right to read it, and it goes away with it. A block and not the
        small line it used to be: since D26 it can hold a door code or a
        Wi-Fi password, and those have to be legible one per line.
      */}
      {prima.note && (
        <section className="mt-6 border-t border-linea pt-4">
          <h3 className="font-grassetto">{t.note}</h3>
          <p className="mt-2 whitespace-pre-line">{prima.note}</p>
          <p className="mt-2 text-nota text-testo-secondario">{t.noteNota}</p>
        </section>
      )}

      {annullabili.length === 0 ? (
        <p className="mt-4 text-testo-secondario">{t.iniziata}</p>
      ) : (
        <div className="mt-4 flex flex-wrap items-center gap-4">
          {voce.giornataIntera && annullabili.length === voce.righe.length ? (
            <>
              <Annulla etichetta={t.annullaGiornata} campo="gruppo" valore={voce.chiave} />
              {voce.righe.map((riga) => (
                <Annulla
                  key={riga.id}
                  etichetta={t.annullaSolo[riga.fascia]}
                  campo="prenotazione"
                  valore={riga.id}
                />
              ))}
            </>
          ) : (
            annullabili.map((riga) => (
              <Annulla
                key={riga.id}
                etichetta={voce.giornataIntera ? t.annullaSolo[riga.fascia] : t.annulla}
                campo="prenotazione"
                valore={riga.id}
              />
            ))
          )}
        </div>
      )}
    </li>
  );
}

/**
 * The sedi a referente looks after — SPEC §4, §5.2, D26.
 *
 * A referente needs the keys and the Wi-Fi password of the space they look
 * after whether or not they booked a desk that day: booking one to read the
 * door code would be an absurd way in. The list comes from `sedi_referente`,
 * which is empty for everybody else, so there is no check in this file
 * deciding who sees the section (§8.3) — it simply does not appear.
 *
 * It lives here, at the foot of a person's own page, and not behind a new
 * address: this is already the page of the things that concern you, and the
 * panel is for the amministratore.
 */
function SediSeguite({ sedi }: { sedi: SedeSeguita[] }) {
  if (sedi.length === 0) return null;
  const t = m.prenotazioni.referente;

  return (
    <section className="mt-12 border-t border-linea pt-8">
      <h2 className="text-titolo-sezione font-grassetto">{t.titolo}</h2>
      <p className="mt-2 text-testo-secondario">{t.introduzione}</p>
      <ul className="mt-6 flex flex-col gap-8">
        {sedi.map((sede) => (
          <li key={sede.id}>
            <p className="font-grassetto">{sede.nome}</p>
            <p className="text-testo-secondario">
              {sede.indirizzo ? `${sede.comune} · ${sede.indirizzo}` : sede.comune}
            </p>
            {sede.note && <p className="mt-2 whitespace-pre-line">{sede.note}</p>}
          </li>
        ))}
      </ul>
    </section>
  );
}

export default async function PaginaPrenotazioni({ searchParams }: Proprieta) {
  const [utente, client, parametri] = await Promise.all([
    utenteAttuale(),
    clientServer(),
    searchParams,
  ]);
  if (!utente) redirect("/accedi");

  const [prenotazioni, seguite] = await Promise.all([
    miePrenotazioni(client),
    sediSeguite(client),
  ]);
  const voci = raggruppa(prenotazioni);

  const t = m.prenotazioni;
  const confermata = uno(parametri.confermata);
  const righeConfermate = prenotazioni.filter(
    (p) => confermata !== undefined && (p.id === confermata || p.gruppoId === confermata),
  );
  const appenaFatta = righeConfermate.length > 0;
  // A fascia already begun is booked all the same, but telling the person
  // they can cancel it would contradict the line right below (§6.4).
  const ancoraAnnullabile = righeConfermate.some((p) => p.annullabile);
  const errore = uno(parametri.errore);
  const annullata = uno(parametri.annullata) !== undefined;

  return (
    <>
      <h1 className="text-titolo-pagina font-grassetto grande:text-titolo-pagina-grande">
        {t.titolo}
      </h1>

      {appenaFatta && (
        <section className="mt-6 bg-verde px-6 py-8 text-testo">
          <h2 className="text-titolo-sezione font-grassetto">{t.confermata.titolo}</h2>
          <p className="mt-4">
            {t.confermata.testo}
            {ancoraAnnullabile ? ` ${t.confermata.annullabile}` : ""}
          </p>
        </section>
      )}

      {annullata && (
        <p role="status" className="mt-6">
          {t.annullata}
        </p>
      )}

      {errore && (
        <p role="alert" className="mt-6 text-errore">
          {errore === "tardi" ? t.errori.tardi : t.errori.generico}
        </p>
      )}

      {voci.length === 0 ? (
        <section className="mt-8 bg-verde px-6 py-8 text-testo">
          <h2 className="text-titolo-sezione font-grassetto">{t.vuoto.titolo}</h2>
          <p className="mt-4">{t.vuoto.testo}</p>
          <p className="mt-4">
            {/* On verde a link is `testo`: verde-testo on verde is 2.6:1 (§13.7). */}
            <Link href="/" className="text-testo">
              {t.vuoto.collegamento}
            </Link>
          </p>
        </section>
      ) : (
        <>
          <p className="mt-6 italic">{t.introduzione}</p>
          <ul className="mt-4 border-t border-linea">
            {voci.map((voce) => (
              <Prenotazione key={voce.chiave} voce={voce} />
            ))}
          </ul>
          <p className="mt-8">
            <Link href="/">{t.vuoto.collegamento}</Link>
          </p>
        </>
      )}

      <SediSeguite sedi={seguite} />
    </>
  );
}
