import Link from "next/link";
import { notFound } from "next/navigation";
import { bottonePrimario, bottoneSecondario } from "@/components/controlli";
import { ora } from "@/lib/dates";
import { attivitaSingola, type Attivita } from "@/lib/db/attivita";
import { conValori, m } from "@/lib/messaggi";
import { amministratore } from "../../guardia";
import { uno, type Parametri } from "../../parametri";
import {
  AreaTesto,
  Campo,
  Messaggio,
  Sezione,
  aiuto,
  introduzione,
  titoloPagina,
} from "../../parti";
import { salvaAttivitaAzione } from "./azioni";

/**
 * One activity — SPEC §15.3.2, §15.9 second bullet.
 *
 * The form is grouped by visibility level (§15.8), and each group says who
 * will see it. That is not decoration: whoever types a telephone number into
 * this screen is typing a third party's personal data, and has to know while
 * they are typing it where it is going to end up. It is the same reason the
 * paper notice given to the abitante lists the three levels.
 *
 * Nothing here is required. A card is saved half-done and finished the next
 * day (§15.3.2, decision of 2026-09-12): 25 of them are copied out of emails
 * and scattered notes in one evening, and a form that refuses to save what
 * somebody has in hand makes that evening impossible. What is still missing
 * is said out loud instead — on the row in the list, and again before
 * publishing (§15.9).
 *
 * Publishing is not on this page. It is its own screen, because ticking the
 * consent box is something you sign, not a field at the bottom of a long form.
 */

const t = m.amministrazione.attivita;

function Gruppo({
  titolo,
  chiLoVede,
  children,
}: {
  titolo: string;
  chiLoVede: string;
  children: React.ReactNode;
}) {
  return (
    <Sezione titolo={titolo}>
      <p className={aiuto}>{chiLoVede}</p>
      {children}
    </Sezione>
  );
}

function Stato({ attivita }: { attivita: Attivita }) {
  const parole: Record<string, string> = {
    BOZZA: t.scheda.statoBozza,
    PUBBLICATA: t.scheda.statoPubblicata,
    ANNULLATA: t.scheda.statoAnnullata,
  };
  const iscritti = attivita.iscritti ?? 0;
  return (
    <p className={introduzione}>
      {parole[attivita.stato ?? "BOZZA"]}
      {iscritti > 0 ? ` ${conValori(t.scheda.iscritti, { quanti: iscritti })}.` : ""}
    </p>
  );
}

export default async function PaginaAttivitaSingola({
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
  const attivita = await attivitaSingola(client, id);
  if (!attivita) notFound();

  const errori: Record<string, string> = m.amministrazione.errori;
  const errore = uno(parametri.errore);
  const salvato = uno(parametri.salvato);
  const conferme: Record<string, string> = {
    creata: t.crea.creata,
    salvata: t.scheda.salvata,
  };

  return (
    <>
      <h1 className={titoloPagina}>{attivita.titolo || t.senzaTitolo}</h1>
      <Stato attivita={attivita} />

      {salvato && conferme[salvato] && <Messaggio testo={conferme[salvato]} />}
      {errore && <Messaggio testo={errori[errore] ?? errori.ERRORE} errore />}

      <form action={salvaAttivitaAzione}>
        <input type="hidden" name="attivita" value={attivita.id ?? ""} />

        <Gruppo titolo={t.scheda.livello1.titolo} chiLoVede={t.scheda.livello1.chiLoVede}>
          <Campo nome="titolo" testo={t.campi.titolo} valore={attivita.titolo} massimo={80} />
          {/* The abitante's own words, transcribed as they are. Never
              rewritten, summarised or truncated (rule 26). */}
          <AreaTesto
            nome="descrizione"
            testo={t.campi.descrizione}
            valore={attivita.descrizione}
            nota={t.note.descrizione}
            massimo={4000}
            righe={10}
          />
          <Campo
            nome="abitante_nome"
            testo={t.campi.abitante_nome}
            valore={attivita.abitante_nome}
            nota={t.note.abitante_nome}
            massimo={40}
          />
          <Campo
            nome="luogo_generico"
            testo={t.campi.luogo_generico}
            valore={attivita.luogo_generico}
            nota={t.note.luogo_generico}
            massimo={120}
          />
          <Campo
            nome="data"
            testo={t.campi.data}
            tipo="date"
            valore={attivita.data}
            nota={t.note.data}
          />
          <Campo
            nome="ora_inizio"
            testo={t.campi.ora_inizio}
            tipo="time"
            valore={attivita.ora_inizio ? ora(attivita.ora_inizio) : null}
          />
          <Campo
            nome="ora_fine"
            testo={t.campi.ora_fine}
            tipo="time"
            valore={attivita.ora_fine ? ora(attivita.ora_fine) : null}
          />
          <Campo
            nome="capienza"
            testo={t.campi.capienza}
            tipo="number"
            minimo={1}
            valore={attivita.capienza}
            nota={t.note.capienza}
          />
          <AreaTesto
            nome="cosa_portare"
            testo={t.campi.cosa_portare}
            valore={attivita.cosa_portare}
            nota={t.note.cosa_portare}
            massimo={300}
          />
          <Campo
            nome="lingua_attivita"
            testo={t.campi.lingua_attivita}
            valore={attivita.lingua_attivita}
            nota={t.note.lingua_attivita}
            massimo={60}
          />
        </Gruppo>

        <Gruppo titolo={t.scheda.livello2.titolo} chiLoVede={t.scheda.livello2.chiLoVede}>
          <Campo
            nome="abitante_cognome"
            testo={t.campi.abitante_cognome}
            valore={attivita.abitante_cognome}
            massimo={60}
          />
          <Campo
            nome="abitante_telefono"
            testo={t.campi.abitante_telefono}
            valore={attivita.abitante_telefono}
            nota={t.note.abitante_telefono}
            massimo={30}
          />
          <Campo
            nome="luogo_esatto"
            testo={t.campi.luogo_esatto}
            valore={attivita.luogo_esatto}
            nota={t.note.luogo_esatto}
            massimo={200}
          />
        </Gruppo>

        <Gruppo titolo={t.scheda.livello3.titolo} chiLoVede={t.scheda.livello3.chiLoVede}>
          <AreaTesto
            nome="abitante_note_interne"
            testo={t.campi.abitante_note_interne}
            valore={attivita.abitante_note_interne}
            nota={t.note.abitante_note_interne}
            massimo={300}
          />
        </Gruppo>

        <p className="mt-10">
          <button type="submit" className={bottonePrimario}>
            {t.scheda.salva}
          </button>
        </p>
      </form>

      {/* Publishing, withdrawing and calling off all live on the next screen:
          each of them needs the card read through, not glanced at. */}
      <p className="mt-10">
        <Link href={`/amministrazione/attivita/${attivita.id}/pubblica`} className={bottoneSecondario}>
          {t.scheda.vaiAPubblica}
        </Link>
      </p>

      {/* Who is coming, and the two actions that close a swap of places
          (§15.9). Its own screen too: this one is about the abitante, that
          one is about the participants. */}
      <p className="mt-10">
        <Link href={`/amministrazione/attivita/${attivita.id}/iscritti`}>
          {t.iscritti.apri}
        </Link>
      </p>

      <p className="mt-10">
        <Link href="/amministrazione/attivita">{t.scheda.torna}</Link>
      </p>
    </>
  );
}
