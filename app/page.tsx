import Link from "next/link";
import { redirect } from "next/navigation";
import { Calendario } from "@/components/Calendario";
import { AvvisoCopiaLocale } from "@/components/CopiaLocale";
import { Rimando } from "@/components/Rimando";
import { SediFuoriPeriodo } from "@/components/SediFuoriPeriodo";
import { TabellaGiorno } from "@/components/TabellaGiorno";
import { bottoneSecondario } from "@/components/controlli";
import { FINESTRA_GIORNI } from "@/config/limits";
import { sonoAmministratore } from "@/lib/auth/ruoli";
import { utenteAttuale } from "@/lib/auth/sessione";
import { istanteGenerazione, settimaneCalendario } from "@/lib/dates";
import { apertureFuture, disponibilitaPubblica, sediPubbliche } from "@/lib/db/disponibilita";
import { clientServer } from "@/lib/db/server";
import { celleDelGiorno, giorniDelCalendario, giornoScelto } from "@/lib/disponibilita";
import { conValori, m } from "@/lib/messaggi";
import { esciAzione } from "./accedi/azioni";

/**
 * Availability — SPEC §6.2, §12 step 4. Readable without signing in:
 * registering is only needed to book.
 *
 * The chosen day travels in the address (`/?data=…`), so every day has a
 * shareable address and the page stays entirely server-rendered: choosing a
 * day is an ordinary link, and the page works with JavaScript switched off.
 *
 * Counts only. The names of the people who made their presence public belong
 * to "Chi c'è in Valle" and never appear here (rule 8). The link to that page
 * sits under the introduction and above the calendar (§6.2): from a phone the
 * grid is long, and a link at the end of it would go unseen — and it is right
 * there that the question comes up, reading "2 hanno reso pubblica la
 * presenza" and wanting to know who they are.
 */

export default async function Home({
  searchParams,
}: {
  searchParams: Promise<{ data?: string | string[]; cancellato?: string | string[] }>;
}) {
  const [utente, client, parametri] = await Promise.all([
    utenteAttuale(),
    clientServer(),
    searchParams,
  ]);
  const [sedi, celle, aperture, amministratore] = await Promise.all([
    sediPubbliche(client),
    disponibilitaPubblica(client),
    apertureFuture(client),
    utente ? sonoAmministratore(client) : Promise.resolve(false),
  ]);

  const settimane = settimaneCalendario();
  const giorni = giorniDelCalendario(celle, settimane);
  const richiesta = Array.isArray(parametri.data) ? parametri.data[0] : parametri.data;
  const scelto = giornoScelto(giorni, richiesta);

  // An address that asks for a day that does not exist, or that nobody can
  // book — a past day, a closed one, one beyond the window — falls back to
  // the default view. It also loses the date it asked for: an address bar
  // that still said `?data=test` while the page showed today would be
  // claiming something untrue, and a link shared from here would carry the
  // lie along.
  if (richiesta !== undefined && richiesta !== scelto) redirect("/");

  const celleGiorno = celleDelGiorno(celle, scelto);
  const inStagione = (sedeId: string) =>
    celleGiorno.some((c) => c.sedeId === sedeId && c.inStagione);
  const sediAperte = sedi.filter((s) => inStagione(s.id));
  const sediFuoriPeriodo = sedi.filter(
    (s) => !inStagione(s.id) && celleGiorno.some((c) => c.sedeId === s.id),
  );
  const qualcosaDiAperto = celleGiorno.some((c) => c.prenotabile);

  const t = m.disponibilita;
  const generata = istanteGenerazione();

  return (
    <>
      {/* Above everything, because it is about everything below it: this is
          the page the browser keeps a copy of, and offline the copy is what
          is on screen (§8.4). The notice stays out of the introduction →
          link → grid order §6.2 fixes. */}
      <AvvisoCopiaLocale generatoIl={generata.iso} quando={generata.esteso} />

      <h1 className="text-titolo-pagina font-grassetto grande:text-titolo-pagina-grande">
        {m.home.titolo}
      </h1>
      <p className="mt-6 italic">{conValori(t.introduzione, { giorni: FINESTRA_GIORNI })}</p>

      {/* Where a person lands after erasing their account (§7, step 10). The
          app starts here, and here there is nothing left of them to show. */}
      {parametri.cancellato !== undefined && (
        <p role="status" className="mt-6">
          {m.home.cancellato}
        </p>
      )}

      <Rimando
        href="/chi-ce-in-valle"
        etichetta={t.rimandoChiCe}
        nota={t.rimandoChiCeNota}
        forma="pulsante"
      />

      {utente ? (
        <form action={esciAzione} className="mt-6 flex flex-wrap items-center gap-4">
          <span>{m.home.collegato}</span>
          <Link href="/prenotazioni">{m.home.miePrenotazioni}</Link>
          <Link href="/impostazioni">{m.home.impostazioni}</Link>
          {/* The panel names itself only to the people who have it (§6.7). */}
          {amministratore && <Link href="/amministrazione">{m.home.amministrazione}</Link>}
          <button type="submit" className={bottoneSecondario}>
            {m.home.esci}
          </button>
        </form>
      ) : (
        <p className="mt-6">
          {m.home.nonCollegato} <Link href="/accedi">{m.home.entra}</Link>
        </p>
      )}

      <Calendario settimane={settimane} giorni={giorni} scelto={scelto} />

      {qualcosaDiAperto ? (
        <TabellaGiorno data={scelto} sedi={sediAperte} celle={celleGiorno} />
      ) : (
        <section className="mt-8 bg-verde px-6 py-8 text-testo">
          <h2 className="text-titolo-sezione font-grassetto">{t.nessunaSede.titolo}</h2>
          <p className="mt-4">{t.nessunaSede.testo}</p>
        </section>
      )}

      <SediFuoriPeriodo sedi={sediFuoriPeriodo} aperture={aperture} />
    </>
  );
}
