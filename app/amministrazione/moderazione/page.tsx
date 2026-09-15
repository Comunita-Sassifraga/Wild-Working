import Link from "next/link";
import { bottoneDistruttivo, bottoneSecondario, campo } from "@/components/controlli";
import { istanteEsteso } from "@/lib/dates";
import {
  nomeInModerazione,
  nomiInModerazione,
  registroModerazioni,
  type NomeInModerazione,
} from "@/lib/db/amministrazione";
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
  etichetta,
  introduzione,
  titoloPagina,
  titoloVoce,
} from "../parti";
import { azzeraNomeAzione } from "./azioni";

/**
 * Moderation of public names — SPEC §6.5 level 3, §6.7.
 *
 * "La schermata mostra il nome pubblico e l'identificativo interno, mai
 * l'email dell'utente." That is not a decision taken here: the screen reads
 * `nomi_pubblici_moderazione`, a view without the email column. A page
 * written wrong could not leak an address from data it never receives.
 *
 * The address `?utente=<identificativo>` is the one the notice of §6.5 will
 * link to when the emails arrive at step 9.
 *
 * Moderation stays after the fact (D14): there is no approval queue here,
 * and there must not be one. A name goes live at once and is removed after,
 * if it needs to be.
 */

const t = m.amministrazione.moderazione;

function Scheda({ nome, conferma }: { nome: NomeInModerazione; conferma: boolean }) {
  return (
    <Sezione titolo={t.scheda.titolo}>
      <h3 className={`mt-4 ${titoloVoce}`}>{t.scheda.nome}</h3>
      <p className="mt-1 font-grassetto">{nome.nomePubblico}</p>

      <h3 className={`mt-6 ${titoloVoce}`}>{t.scheda.identificativo}</h3>
      <p className="mt-1">{nome.utenteId}</p>

      <p className={aiuto}>{nome.mostra ? t.scheda.visibile : t.scheda.nascosto}</p>
      {nome.avvisoInAttesa && <p className="mt-2 text-avviso">{t.scheda.avvisoInAttesa}</p>}

      {conferma ? (
        <>
          <p className="mt-6">{conValori(t.scheda.conferma, { nome: nome.nomePubblico })}</p>
          <div className="mt-6 flex flex-wrap items-center gap-4">
            <form action={azzeraNomeAzione}>
              <input type="hidden" name="utente" value={nome.utenteId} />
              <button type="submit" className={bottoneDistruttivo}>
                {t.scheda.confermaSi}
              </button>
            </form>
            <Link
              href={`/amministrazione/moderazione?utente=${nome.utenteId}`}
              className={bottoneSecondario}
            >
              {t.scheda.confermaNo}
            </Link>
          </div>
        </>
      ) : (
        <p className="mt-6">
          <Link
            href={`/amministrazione/moderazione?utente=${nome.utenteId}&conferma=1`}
            className={bottoneDistruttivo}
          >
            {t.scheda.azzera}
          </Link>
        </p>
      )}
    </Sezione>
  );
}

export default async function PaginaModerazione({
  searchParams,
}: {
  searchParams: Promise<Parametri>;
}) {
  const [{ client }, parametri] = await Promise.all([amministratore(), searchParams]);

  const chiesto = uno(parametri.utente);
  const [scelto, nomi, registro] = await Promise.all([
    chiesto ? nomeInModerazione(client, chiesto) : Promise.resolve(null),
    nomiInModerazione(client),
    registroModerazioni(client),
  ]);

  const errori: Record<string, string> = m.amministrazione.errori;
  const errore = uno(parametri.errore);

  return (
    <>
      <h1 className={titoloPagina}>{t.titolo}</h1>
      <p className={introduzione}>{t.introduzione}</p>

      {uno(parametri.salvato) && (
        <>
          <Messaggio testo={t.rimosso} />
          <p className={aiuto}>{t.postaDaFare}</p>
        </>
      )}
      {errore && <Messaggio testo={errori[errore] ?? m.amministrazione.errori.ERRORE} errore />}

      <Sezione titolo={t.cerca.titolo}>
        <p className="mt-4">{t.cerca.nota}</p>
        {/* A GET form: the search result is an address, so it can be reached
            again and shared with another amministratore. */}
        <form method="get" className="mt-6">
          <label htmlFor="utente" className={etichetta}>
            {t.cerca.campo}
          </label>
          <input id="utente" name="utente" type="text" className={campo} />
          <p className="mt-6">
            <button type="submit" className={bottoneSecondario}>
              {t.cerca.pulsante}
            </button>
          </p>
        </form>
      </Sezione>

      {chiesto &&
        (scelto ? (
          <Scheda nome={scelto} conferma={uno(parametri.conferma) !== undefined} />
        ) : (
          <Sezione titolo={t.scheda.titolo}>
            <Vuoto testo={t.scheda.nonTrovato} />
          </Sezione>
        ))}

      <Sezione titolo={t.elenco.titolo}>
        <p className="mt-4">{t.elenco.nota}</p>
        {nomi.length === 0 ? (
          <Vuoto testo={t.elenco.vuoto} />
        ) : (
          <Elenco>
            {nomi.map((n) => (
              <Riga key={n.utenteId}>
                <Link
                  href={`/amministrazione/moderazione?utente=${n.utenteId}`}
                  className="font-grassetto"
                >
                  {n.nomePubblico}
                </Link>
                <span className={`${aiuto} block`}>
                  {n.mostra ? t.scheda.visibile : t.scheda.nascosto}
                </span>
              </Riga>
            ))}
          </Elenco>
        )}
      </Sezione>

      <Sezione titolo={t.registro.titolo}>
        <p className="mt-4">{t.registro.nota}</p>
        {registro.length === 0 ? (
          <Vuoto testo={t.registro.vuoto} />
        ) : (
          <Elenco>
            {registro.map((r) => (
              <Riga key={r.id}>
                <span>
                  {conValori(t.registro.riga, {
                    nome: r.nomeRimosso,
                    data: istanteEsteso(r.avvenutaIl),
                  })}
                </span>
                <span className={`${aiuto} block`}>{r.utenteId}</span>
              </Riga>
            ))}
          </Elenco>
        )}
      </Sezione>

      <p className="mt-10">
        <Link href="/amministrazione" className={bottoneSecondario}>
          {m.amministrazione.torna}
        </Link>
      </p>
    </>
  );
}
