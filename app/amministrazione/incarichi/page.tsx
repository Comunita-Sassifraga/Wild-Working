import Link from "next/link";
import { bottoneDistruttivo, bottonePrimario } from "@/components/controlli";
import { incarichiAttivi, sediTutte } from "@/lib/db/amministrazione";
import { m } from "@/lib/messaggi";
import { amministratore } from "../guardia";
import { uno, type Parametri } from "../parametri";
import {
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
import { assegnaReferenteAzione, revocaIncaricoAzione } from "./azioni";

/**
 * Incarichi — SPEC §6.7, §5.6.
 *
 * A person is found by their exact address and not picked from a list: the
 * panel has no directory of everyone who ever signed in, and building one
 * would be the first step towards the screen rule 15 forbids.
 *
 * Amministratori appear here read-only. §6.7 asks the panel to assign and
 * revoke the referente role, and only that: who sits on the Direttivo is not
 * something a screen should be able to change on its own.
 */

const t = m.amministrazione;

export default async function PaginaIncarichi({
  searchParams,
}: {
  searchParams: Promise<Parametri>;
}) {
  const [{ client }, parametri] = await Promise.all([amministratore(), searchParams]);
  const [incarichi, sedi] = await Promise.all([incarichiAttivi(client), sediTutte(client)]);

  const nomeSede = new Map(sedi.map((s) => [s.id, s.nome]));
  const errori: Record<string, string> = t.errori;
  const errore = uno(parametri.errore);
  const salvato = uno(parametri.salvato);

  return (
    <>
      <h1 className={titoloPagina}>{t.incarichi.titolo}</h1>
      <p className={introduzione}>{t.incarichi.introduzione}</p>

      {salvato && (
        <Messaggio
          testo={salvato === "revocato" ? t.incarichi.revocato : t.incarichi.assegna.assegnato}
        />
      )}
      {errore && <Messaggio testo={errori[errore] ?? t.errori.ERRORE} errore />}

      <Sezione titolo={t.incarichi.elenco}>
        {incarichi.length === 0 ? (
          <Vuoto testo={t.incarichi.vuoto} />
        ) : (
          <Elenco>
            {incarichi.map((i) => (
              <Riga key={i.id}>
                <span className="font-grassetto">{t.incarichi.ruoli[i.ruolo]}</span>
                <span className={`${aiuto} block`}>
                  {i.email}
                  {i.sedeId ? ` · ${nomeSede.get(i.sedeId) ?? ""}` : ""}
                </span>
                {i.ruolo === "REFERENTE" && (
                  <form action={revocaIncaricoAzione} className="mt-2">
                    <input type="hidden" name="incarico" value={i.id} />
                    <button type="submit" className={bottoneDistruttivo}>
                      {t.incarichi.revoca}
                    </button>
                  </form>
                )}
              </Riga>
            ))}
          </Elenco>
        )}
        <p className={aiuto}>{t.incarichi.amministratoriNota}</p>
      </Sezione>

      <Sezione titolo={t.incarichi.assegna.titolo}>
        <p className="mt-4">{t.incarichi.assegna.nota}</p>
        <form action={assegnaReferenteAzione}>
          <Campo nome="email" testo={t.incarichi.assegna.email} richiesto />
          <Scelta
            nome="sede"
            testo={t.incarichi.assegna.sede}
            opzioni={sedi.map((s) => ({ valore: s.id, testo: s.nome }))}
          />
          <p className="mt-6">
            <button type="submit" className={bottonePrimario}>
              {t.incarichi.assegna.pulsante}
            </button>
          </p>
        </form>
      </Sezione>

      <p className="mt-10">
        <Link href="/amministrazione">{t.torna}</Link>
      </p>
    </>
  );
}
