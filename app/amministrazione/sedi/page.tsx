import Link from "next/link";
import { bottonePrimario, bottoneSecondario } from "@/components/controlli";
import { sediTutte } from "@/lib/db/amministrazione";
import { conValori, m } from "@/lib/messaggi";
import { amministratore } from "../guardia";
import { uno, type Parametri } from "../parametri";
import {
  Campo,
  Elenco,
  Messaggio,
  Riga,
  Sezione,
  Vuoto,
  aiuto,
  introduzione,
  titoloPagina,
} from "../parti";
import { creaSedeAzione } from "./azioni";

/**
 * The list of sedi — SPEC §6.7.
 *
 * Suspended sedi are listed here and nowhere else: for everybody but an
 * amministratore they do not exist (the `sedi_lettura_registrati` policy).
 * Each state carries a word and not only a place in the list (rule 14).
 */

const t = m.amministrazione;

export default async function PaginaSedi({ searchParams }: { searchParams: Promise<Parametri> }) {
  const [{ client }, parametri] = await Promise.all([amministratore(), searchParams]);
  const sedi = await sediTutte(client);

  const errori: Record<string, string> = t.errori;
  const errore = uno(parametri.errore);

  return (
    <>
      <h1 className={titoloPagina}>{t.sedi.titolo}</h1>
      <p className={introduzione}>{t.sedi.introduzione}</p>
      {errore && <Messaggio testo={errori[errore] ?? t.errori.ERRORE} errore />}

      {sedi.length === 0 ? (
        <Vuoto testo={t.sedi.vuoto} />
      ) : (
        <Elenco>
          {sedi.map((s) => (
            <Riga key={s.id}>
              <Link href={`/amministrazione/sedi/${s.id}`} className="font-grassetto">
                {s.nome}
              </Link>
              <span className={`${aiuto} block`}>
                {s.comune} ·{" "}
                {s.capienza === 1
                  ? t.sedi.unPosto
                  : conValori(t.sedi.posti, { numero: s.capienza })}{" "}
                ·{" "}
                {s.attiva ? t.sedi.attiva : t.sedi.sospesa} ·{" "}
                {s.sempre_disponibile ? t.sedi.tuttoAnno : t.sedi.stagionale}
              </span>
            </Riga>
          ))}
        </Elenco>
      )}

      <Sezione titolo={t.sedi.nuova.titolo}>
        <p className="mt-4">{t.sedi.nuova.nota}</p>
        <form action={creaSedeAzione}>
          <Campo nome="nome" testo={t.sede.nome} richiesto />
          <Campo nome="comune" testo={t.sede.comune} richiesto />
          <Campo
            nome="capienza"
            testo={t.sede.capienza}
            tipo="number"
            minimo={0}
            nota={t.sede.capienzaNota}
            richiesto
          />
          <p className="mt-6">
            <button type="submit" className={bottonePrimario}>
              {t.sedi.nuova.crea}
            </button>
          </p>
        </form>
      </Sezione>

      <p className="mt-10">
        <Link href="/amministrazione" className={bottoneSecondario}>
          {t.torna}
        </Link>
      </p>
    </>
  );
}
