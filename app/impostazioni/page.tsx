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
import { istanteEsteso } from "@/lib/dates";
import { clientServer } from "@/lib/db/server";
import {
  MAX_CARATTERI_MOTIVO,
  MAX_CARATTERI_NOME,
  MAX_CARATTERI_PROFESSIONE,
  mioProfilo,
  VALORI_ETA,
  VALORI_GENERE,
  VALORI_RESIDENZA,
} from "@/lib/db/utenti";
import { conValori, m } from "@/lib/messaggi";
import {
  chiudiAvvisoModerazioneAzione,
  rimuoviDatiAzione,
  salvaBenvenutoAzione,
  salvaImpostazioniAzione,
} from "./azioni";

/**
 * Personal settings — SPEC §6.5, §12 step 6, plus the one-time screen of
 * §6.1 point 5 in "benvenuto" mode.
 *
 * One list, in the order of §6.5: email, nome pubblico, dati facoltativi,
 * lingua. What can be changed sits where it is read, so nobody has to look
 * for it twice. Under the list, and outside it, the two rights of §7 that a
 * person exercises alone — download and erasure (§12 step 10).
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
 *
 * The notice of §6.5 — an amministratore removed the public name — is read
 * from `avviso_moderazione`, which only the clear action of the panel can
 * set. The person closes it themselves: shown once and gone would mean shown
 * to nobody if they happened not to open this page that day. The email that
 * carries the same message arrives at step 9, with all the others.
 */

type Proprieta = {
  searchParams: Promise<{
    benvenuto?: string | string[];
    salvato?: string | string[];
    errore?: string | string[];
    restoSalvato?: string | string[];
  }>;
};

const uno = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

const t = m.impostazioni;
const titoloPagina = "text-titolo-pagina font-grassetto grande:text-titolo-pagina-grande";
const titoloVoce = "text-nota text-testo-secondario";
const titoloBenvenuto = "text-titolo-sezione font-grassetto";
const etichetta = "mb-2 block";
const aiuto = "mt-2 text-nota text-testo-secondario";

type Profilo = NonNullable<Awaited<ReturnType<typeof mioProfilo>>["data"]>;

/** One entry of the list. Same frame whether it is read-only or a form. */
function Voce({ titolo, children }: { titolo: string; children: React.ReactNode }) {
  return (
    <section className="border-b border-linea py-6">
      <h2 className={titoloVoce}>{titolo}</h2>
      {children}
    </section>
  );
}

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
 * The public name — SPEC §6.5, read top to bottom: explanation, field, then
 * the tick. The field comes before the tick because it is the explanation
 * that says what the tick does: asking someone to turn on a switch before
 * they have seen what it turns on is asking for a decision in the dark.
 *
 * The heading is the field's accessible name (aria-labelledby), so the label
 * is not repeated right underneath it.
 */
function CampiNome({ profilo }: { profilo: Profilo }) {
  return (
    <>
      <p id="spiegazione-nome" className="mt-2">
        {t.nome.spiegazione}
      </p>
      <p className="mt-4">
        <input
          id="nome"
          name="nome"
          type="text"
          maxLength={MAX_CARATTERI_NOME}
          defaultValue={profilo.nome_pubblico ?? ""}
          aria-labelledby="titolo-nome"
          aria-describedby="spiegazione-nome aiuto-nome"
          className={campo}
        />
      </p>
      <p id="aiuto-nome" className={aiuto}>
        {conValori(t.nome.limite, { caratteri: MAX_CARATTERI_NOME, cambi: MAX_CAMBI_NOME_GIORNO })}
      </p>
      <label className="mt-4 flex min-h-tocco items-center gap-3">
        <input
          type="checkbox"
          name="mostra"
          defaultChecked={profilo.mostra_nome_pubblico}
          className="accent-verde"
        />
        <span>{t.nome.mostra}</span>
      </label>
    </>
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

export default async function PaginaImpostazioni({ searchParams }: Proprieta) {
  const [utente, client, parametri] = await Promise.all([
    utenteAttuale(),
    clientServer(),
    searchParams,
  ]);
  if (!utente) redirect("/accedi");

  const { data: profilo } = await mioProfilo(client, utente.id);
  if (!profilo) redirect("/accedi");

  const errori: Record<string, string> = t.errori;
  const motivo = uno(parametri.errore);
  const errore = motivo
    ? conValori(errori[motivo] ?? t.errori.generico, {
        caratteri: MAX_CARATTERI_NOME,
        cambi: MAX_CAMBI_NOME_GIORNO,
      })
    : undefined;

  // One save covers both blocks, so a refused name arrives together with the
  // news that everything else went through: two banners for one press would
  // read as two separate things happening.
  const avviso = errore ? (
    <p role="alert" className="mt-6 text-errore">
      {errore}
      {uno(parametri.restoSalvato) ? ` ${t.errori.restoSalvato}` : ""}
    </p>
  ) : null;

  // The welcome screen of §6.1 point 5 arrives here from /auth/conferma, and
  // only on the first sign-in. The public name is offered here and not only
  // in the settings: it is the function that gives the app its value (§1),
  // and a field that lives only on a settings page is a field almost nobody
  // ever fills in. It stays as optional as the other five (rule 17).
  if (uno(parametri.benvenuto)) {
    return (
      <>
        <h1 className={titoloPagina}>{t.benvenuto.titolo}</h1>
        <p className="mt-6 italic">{t.benvenuto.introduzione}</p>
        {avviso}
        <form action={salvaBenvenutoAzione} className="mt-8">
          <h2 id="titolo-nome" className={titoloBenvenuto}>
            {t.nome.titolo}
          </h2>
          <CampiNome profilo={profilo} />

          <h2 className={`mt-10 ${titoloBenvenuto}`}>{t.facoltativi.titolo}</h2>
          <div className="mt-4">
            <CampiFacoltativi profilo={profilo} />
          </div>

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

  const conferme: Record<string, string> = {
    tutto: t.salvato,
    rimossi: t.facoltativi.rimossi,
  };
  const salvato = conferme[uno(parametri.salvato) ?? ""];

  return (
    <>
      <h1 className={titoloPagina}>{t.titolo}</h1>
      <p className="mt-6 italic">{t.introduzione}</p>

      {/* §6.5: the person must be told, or they go on believing their name
          is visible and cannot understand why nobody sees it. */}
      {profilo.avviso_moderazione && (
        <section role="alert" className="mt-8 border-b border-t border-linea py-6">
          <h2 className="text-titolo-sezione font-grassetto">{t.moderazione.titolo}</h2>
          <p className="mt-4">{t.moderazione.testo}</p>
          <p className={aiuto}>
            {conValori(t.moderazione.quando, {
              data: istanteEsteso(profilo.avviso_moderazione),
            })}
          </p>
          <form action={chiudiAvvisoModerazioneAzione} className="mt-6">
            <button type="submit" className={bottoneSecondario}>
              {t.moderazione.chiudi}
            </button>
          </form>
        </section>
      )}

      {salvato && (
        <p role="status" className="mt-6">
          {salvato}
        </p>
      )}
      {avviso}

      <div className="mt-8 border-t border-linea">
        <Voce titolo={t.email}>
          <p className="mt-1">{profilo.email}</p>
          <p className={aiuto}>{t.emailNota}</p>
        </Voce>

        {/* One form over both blocks, and one Salva at the end: the page asks
            one thing of the person, so it takes one press. "Rimuovi" submits
            the same form to its own action — it empties all five fields and
            is not a variant of Salva (§6.5), and a form inside a form is not
            allowed. */}
        <form action={salvaImpostazioniAzione}>
          <section className="border-b border-linea py-6">
            <h2 id="titolo-nome" className={titoloVoce}>
              {t.nome.titolo}
            </h2>
            <CampiNome profilo={profilo} />

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

          <section className="border-b border-linea py-6">
            <h2 className={titoloVoce}>{t.facoltativi.titolo}</h2>
            <p className="mt-2">{t.facoltativi.introduzione}</p>
            <div className="mt-6">
              <CampiFacoltativi profilo={profilo} />
            </div>

            <p className="mt-8">
              <button type="submit" className={bottonePrimario}>
                {t.salva}
              </button>
            </p>

            <p className="mt-6">
              <button type="submit" formAction={rimuoviDatiAzione} className={bottoneDistruttivo}>
                {t.facoltativi.rimuovi}
              </button>
            </p>
            <p className={aiuto}>{t.facoltativi.rimuoviNota}</p>
          </section>
        </form>

        <Voce titolo={t.lingua}>
          <p className="mt-1">{t.lingue[profilo.lingua]}</p>
          <p className={aiuto}>{t.linguaNota}</p>
        </Voce>
      </div>

      {/* The two rights of §7 that a person exercises alone. They sit under
          the list and outside it, and on purpose: the list answers "cosa
          sapete di me", these two say what can be done with it. Neither is a
          variant of Salva — one is a download, the other leads to a page of
          its own where the consequences are spelled out before anything
          happens. */}
      <section className="mt-10 border-t border-linea pt-6">
        <h2 className="text-titolo-sezione font-grassetto">{t.diritti.titolo}</h2>
        <p className="mt-4">{t.diritti.introduzione}</p>

        {/* A plain link, not a form: it is a GET that returns a file, so it
            works with JavaScript switched off like everything else here. */}
        <p className="mt-6">
          <a href="/impostazioni/dati" download className={bottoneSecondario}>
            {t.diritti.scarica}
          </a>
        </p>
        <p className={aiuto}>{t.diritti.scaricaNota}</p>

        <p className="mt-8">
          <Link href="/impostazioni/cancella" className={bottoneDistruttivo}>
            {t.diritti.cancella}
          </Link>
        </p>
        <p className={aiuto}>{t.diritti.cancellaNota}</p>
      </section>

      <p className="mt-10">
        <Link href="/" className={bottoneSecondario}>
          {m.prenotazioni.vuoto.collegamento}
        </Link>
      </p>
    </>
  );
}
