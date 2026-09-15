import Link from "next/link";
import { bottoneDistruttivo, bottonePrimario, bottoneSecondario } from "@/components/controlli";
import { istanteEsteso } from "@/lib/dates";
import { abilitazioniEdizione, edizioneAttiva, edizioniTutte } from "@/lib/db/abitanti";
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
import { abilitaUtenteAzione, revocaAbilitazioneAzione } from "./azioni";

/**
 * Abilitazioni — SPEC §15.3.4, §15.4, §15.9 fifth bullet.
 *
 * The abilitazione is the real authorisation: the card only creates one. So
 * this is where somebody is let in without a card — a participant who
 * registered with an address different from the one they gave VIHTA, or who
 * lost their card and is already inside the app — and where one is shut out
 * again.
 *
 * Revoking does NOT cancel the iscrizioni already made. They stay, and stop
 * being changeable by the person concerned; if they have to go, an
 * amministratore cancels them and says so (§15.4, §15.12). Rule 6 is intact:
 * nothing here cancels anything automatically.
 *
 * The list carries the email address because it is the only handle this
 * application has on a person — the same choice as the incarichi list of
 * §6.7, agreed into §15.9 on 2026-09-12. It carries no optional field, and
 * it is not a directory: only the people already enabled are on it.
 */

const t = m.amministrazione.abilitazioni;

export default async function PaginaAbilitazioni({
  searchParams,
}: {
  searchParams: Promise<Parametri>;
}) {
  const [{ client }, parametri] = await Promise.all([amministratore(), searchParams]);
  const attiva = await edizioneAttiva(client);
  const [abilitazioni, edizioni] = await Promise.all([
    attiva ? abilitazioniEdizione(client, attiva) : Promise.resolve([]),
    edizioniTutte(client),
  ]);
  const nome = edizioni.find((e) => e.id === attiva)?.nome;

  const errori: Record<string, string> = m.amministrazione.errori;
  const origini: Record<string, string> = t.origini;
  const errore = uno(parametri.errore);
  const salvato = uno(parametri.salvato);
  const conferme: Record<string, string> = {
    abilitata: t.abilita.abilitata,
    revocata: t.revocataEsito,
  };

  return (
    <>
      <h1 className={titoloPagina}>{t.titolo}</h1>
      <p className={introduzione}>{t.introduzione}</p>

      {salvato && conferme[salvato] && <Messaggio testo={conferme[salvato]} />}
      {errore && <Messaggio testo={errori[errore] ?? errori.ERRORE} errore />}

      {!attiva ? (
        <Vuoto testo={t.senzaEdizione} />
      ) : (
        <>
          <p className={aiuto}>
            {conValori(m.amministrazione.codici.edizione, { nome: nome ?? "" })}
          </p>

          <Sezione titolo={t.elenco}>
            {abilitazioni.length === 0 ? (
              <Vuoto testo={t.vuoto} />
            ) : (
              <Elenco>
                {abilitazioni.map((a) => (
                  <Riga key={a.id}>
                    <span className="font-grassetto">{a.email}</span>
                    <span className={`${aiuto} block`}>
                      {origini[a.origine ?? ""] ?? ""}
                      {a.attivata_il
                        ? ` · ${conValori(t.dal, { data: istanteEsteso(a.attivata_il) })}`
                        : ""}
                      {!a.attiva && a.revocata_il
                        ? ` · ${conValori(t.revocata, { data: istanteEsteso(a.revocata_il) })}`
                        : ""}
                    </span>
                    {a.attiva && (
                      <form action={revocaAbilitazioneAzione} className="mt-2">
                        <input type="hidden" name="abilitazione" value={a.id ?? ""} />
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

          <Sezione titolo={t.abilita.titolo}>
            <p className={aiuto}>{t.abilita.nota}</p>
            <form action={abilitaUtenteAzione}>
              <Campo nome="email" testo={t.abilita.email} tipo="text" richiesto />
              <p className="mt-6">
                <button type="submit" className={bottonePrimario}>
                  {t.abilita.pulsante}
                </button>
              </p>
            </form>
          </Sezione>
        </>
      )}

      <p className="mt-10">
        <Link href="/amministrazione" className={bottoneSecondario}>
          {m.amministrazione.torna}
        </Link>
      </p>
    </>
  );
}
