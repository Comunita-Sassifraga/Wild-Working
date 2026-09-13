import Link from "next/link";
import { redirect } from "next/navigation";
import { bottonePrimario, bottoneSecondario } from "@/components/controlli";
import { utenteAttuale } from "@/lib/auth/sessione";
import { dataEstesa } from "@/lib/dates";
import { disponibilitaPubblica, noteSede, sediPubbliche } from "@/lib/db/disponibilita";
import { FASCE, type Fascia } from "@/lib/db/prenotazioni";
import { clientServer } from "@/lib/db/server";
import { orarioDi, statoCella } from "@/lib/disponibilita";
import { conValori, m } from "@/lib/messaggi";
import { prenotaAzione } from "./azioni";

/**
 * Booking — SPEC §6.3, §12 step 5.
 *
 * What the availability grid points at: one sede, one day, one fascia, read
 * back from the database and shown before anything is written. The choice
 * travels in the address, so the page is a plain server-rendered one and the
 * flow works with JavaScript switched off.
 *
 * An address that asks for a slot nobody can book goes back to the
 * availability page, the way §6.2 asks for an impossible day. A slot that is
 * open but full still opens: someone arriving from a page loaded a minute ago
 * deserves to read why, not to be bounced.
 *
 * The page shows what is free; whether the booking can happen is decided at
 * write time by the database (§8.4).
 */

type Proprieta = {
  searchParams: Promise<{ sede?: string | string[]; data?: string | string[]; fascia?: string | string[]; errore?: string | string[] }>;
};

const uno = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

function Riga({ etichetta, children }: { etichetta: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-wrap gap-x-6 gap-y-1 border-b border-linea py-3">
      <dt className="w-24 text-testo-secondario">{etichetta}</dt>
      <dd className="font-grassetto">{children}</dd>
    </div>
  );
}

export default async function PaginaPrenota({ searchParams }: Proprieta) {
  const [utente, client, parametri] = await Promise.all([
    utenteAttuale(),
    clientServer(),
    searchParams,
  ]);

  const sedeId = uno(parametri.sede) ?? "";
  const data = uno(parametri.data) ?? "";
  const fascia = (uno(parametri.fascia) ?? "") as Fascia;
  if (!sedeId || !data || !FASCE.includes(fascia)) redirect("/");

  const [sedi, celle] = await Promise.all([sediPubbliche(client), disponibilitaPubblica(client)]);
  const sede = sedi.find((s) => s.id === sedeId);
  const cella = celle.find((c) => c.sedeId === sedeId && c.data === data && c.fascia === fascia);
  // The availability page validates the day it is given, so sending the day
  // along is enough: a day that does not hold up falls back from there.
  if (!sede || !cella || !cella.prenotabile) redirect(`/?data=${data}`);

  const note = utente ? await noteSede(client, sedeId) : null;
  const altra = FASCE.find((f) => f !== fascia) as Fascia;
  const cellaAltra = celle.find(
    (c) => c.sedeId === sedeId && c.data === data && c.fascia === altra,
  );
  const giornataPossibile =
    cella.liberi > 0 && (cellaAltra?.prenotabile ?? false) && (cellaAltra?.liberi ?? 0) > 0;

  const t = m.prenota;
  const md = m.disponibilita;
  const stato = statoCella(cella);
  const errore = uno(parametri.errore);
  const avviso =
    errore && errore in t.errori ? t.errori[errore as keyof typeof t.errori] : null;

  return (
    <>
      <h1 className="text-titolo-pagina font-grassetto grande:text-titolo-pagina-grande">
        {t.titolo}
      </h1>
      <p className="mt-6 italic">{t.introduzione}</p>

      {avviso && (
        <p role="alert" className="mt-6 text-errore">
          {avviso}
        </p>
      )}

      <dl className="mt-8 border-t border-linea">
        <Riga etichetta={t.sede}>
          {sede.nome}
          <span className="block font-regolare text-testo-secondario">
            {sede.indirizzo ? `${sede.comune} · ${sede.indirizzo}` : sede.comune}
          </span>
        </Riga>
        <Riga etichetta={t.giorno}>{dataEstesa(data)}</Riga>
        <Riga etichetta={t.fascia}>
          {md.fasce[fascia]}
          <span className="block font-regolare text-testo-secondario">
            {orarioDi(sede, fascia)}
          </span>
        </Riga>
        <Riga etichetta={t.posti}>
          {cella.liberi === 1
            ? conValori(t.unLibero, { capienza: cella.capienza })
            : conValori(t.postiLiberi, { liberi: cella.liberi, capienza: cella.capienza })}
          {stato === "ESAURITA" && (
            <span className="block font-regolare text-errore">{md.celle.esaurito}</span>
          )}
          {stato === "ULTIMI" && (
            <span className="block font-regolare text-avviso">
              {cella.liberi === 1
                ? md.celle.ultimi
                : conValori(md.celle.ultimiAlPlurale, { liberi: cella.liberi })}
            </span>
          )}
        </Riga>
      </dl>

      {note && (
        <section className="mt-8">
          <h2 className="text-titolo-sezione font-grassetto">{t.note}</h2>
          <p className="mt-2 whitespace-pre-line">{note}</p>
        </section>
      )}

      {utente ? (
        cella.liberi > 0 && (
          <form action={prenotaAzione} className="mt-8 flex flex-col items-start gap-4">
            <input type="hidden" name="sede" value={sede.id} />
            <input type="hidden" name="data" value={data} />
            <input type="hidden" name="fascia" value={fascia} />
            <button type="submit" className={bottonePrimario}>
              {t.prenota}
            </button>
            {giornataPossibile && (
              <>
                <button
                  type="submit"
                  name="giornata"
                  value="si"
                  className={bottoneSecondario}
                >
                  {t.giornata}
                </button>
                <p className="text-nota text-testo-secondario">{t.giornataNota}</p>
              </>
            )}
          </form>
        )
      ) : (
        <p className="mt-8">
          {t.entra} <Link href="/accedi">{m.home.entra}</Link>
        </p>
      )}

      <p className="mt-8">
        <Link href={`/?data=${data}`}>{t.torna}</Link>
      </p>
    </>
  );
}
