import Link from "next/link";
import { notFound } from "next/navigation";
import { bottoneDistruttivo, bottonePrimario, bottoneSecondario } from "@/components/controlli";
import { dataBreve } from "@/lib/dates";
import {
  chiusureSede,
  GIORNI_SETTIMANA,
  periodiSede,
  prenotazioniDaVerificare,
  sedeSingola,
  type Chiusura,
  type Periodo,
  type Sede,
} from "@/lib/db/amministrazione";
import { FASCE } from "@/lib/db/prenotazioni";
import { posizioneDaColonna, testoDaPosizione } from "@/lib/mappa";
import { m } from "@/lib/messaggi";
import { amministratore } from "../../guardia";
import { uno, type Parametri } from "../../parametri";
import {
  AreaTesto,
  Avvertenza,
  Campo,
  Elenco,
  Messaggio,
  Riga,
  Scelta,
  Sezione,
  Spunta,
  Vuoto,
  aiuto,
  etichetta,
  titoloPagina,
} from "../../parti";
import {
  creaChiusuraAzione,
  creaPeriodoAzione,
  eliminaChiusuraAzione,
  eliminaPeriodoAzione,
  eliminaSedeAzione,
  salvaSedeAzione,
} from "./azioni";

/**
 * One sede, all of it on one page — SPEC §6.7.
 *
 * Data, periodi and chiusure sit together because they answer one question:
 * when is this place open. Splitting them across three screens would make
 * "far comparire o scomparire una sede" a tour instead of the minute §6.7
 * asks for.
 *
 * The last section is the one that matters most: the bookings this sede's
 * settings have left behind (§8.2, §8.4). It is a list to read and act on,
 * never a list with a button that cancels — nothing in this app cancels
 * somebody else's booking (rule 6).
 */

const t = m.amministrazione;

/** The saved position as the field shows it back, or an empty field (§6.2). */
function posizioneScritta(coordinate: unknown): string {
  const posizione = posizioneDaColonna(coordinate);
  return posizione ? testoDaPosizione(posizione) : "";
}

/** A hidden field so every form on this page says which sede it is about. */
function Sede({ id }: { id: string }) {
  return <input type="hidden" name="sede" value={id} />;
}

function DatiSede({ sede }: { sede: Sede }) {
  const giorniTesti = m.disponibilita.calendario.giorniSettimana;
  return (
    <form action={salvaSedeAzione}>
      <Sede id={sede.id} />
      <Campo nome="nome" testo={t.sede.nome} valore={sede.nome} richiesto />
      <Campo nome="comune" testo={t.sede.comune} valore={sede.comune} richiesto />
      <Campo nome="indirizzo" testo={t.sede.indirizzo} valore={sede.indirizzo} />
      {/* Latitude first, the way a person reads and writes them; the column
          keeps them the other way round, which is Postgres's business. */}
      <Campo
        nome="posizione"
        testo={t.sede.posizione}
        valore={posizioneScritta(sede.coordinate)}
        nota={t.sede.posizioneNota}
      />
      <Campo
        nome="capienza"
        testo={t.sede.capienza}
        tipo="number"
        minimo={0}
        valore={sede.capienza}
        nota={t.sede.capienzaNota}
        richiesto
      />

      <h3 className="mt-10 font-grassetto">{t.sede.orari}</h3>
      <p className={aiuto}>{t.sede.orariNota}</p>
      <Campo
        nome="ora_inizio_mattina"
        testo={t.sede.inizioMattina}
        tipo="time"
        valore={sede.ora_inizio_mattina}
        richiesto
      />
      <Campo
        nome="ora_fine_mattina"
        testo={t.sede.fineMattina}
        tipo="time"
        valore={sede.ora_fine_mattina}
        richiesto
      />
      <Campo
        nome="ora_inizio_pomeriggio"
        testo={t.sede.inizioPomeriggio}
        tipo="time"
        valore={sede.ora_inizio_pomeriggio}
        richiesto
      />
      <Campo
        nome="ora_fine_pomeriggio"
        testo={t.sede.finePomeriggio}
        tipo="time"
        valore={sede.ora_fine_pomeriggio}
        richiesto
      />

      <fieldset className="mt-10">
        <legend className={etichetta}>{t.sede.giorni}</legend>
        {GIORNI_SETTIMANA.map((giorno, i) => (
          <Spunta
            key={giorno}
            nome="giorni"
            valore={giorno}
            testo={giorniTesti[i]}
            acceso={sede.giorni_apertura.includes(giorno)}
          />
        ))}
      </fieldset>

      <AreaTesto nome="note" testo={t.sede.note} valore={sede.note} nota={t.sede.noteNota} />

      <Spunta nome="attiva" testo={t.sede.attiva} acceso={sede.attiva} nota={t.sede.attivaNota} />
      <Spunta
        nome="sempre_disponibile"
        testo={t.sede.sempreDisponibile}
        acceso={sede.sempre_disponibile}
        nota={t.sede.sempreDisponibileNota}
      />

      <p className="mt-8">
        <button type="submit" className={bottonePrimario}>
          {t.sede.salva}
        </button>
      </p>
    </form>
  );
}

function Periodi({ sede, periodi }: { sede: Sede; periodi: Periodo[] }) {
  return (
    <Sezione titolo={t.periodi.titolo}>
      <p className="mt-4">{t.periodi.introduzione}</p>
      {sede.sempre_disponibile ? (
        <p className={aiuto}>{t.periodi.nonServono}</p>
      ) : (
        // §5.7: "L'interfaccia deve avvisare l'amministratore di questa
        // situazione, che quasi sempre è un errore."
        periodi.length === 0 && <Avvertenza testo={t.periodi.senzaPeriodi} />
      )}

      {periodi.length === 0 ? (
        <Vuoto testo={t.periodi.vuoto} />
      ) : (
        <Elenco>
          {periodi.map((p) => (
            <Riga key={p.id}>
              <span className="font-grassetto">{p.etichetta}</span>
              <span className={`${aiuto} block`}>
                {dataBreve(p.data_inizio)} – {dataBreve(p.data_fine)}
                {p.ricorre_ogni_anno ? ` · ${t.periodi.ogniAnno}` : ""}
              </span>
              <form action={eliminaPeriodoAzione} className="mt-2">
                <Sede id={sede.id} />
                <input type="hidden" name="periodo" value={p.id} />
                <button type="submit" className={bottoneDistruttivo}>
                  {t.periodi.elimina}
                </button>
              </form>
            </Riga>
          ))}
        </Elenco>
      )}

      <form action={creaPeriodoAzione} className="mt-6">
        <Sede id={sede.id} />
        <Campo
          nome="etichetta"
          testo={t.periodi.etichetta}
          nota={t.periodi.etichettaNota}
          richiesto
        />
        <Campo nome="data_inizio" testo={t.periodi.dal} tipo="date" richiesto />
        <Campo nome="data_fine" testo={t.periodi.al} tipo="date" richiesto />
        <Spunta
          nome="ricorre_ogni_anno"
          testo={t.periodi.ricorre}
          nota={t.periodi.ricorreNota}
        />
        <p className="mt-6">
          <button type="submit" className={bottoneSecondario}>
            {t.periodi.aggiungi}
          </button>
        </p>
      </form>
    </Sezione>
  );
}

function Chiusure({ sede, chiusure }: { sede: Sede; chiusure: Chiusura[] }) {
  const fasce = m.disponibilita.fasce;
  return (
    <Sezione titolo={t.chiusure.titolo}>
      <p className="mt-4">{t.chiusure.introduzione}</p>

      {chiusure.length === 0 ? (
        <Vuoto testo={t.chiusure.vuoto} />
      ) : (
        <Elenco>
          {chiusure.map((c) => (
            <Riga key={c.id}>
              <span className="font-grassetto">
                {dataBreve(c.data_inizio)} – {dataBreve(c.data_fine)}
              </span>
              <span className={`${aiuto} block`}>
                {c.fascia ? fasce[c.fascia] : t.chiusure.tutte}
              </span>
              <form action={eliminaChiusuraAzione} className="mt-2">
                <Sede id={sede.id} />
                <input type="hidden" name="chiusura" value={c.id} />
                <button type="submit" className={bottoneDistruttivo}>
                  {t.chiusure.elimina}
                </button>
              </form>
            </Riga>
          ))}
        </Elenco>
      )}

      <form action={creaChiusuraAzione} className="mt-6">
        <Sede id={sede.id} />
        <Campo nome="data_inizio" testo={t.chiusure.dal} tipo="date" richiesto />
        <Campo nome="data_fine" testo={t.chiusure.al} tipo="date" richiesto />
        <Scelta
          nome="fascia"
          testo={t.chiusure.fascia}
          opzioni={[
            { valore: "", testo: t.chiusure.tutte },
            ...FASCE.map((f) => ({ valore: f, testo: fasce[f] })),
          ]}
        />
        <p className="mt-6">
          <button type="submit" className={bottoneSecondario}>
            {t.chiusure.aggiungi}
          </button>
        </p>
      </form>
    </Sezione>
  );
}

export default async function PaginaSede({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Parametri>;
}) {
  const [{ client }, { id }, parametri] = await Promise.all([
    amministratore(),
    params,
    searchParams,
  ]);

  const sede = await sedeSingola(client, id);
  if (!sede) notFound();

  const [periodi, chiusure, daVerificare] = await Promise.all([
    periodiSede(client, id),
    chiusureSede(client, id),
    prenotazioniDaVerificare(client, id),
  ]);

  const errori: Record<string, string> = t.errori;
  const errore = uno(parametri.errore);
  const salvato = uno(parametri.salvato);
  const fasce = m.disponibilita.fasce;

  return (
    <>
      <h1 className={titoloPagina}>{sede.nome}</h1>
      {salvato && (
        <Messaggio testo={salvato === "creata" ? t.sede.creata : t.sede.salvata} />
      )}
      {errore && <Messaggio testo={errori[errore] ?? t.errori.ERRORE} errore />}

      <Sezione titolo={t.sede.dati}>
        <DatiSede sede={sede} />
      </Sezione>

      <Periodi sede={sede} periodi={periodi} />
      <Chiusure sede={sede} chiusure={chiusure} />

      <Sezione titolo={t.daVerificare.titolo}>
        {daVerificare.length === 0 ? (
          <Vuoto testo={t.daVerificare.nessuna} />
        ) : (
          <>
            <p className="mt-4">{t.daVerificare.introduzione}</p>
            <Elenco>
              {daVerificare.map((p) => (
                <Riga key={p.id}>
                  <span className="font-grassetto">
                    {dataBreve(p.data)} · {fasce[p.fascia]}
                  </span>
                  <span className={`${aiuto} block`}>{t.daVerificare.motivi[p.motivo]}</span>
                  {p.email ? (
                    <span className="mt-1 block">
                      {t.daVerificare.scriviA} <a href={`mailto:${p.email}`}>{p.email}</a>
                    </span>
                  ) : (
                    <span className={`${aiuto} block`}>{t.daVerificare.senzaIndirizzo}</span>
                  )}
                </Riga>
              ))}
            </Elenco>
          </>
        )}
      </Sezione>

      {/* Deleting is asked twice: the first click only shows the question.
          The database refuses anyway while a booking still points here. */}
      <Sezione titolo={t.sede.elimina.titolo}>
        <p className="mt-4">{t.sede.elimina.nota}</p>
        {uno(parametri.elimina) ? (
          <form action={eliminaSedeAzione} className="mt-6 flex flex-wrap items-center gap-4">
            <Sede id={sede.id} />
            <button type="submit" className={bottoneDistruttivo}>
              {t.sede.elimina.pulsante}
            </button>
            <Link href={`/amministrazione/sedi/${sede.id}`} className={bottoneSecondario}>
              {t.moderazione.scheda.confermaNo}
            </Link>
          </form>
        ) : (
          <p className="mt-6">
            <Link href={`/amministrazione/sedi/${sede.id}?elimina=1`} className={bottoneDistruttivo}>
              {t.sede.elimina.pulsante}
            </Link>
          </p>
        )}
      </Sezione>

      <p className="mt-10">
        <Link href="/amministrazione/sedi">{t.sedi.titolo}</Link>
      </p>
    </>
  );
}
