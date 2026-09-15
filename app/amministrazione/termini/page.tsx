import Link from "next/link";
import { bottoneDistruttivo, bottonePrimario, bottoneSecondario } from "@/components/controlli";
import { terminiVietati } from "@/lib/db/amministrazione";
import { m } from "@/lib/messaggi";
import { amministratore } from "../guardia";
import { uno, type Parametri } from "../parametri";
import {
  Campo,
  Elenco,
  Messaggio,
  Riga,
  Vuoto,
  aiuto,
  introduzione,
  titoloPagina,
} from "../parti";
import { aggiungiTermineAzione, rimuoviTermineAzione } from "./azioni";

/**
 * The blocklist of SPEC §6.5 level 1 — editable "senza toccare il codice".
 *
 * The comparison itself happens at write time inside the database, ignoring
 * case and accents and looking anywhere inside the name. Nothing on this
 * page performs it: the panel only keeps the list.
 */

const t = m.amministrazione.termini;

export default async function PaginaTermini({
  searchParams,
}: {
  searchParams: Promise<Parametri>;
}) {
  const [{ client }, parametri] = await Promise.all([amministratore(), searchParams]);
  const termini = await terminiVietati(client);

  const errori: Record<string, string> = m.amministrazione.errori;
  const errore = uno(parametri.errore);
  const salvato = uno(parametri.salvato);

  return (
    <>
      <h1 className={titoloPagina}>{t.titolo}</h1>
      <p className={introduzione}>{t.introduzione}</p>
      <p className={aiuto}>{t.riservato}</p>

      {salvato && <Messaggio testo={salvato === "rimosso" ? t.rimosso : t.aggiunto} />}
      {errore && <Messaggio testo={errori[errore] ?? m.amministrazione.errori.ERRORE} errore />}

      {termini.length === 0 ? (
        <Vuoto testo={t.vuoto} />
      ) : (
        <Elenco>
          {termini.map((v) => (
            <Riga key={v.id}>
              <span className="font-grassetto">{v.termine}</span>
              <form action={rimuoviTermineAzione} className="mt-2">
                <input type="hidden" name="termine" value={v.id} />
                <button type="submit" className={bottoneDistruttivo}>
                  {t.rimuovi}
                </button>
              </form>
            </Riga>
          ))}
        </Elenco>
      )}

      <form action={aggiungiTermineAzione} className="mt-10 border-t border-linea pt-6">
        <Campo nome="termine" testo={t.campo} richiesto />
        <p className="mt-6">
          <button type="submit" className={bottonePrimario}>
            {t.aggiungi}
          </button>
        </p>
      </form>

      <p className="mt-10">
        <Link href="/amministrazione" className={bottoneSecondario}>
          {m.amministrazione.torna}
        </Link>
      </p>
    </>
  );
}
