import Link from "next/link";
import { redirect } from "next/navigation";
import {
  bottoneDistruttivo,
  bottonePrimario,
  bottoneSecondario,
  campo,
} from "@/components/controlli";
import { MAX_CAMBI_NOME_GIORNO } from "@/config/limits";
import { utenteAttuale } from "@/lib/auth/sessione";
import { clientServer } from "@/lib/db/server";
import {
  CAMPI_FACOLTATIVI,
  MAX_CARATTERI_MOTIVO,
  MAX_CARATTERI_NOME,
  MAX_CARATTERI_PROFESSIONE,
  mioProfilo,
  VALORI_ETA,
  VALORI_GENERE,
  VALORI_RESIDENZA,
} from "@/lib/db/utenti";
import { conValori, m } from "@/lib/messaggi";
import { rimuoviDatiAzione, salvaDatiAzione, salvaNomeAzione } from "./azioni";

/**
 * Personal settings — SPEC §6.5, §12 step 6, plus the one-time screen of
 * §6.1 point 5 in "benvenuto" mode.
 *
 * Server-rendered like every other page: no "use client", so it works with
 * JavaScript switched off. That is also why the preview shows the *saved*
 * name rather than what is being typed — an anteprima that did not match
 * what is stored would be telling the person something untrue.
 *
 * Nothing here validates a name or records a consent: both happen in the
 * database (§8.3), and this page only shows what came back.
 *
 * TODO step 7: "Chi c'è in Valle" must show the name exactly as the preview
 * below draws it — same register, same wording. If the two drift apart, the
 * preview is the one that is wrong.
 * TODO step 8: §6.5 asks that the notice of an admin clear appear here at the
 * next sign-in. Only the admin action can set that, and it is built with the
 * panel; no column for it exists yet on purpose.
 */

type Proprieta = {
  searchParams: Promise<{
    benvenuto?: string | string[];
    salvato?: string | string[];
    errore?: string | string[];
  }>;
};

const uno = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

const t = m.impostazioni;
const titolo = "text-titolo-pagina font-grassetto grande:text-titolo-pagina-grande";
const sezione = "mt-10 border-t border-linea pt-8";
const titoloSezione = "text-titolo-sezione font-grassetto";
const etichetta = "mb-2 block";
const aiuto = "mt-2 text-nota text-testo-secondario";

type Profilo = NonNullable<Awaited<ReturnType<typeof mioProfilo>>["data"]>;

function Scelta({
  nome,
  testo,
  valori,
  etichette,
  valore,
}: {
  nome: string;
  testo: string;
  valori: readonly string[];
  etichette?: Record<string, string>;
  valore: string | null;
}) {
  return (
    <p>
      <label htmlFor={nome} className={etichetta}>
        {testo}
      </label>
      <select id={nome} name={nome} defaultValue={valore ?? ""} className={campo}>
        <option value="">{t.facoltativi.nonRisposto}</option>
        {valori.map((v) => (
          <option key={v} value={v}>
            {etichette?.[v] ?? v}
          </option>
        ))}
      </select>
    </p>
  );
}

function Testo({
  nome,
  testo,
  valore,
  massimo,
}: {
  nome: string;
  testo: string;
  valore: string | null;
  massimo: number;
}) {
  return (
    <p>
      <label htmlFor={nome} className={etichetta}>
        {testo}
      </label>
      <input
        id={nome}
        name={nome}
        type="text"
        maxLength={massimo}
        defaultValue={valore ?? ""}
        className={campo}
      />
    </p>
  );
}

/**
 * The five fields of §5.1. Every one of them may stay empty and none blocks
 * anything (rule 17): no asterisk, no `required`, no reminder.
 */
function CampiFacoltativi({ profilo }: { profilo: Profilo }) {
  const f = t.facoltativi;
  return (
    <div className="flex flex-col gap-6">
      <Scelta nome="eta" testo={f.eta} valori={VALORI_ETA} valore={profilo.eta} />
      {/* The stored values stay M and F (§5.1); only their labels are spelled out. */}
      <Scelta nome="genere" testo={f.genere} valori={VALORI_GENERE} etichette={f.generi} valore={profilo.genere} />
      <Testo nome="professione" testo={f.professione} valore={profilo.professione} massimo={MAX_CARATTERI_PROFESSIONE} />
      <Testo nome="motivo_visita" testo={f.motivoVisita} valore={profilo.motivo_visita} massimo={MAX_CARATTERI_MOTIVO} />
      <Scelta nome="residenza" testo={f.residenza} valori={VALORI_RESIDENZA} valore={profilo.residenza} />
    </div>
  );
}

function Voce({ nome, valore, nota }: { nome: string; valore: string; nota?: string }) {
  return (
    <div className="border-b border-linea py-4">
      <dt className="text-nota text-testo-secondario">{nome}</dt>
      <dd className="mt-1">{valore}</dd>
      {nota && <dd className={aiuto}>{nota}</dd>}
    </div>
  );
}

export default async function PaginaImpostazioni({ searchParams }: Proprieta) {
  const [utente, client, parametri] = await Promise.all([
    utenteAttuale(),
    clientServer(),
    searchParams,
  ]);
  if (!utente) redirect("/accedi");

  const { data: profilo } = await mioProfilo(client, utente.id);
  if (!profilo) redirect("/accedi");

  // The welcome screen of §6.1 point 5 arrives here from /auth/conferma, and
  // only on the first sign-in. It shows the five fields and nothing else:
  // asking about the public name before a person has ever seen the app would
  // be asking too much, too early.
  if (uno(parametri.benvenuto)) {
    return (
      <>
        <h1 className={titolo}>{t.benvenuto.titolo}</h1>
        <p className="mt-6 italic">{t.benvenuto.introduzione}</p>
        <form action={salvaDatiAzione} className="mt-8">
          <input type="hidden" name="benvenuto" value="1" />
          <CampiFacoltativi profilo={profilo} />
          {/* "Salta" carries the same weight as "Salva" (§6.1): same height,
              side by side, never a small link at the foot of the page. */}
          <div className="mt-8 flex flex-wrap items-center gap-4">
            <button type="submit" className={bottonePrimario}>
              {t.benvenuto.salva}
            </button>
            <Link href="/" className={bottoneSecondario}>
              {t.benvenuto.salta}
            </Link>
          </div>
        </form>
      </>
    );
  }

  const compilati = CAMPI_FACOLTATIVI.filter((c) => profilo[c] !== null).length;
  const limiti = { caratteri: MAX_CARATTERI_NOME, cambi: MAX_CAMBI_NOME_GIORNO };

  const conferme: Record<string, string> = {
    nome: t.nome.salvato,
    spento: t.nome.spento,
    dati: t.facoltativi.salvati,
    rimossi: t.facoltativi.rimossi,
  };
  const errori: Record<string, string> = t.errori;
  const salvato = conferme[uno(parametri.salvato) ?? ""];
  const motivo = uno(parametri.errore);
  const errore = motivo ? conValori(errori[motivo] ?? t.errori.generico, limiti) : undefined;

  return (
    <>
      <h1 className={titolo}>{t.titolo}</h1>
      <p className="mt-6 italic">{t.introduzione}</p>

      {salvato && (
        <p role="status" className="mt-6">
          {salvato}
        </p>
      )}
      {errore && (
        <p role="alert" className="mt-6 text-errore">
          {errore}
        </p>
      )}

      <section className={sezione}>
        <h2 className={titoloSezione}>{t.tuoiDati.titolo}</h2>
        <p className="mt-4">{t.tuoiDati.introduzione}</p>
        <dl className="mt-6 border-t border-linea">
          <Voce nome={t.tuoiDati.email} valore={profilo.email} nota={t.tuoiDati.emailNota} />
          <Voce
            nome={t.tuoiDati.lingua}
            valore={t.tuoiDati.lingue[profilo.lingua]}
            nota={t.tuoiDati.linguaNota}
          />
          <Voce
            nome={t.tuoiDati.nomePubblico}
            valore={profilo.nome_pubblico ?? t.tuoiDati.nomePubblicoVuoto}
          />
          <Voce
            nome={t.tuoiDati.datiFacoltativi}
            valore={
              compilati === 0
                ? t.tuoiDati.datiFacoltativiVuoti
                : conValori(t.tuoiDati.datiFacoltativiCompilati, { numero: compilati })
            }
          />
        </dl>
      </section>

      <section className={sezione}>
        <h2 className={titoloSezione}>{t.nome.titolo}</h2>
        <form action={salvaNomeAzione} className="mt-6">
          <label className="flex min-h-tocco items-center gap-3">
            <input
              type="checkbox"
              name="mostra"
              defaultChecked={profilo.mostra_nome_pubblico}
              className="accent-verde"
            />
            <span>{t.nome.mostra}</span>
          </label>
          <p className={aiuto}>{t.nome.mostraNota}</p>

          <p className="mt-6">
            <label htmlFor="nome" className={etichetta}>
              {t.nome.etichetta}
            </label>
            <input
              id="nome"
              name="nome"
              type="text"
              maxLength={MAX_CARATTERI_NOME}
              defaultValue={profilo.nome_pubblico ?? ""}
              aria-describedby="aiuto-nome"
              className={campo}
            />
          </p>
          <p id="aiuto-nome" className={aiuto}>
            {t.nome.aiuto}. {conValori(t.nome.limite, limiti)}
          </p>

          <p className="mt-8">
            <button type="submit" className={bottonePrimario}>
              {t.nome.salva}
            </button>
          </p>
        </form>

        <h3 className="mt-8 text-nota font-grassetto">{t.nome.anteprima}</h3>
        {profilo.nome_pubblico ? (
          <p className="mt-2 bg-verde px-6 py-4 text-testo">{profilo.nome_pubblico}</p>
        ) : (
          <p className="mt-2 text-testo-secondario">{t.nome.anteprimaVuota}</p>
        )}
        {profilo.nome_pubblico && !profilo.mostra_nome_pubblico && (
          <p className={aiuto}>{t.nome.anteprimaNascosta}</p>
        )}
        {!profilo.nome_pubblico && profilo.mostra_nome_pubblico && (
          <p className="mt-2 text-nota text-avviso">{t.nome.senzaNome}</p>
        )}
      </section>

      <section className={sezione}>
        <h2 className={titoloSezione}>{t.facoltativi.titolo}</h2>
        <p className="mt-4">{t.facoltativi.introduzione}</p>
        <form action={salvaDatiAzione} className="mt-6">
          <CampiFacoltativi profilo={profilo} />
          <p className="mt-8">
            <button type="submit" className={bottonePrimario}>
              {t.facoltativi.salva}
            </button>
          </p>
        </form>

        {/* A separate form: "Rimuovi" empties all five at once and is not a
            variant of "Salva" (§6.5). Immediate, nobody to ask. */}
        <form action={rimuoviDatiAzione} className="mt-8">
          <button type="submit" className={bottoneDistruttivo}>
            {t.facoltativi.rimuovi}
          </button>
          <p className={aiuto}>{t.facoltativi.rimuoviNota}</p>
        </form>
      </section>

      <p className="mt-10">
        <Link href="/">{m.prenotazioni.vuoto.collegamento}</Link>
      </p>
    </>
  );
}
