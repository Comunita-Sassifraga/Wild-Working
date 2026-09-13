import Link from "next/link";
import { bottonePrimario } from "@/components/controlli";
import { dataBreve, ora, oggiRoma } from "@/lib/dates";
import { attivitaEdizione, campiMancanti, type Attivita, type StatoAttivita } from "@/lib/db/attivita";
import { edizioniTutte, type Edizione } from "@/lib/db/abitanti";
import { conValori, m } from "@/lib/messaggi";
import { amministratore } from "../guardia";
import { uno, type Parametri } from "../parametri";
import {
  Avvertenza,
  Campo,
  Elenco,
  Messaggio,
  Riga,
  Scelta,
  Sezione,
  Vuoto,
  aiuto,
  introduzione,
  titoloPagina,
} from "../parti";
import { creaAttivitaAzione } from "./azioni";

/**
 * Attività — SPEC §15.3.2, §15.9 second bullet.
 *
 * The list of one edition's cards, in three groups: what is still a draft,
 * what is published, what was called off. Three groups and not one list,
 * because the only question this screen answers in a hurry is "what is left
 * to do" — and that is the first group.
 *
 * The edition is chosen here rather than taken from `edizione_attiva()`. That
 * function answers "is the module open to participants today", which is a
 * different question: the 25 cards are typed in during the weeks BEFORE an
 * edition opens, when its dates are still ahead and that function says
 * nothing at all. Agreed into §15.9 on 2026-09-12.
 */

const t = m.amministrazione.attivita;

const GRUPPI: StatoAttivita[] = ["BOZZA", "PUBBLICATA", "ANNULLATA"];

function Voce({ attivita }: { attivita: Attivita }) {
  const mancanti = campiMancanti(attivita);
  const campi: Record<string, string> = t.campi;

  return (
    <Riga>
      <Link href={`/amministrazione/attivita/${attivita.id}`} className="font-grassetto">
        {attivita.titolo || t.senzaTitolo}
      </Link>

      <span className={`${aiuto} block`}>
        {attivita.data && attivita.ora_inizio && attivita.ora_fine
          ? conValori(t.quando, {
              giorno: dataBreve(attivita.data),
              inizio: ora(attivita.ora_inizio),
              fine: ora(attivita.ora_fine),
            })
          : t.senzaGiorno}
        {attivita.abitante_nome ? ` · ${attivita.abitante_nome}` : ""}
        {attivita.luogo_generico ? ` · ${attivita.luogo_generico}` : ""}
      </span>

      <span className={`${aiuto} block`}>
        {attivita.capienza
          ? conValori(t.posti, {
              iscritti: attivita.iscritti ?? 0,
              capienza: attivita.capienza,
            })
          : t.senzaPosti}
      </span>

      {/* What is still empty, said on the row rather than only on the publish
          screen: a card is finished over several sittings (§15.3.2), and the
          list is where somebody decides which one to open next. */}
      {mancanti.length > 0 && (
        <span className={`${aiuto} block`}>
          {conValori(t.daFinire, {
            campi: mancanti.map((c) => campi[c] ?? c).join(", "),
          })}
        </span>
      )}
    </Riga>
  );
}

export default async function PaginaAttivita({
  searchParams,
}: {
  searchParams: Promise<Parametri>;
}) {
  const [{ client }, parametri] = await Promise.all([amministratore(), searchParams]);
  const edizioni = await edizioniTutte(client);

  // The edition with the switch on, whatever its dates say; failing that the
  // most recent one, which is the one somebody creating a programme has just
  // made. A request may name another.
  const chiesta = uno(parametri.edizione);
  const scelta: Edizione | undefined =
    edizioni.find((e) => e.id === chiesta) ?? edizioni.find((e) => e.attiva) ?? edizioni[0];

  const attivita = scelta ? await attivitaEdizione(client, scelta.id) : [];

  const errori: Record<string, string> = m.amministrazione.errori;
  const errore = uno(parametri.errore);
  const salvato = uno(parametri.salvato);

  // Cancelling says how many people have just lost a place. Since step 19 they
  // have been told by the email of §15.10; the count is here because whoever
  // pressed the button is entitled to know what their press did (§15.12).
  const persone = Number(uno(parametri.iscritti) ?? 0);
  const annullata =
    persone === 0
      ? t.annulla.annullata
      : persone === 1
        ? t.annulla.annullataConUnIscritto
        : conValori(t.annulla.annullataConIscritti, { quanti: persone });

  const conferme: Record<string, string> = {
    salvata: t.scheda.salvata,
    ritirata: t.ritira.ritirata,
    annullata,
    pubblicata: t.pubblica.pubblicata,
  };

  return (
    <>
      <h1 className={titoloPagina}>{t.titolo}</h1>
      <p className={introduzione}>{t.introduzione}</p>

      {salvato && conferme[salvato] && <Messaggio testo={conferme[salvato]} />}
      {errore && <Messaggio testo={errori[errore] ?? errori.ERRORE} errore />}

      {!scelta ? (
        <Vuoto testo={t.senzaEdizione} />
      ) : (
        <>
          {/* No JavaScript: the menu picks, the button fetches. The panel
              works the same way everywhere else. */}
          <form method="get">
            <Scelta
              nome="edizione"
              testo={t.scegliEdizione}
              valore={scelta.id}
              opzioni={edizioni.map((e) => ({ valore: e.id, testo: e.nome }))}
            />
            <p className="mt-4">
              <button type="submit" className={bottonePrimario}>
                {t.mostra}
              </button>
            </p>
          </form>

          {scelta.data_inizio > oggiRoma() && <Avvertenza testo={t.nonCominciata} />}

          {attivita.length === 0 ? (
            <Vuoto testo={t.vuoto} />
          ) : (
            GRUPPI.map((stato) => {
              const gruppo = attivita.filter((a) => a.stato === stato);
              return (
                <Sezione key={stato} titolo={t.gruppi[stato]}>
                  {gruppo.length === 0 ? (
                    <Vuoto testo={t.nessunaIn} />
                  ) : (
                    <Elenco>
                      {gruppo.map((a) => (
                        <Voce key={a.id} attivita={a} />
                      ))}
                    </Elenco>
                  )}
                </Sezione>
              );
            })
          )}

          <Sezione titolo={t.crea.titolo}>
            <form action={creaAttivitaAzione}>
              <input type="hidden" name="edizione" value={scelta.id} />
              <Campo nome="titolo" testo={t.crea.campo} nota={t.crea.nota} massimo={80} />
              <p className="mt-6">
                <button type="submit" className={bottonePrimario}>
                  {t.crea.pulsante}
                </button>
              </p>
            </form>
          </Sezione>
        </>
      )}

      <p className="mt-10">
        <Link href="/amministrazione">{m.amministrazione.torna}</Link>
      </p>
    </>
  );
}
