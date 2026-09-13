import Link from "next/link";
import { redirect } from "next/navigation";
import { bottoneDistruttivo } from "@/components/controlli";
import { utenteAttuale } from "@/lib/auth/sessione";
import { dataEstesa, oggiRoma, ora } from "@/lib/dates";
import { sonoAbilitato } from "@/lib/db/abitanti";
import { mieAttivita, type AttivitaElencata } from "@/lib/db/iscrizioni";
import { miePrenotazioni, type MiaPrenotazione } from "@/lib/db/prenotazioni";
import { clientServer } from "@/lib/db/server";
import { orarioTesto } from "@/lib/disponibilita";
import { conValori, m } from "@/lib/messaggi";
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
 *
 * Since step 20 the page has two sections, postazioni and attività (§15.6).
 * One page and not two: a resident has one week to organise, not two diaries.
 * The second section is drawn for whoever holds an abilitazione, and for
 * whoever holds a place even without one — §15.12 keeps an iscrizione
 * already taken visible to its holder through a deactivated edition and a
 * revoked abilitazione (agreed 2026-09-13, written into §15.6). For everybody
 * else the page is exactly what it was: no second heading appears above a
 * section that is not there.
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

      {prima.note && (
        <p className="mt-4 text-nota text-testo-secondario">
          <span className="font-grassetto">{t.note}: </span>
          {prima.note}
        </p>
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
 * One place on an activity — SPEC §15.6, second section.
 *
 * The heading of the elenco and nothing more: what to bring, the description
 * and the recapiti of whoever is hosting are on the activity itself, which
 * is also where one gives the place up (§15.7). Repeating a telephone number
 * on a page nobody opened to read it would spread a third party's data for
 * no reason (rule 24).
 */
function Attivita({ attivita }: { attivita: AttivitaElencata }) {
  const t = m.prenotazioni.attivita;
  return (
    <li className="border-b border-linea py-6">
      <h3 className="text-titolo-sezione font-grassetto">
        <Link href={`/abitanti/${attivita.id}`}>{attivita.titolo}</Link>
      </h3>

      {attivita.abitanteNome && (
        <p className="mt-2">
          {conValori(m.abitanti.attivita.proposta, { nome: attivita.abitanteNome })}
        </p>
      )}

      <p className="mt-2 text-testo-secondario">
        {attivita.data && dataEstesa(attivita.data)}
        {attivita.oraInizio && ` · ${conValori(t.quando, { orario: ora(attivita.oraInizio) })}`}
        {attivita.luogoGenerico && ` · ${attivita.luogoGenerico}`}
      </p>

      {/* Colour never carries this on its own (rule 14): the word says it. */}
      {!attivita.ancoraAperta && <p className="mt-2">{t.cominciata}</p>}

      <p className="mt-4">
        <Link href={`/abitanti/${attivita.id}`}>{t.apri}</Link>
      </p>
    </li>
  );
}

export default async function PaginaPrenotazioni({ searchParams }: Proprieta) {
  const [utente, client, parametri] = await Promise.all([
    utenteAttuale(),
    clientServer(),
    searchParams,
  ]);
  if (!utente) redirect("/accedi");

  const [prenotazioni, attivita, abilitato] = await Promise.all([
    miePrenotazioni(client),
    mieAttivita(client, oggiRoma()),
    sonoAbilitato(client),
  ]);
  const voci = raggruppa(prenotazioni);
  const conAttivita = abilitato || attivita.length > 0;

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

      {/* The headings appear only when there really are two sections: for
          somebody who has nothing to do with the module the page is
          unchanged (§15.6). */}
      {conAttivita && (
        <h2 className="mt-10 text-titolo-sezione font-grassetto">{t.sezionePostazioni}</h2>
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
        </>
      )}

      {conAttivita && (
        <>
          <h2 className="mt-10 text-titolo-sezione font-grassetto">{t.sezioneAttivita}</h2>
          {attivita.length === 0 ? (
            <>
              <p className="mt-6">{t.attivita.vuoto}</p>
              <p className="mt-4">
                <Link href="/abitanti">{t.attivita.vedi}</Link>
              </p>
            </>
          ) : (
            <>
              <p className="mt-6 italic">{t.attivita.introduzione}</p>
              <ul className="mt-4 border-t border-linea">
                {attivita.map((riga) => (
                  <Attivita key={riga.id} attivita={riga} />
                ))}
              </ul>
            </>
          )}
        </>
      )}

      {voci.length > 0 && (
        <p className="mt-8">
          <Link href="/">{t.vuoto.collegamento}</Link>
        </p>
      )}
    </>
  );
}
