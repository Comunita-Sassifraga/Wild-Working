import Link from "next/link";
import { bottoneDistruttivo, bottoneSecondario } from "@/components/controlli";
import { istanteEsteso } from "@/lib/dates";
import { codiciEdizione, edizioneAttiva, edizioniTutte } from "@/lib/db/abitanti";
import { conValori, m } from "@/lib/messaggi";
import { amministratore } from "../guardia";
import { uno, type Parametri } from "../parametri";
import {
  Elenco,
  Messaggio,
  Riga,
  Sezione,
  Vuoto,
  aiuto,
  introduzione,
  titoloPagina,
} from "../parti";
import { Generatore } from "./Generatore";
import { revocaCodiceAzione } from "./azioni";

/**
 * Cartoncini — SPEC §15.3.5, §15.4, §15.9 fourth bullet.
 *
 * What this page can show, and what it cannot, is the whole of §15.3.5. The
 * database holds a fingerprint and a number; a code is readable once, in the
 * block the Generatore prints, and after that nobody can get it back —
 * whoever loses one gets a new card with a new number.
 *
 * The number is the only handle there is: without it the panel would show
 * forty-five identical rows and "ho perso il codice" would have no answer.
 * Numbers are never reused, not even after a revocation, because the pairing
 * between a number and a person lives on the paper of whoever hands out the
 * keys — and a reissued number would make that paper lie.
 *
 * No name and no email address appears here or in `codici_invito`.
 */

const t = m.amministrazione.codici;

export default async function PaginaCodici({
  searchParams,
}: {
  searchParams: Promise<Parametri>;
}) {
  const [{ client }, parametri] = await Promise.all([amministratore(), searchParams]);
  const attiva = await edizioneAttiva(client);
  const [codici, edizioni] = await Promise.all([
    attiva ? codiciEdizione(client, attiva) : Promise.resolve([]),
    edizioniTutte(client),
  ]);
  const nome = edizioni.find((e) => e.id === attiva)?.nome;

  const errori: Record<string, string> = m.amministrazione.errori;
  const errore = uno(parametri.errore);
  const salvato = uno(parametri.salvato);

  return (
    <>
      <h1 className={`${titoloPagina} print:hidden`}>{t.titolo}</h1>
      <p className={`${introduzione} print:hidden`}>{t.introduzione}</p>

      <div className="print:hidden">
        {salvato === "revocato" && <Messaggio testo={t.revocato_esito} />}
        {errore && <Messaggio testo={errori[errore] ?? errori.ERRORE} errore />}
      </div>

      {!attiva ? (
        <Vuoto testo={t.senzaEdizione} />
      ) : (
        <>
          <p className={`${aiuto} print:hidden`}>
            {conValori(t.edizione, { nome: nome ?? "" })}
          </p>

          <Generatore />

          <div className="print:hidden">
            <Sezione titolo={t.elenco}>
              {codici.length === 0 ? (
                <Vuoto testo={t.vuoto} />
              ) : (
                <Elenco>
                  {codici.map((c) => (
                    <Riga key={c.id}>
                      <span className="font-grassetto">
                        {conValori(t.riga, { numero: c.progressivo ?? 0 })}
                      </span>
                      <span className={`${aiuto} block`}>
                        {c.usato_il
                          ? conValori(t.usato, { data: istanteEsteso(c.usato_il) })
                          : t.nonUsato}
                        {c.revocato ? ` · ${t.revocato}` : ""}
                      </span>
                      {/* Only a card nobody has used: one already consumed
                          grants nothing any more, and the thing to revoke is
                          the abilitazione (§15.4). */}
                      {!c.usato_il && !c.revocato && (
                        <form action={revocaCodiceAzione} className="mt-2">
                          <input type="hidden" name="codice" value={c.id ?? ""} />
                          <button type="submit" className={bottoneDistruttivo}>
                            {t.revoca}
                          </button>
                        </form>
                      )}
                    </Riga>
                  ))}
                </Elenco>
              )}
            </Sezione>
          </div>
        </>
      )}

      <p className="mt-10 print:hidden">
        <Link href="/amministrazione" className={bottoneSecondario}>
          {m.amministrazione.torna}
        </Link>
      </p>
    </>
  );
}
