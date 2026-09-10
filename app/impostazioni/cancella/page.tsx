import Link from "next/link";
import { redirect } from "next/navigation";
import { bottoneDistruttivo, bottoneSecondario } from "@/components/controlli";
import { utenteAttuale } from "@/lib/auth/sessione";
import { miePrenotazioni } from "@/lib/db/prenotazioni";
import { clientServer } from "@/lib/db/server";
import { conValori, m } from "@/lib/messaggi";
import { cancellaAccountAzione } from "./azioni";

/**
 * The confirmation of SPEC §7: "Pulsante «Cancella il mio account» →
 * conferma → esecuzione immediata".
 *
 * A page of its own, and not a second button beside "Salva". Erasure is the
 * one thing in this app that cannot be undone, so the confirmation is a place
 * you have to arrive at, where the consequences are written out in full and
 * the only other control is the one that takes you back.
 *
 * It also says how many bookings are about to be cancelled: that is the part
 * of the consequence that touches other people — those seats go back into
 * the grid — and it is the one thing a person may not have in mind.
 *
 * No confirmation of any other kind: no typing of the address, no waiting
 * period. §7 says immediate, and a right that is made tiresome to exercise
 * is a right that is being discouraged.
 */

const t = m.impostazioni.cancella;
const titoloPagina = "text-titolo-pagina font-grassetto grande:text-titolo-pagina-grande";
const aiuto = "mt-2 text-nota text-testo-secondario";

export default async function PaginaCancella({
  searchParams,
}: {
  searchParams: Promise<{ errore?: string | string[] }>;
}) {
  const [utente, client, parametri] = await Promise.all([
    utenteAttuale(),
    clientServer(),
    searchParams,
  ]);
  if (!utente) redirect("/accedi");

  const prenotazioni = await miePrenotazioni(client);
  // Exactly the set the erasure frees: the ones whose fascia has not begun
  // (§6.4). One already under way stays as it is — that presence happened.
  const daAnnullare = prenotazioni.filter((p) => p.annullabile).length;

  return (
    <>
      <h1 className={titoloPagina}>{t.titolo}</h1>
      <p className="mt-6 italic">{t.introduzione}</p>

      {parametri.errore && (
        <p role="alert" className="mt-6 text-errore">
          {t.errore}
        </p>
      )}

      <section className="mt-8 border-t border-linea pt-6">
        <h2 className="text-titolo-sezione font-grassetto">{t.cosaSuccede}</h2>
        <ul className="mt-4 flex flex-col gap-3">
          {t.punti.map((punto) => (
            <li key={punto}>{punto}</li>
          ))}
        </ul>
      </section>

      {daAnnullare > 0 && (
        <p className="mt-8 text-avviso">
          {daAnnullare === 1
            ? t.unaPrenotazioneAnnullata
            : conValori(t.prenotazioniAnnullate, { numero: daAnnullare })}
        </p>
      )}

      <section className="mt-8 border-t border-linea pt-6">
        <p>{t.scarica}</p>
        <p className="mt-4">
          {/* Same link as in the settings: a download, not a page (§7). */}
          <a href="/impostazioni/dati" download>
            {m.impostazioni.diritti.scarica}
          </a>
        </p>
      </section>

      <div className="mt-10 flex flex-wrap items-center gap-4">
        <form action={cancellaAccountAzione}>
          <button type="submit" className={bottoneDistruttivo}>
            {t.conferma}
          </button>
        </form>
        <Link href="/impostazioni" className={bottoneSecondario}>
          {t.annulla}
        </Link>
      </div>
      <p className={aiuto}>{t.definitivo}</p>
    </>
  );
}
