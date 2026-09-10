import Link from "next/link";
import { prenotazioniDaVerificare } from "@/lib/db/amministrazione";
import { conValori, m } from "@/lib/messaggi";
import { amministratore } from "./guardia";
import { Elenco, Riga, Sezione, Vuoto, aiuto, introduzione, titoloPagina } from "./parti";

/**
 * The panel — SPEC §6.7, §12 step 8.
 *
 * The index does two things: it names every screen, and it says straight
 * away how many bookings a change has left behind (§8.2, §8.4). That number
 * is the only thing in the whole panel that asks for attention, so it is the
 * only thing that is not a link to somewhere else.
 *
 * The two voices at the foot are deliberately switched off: SPEC §6.7 lists
 * statistics and account deletion among the panel's jobs, but §12 builds
 * them at steps 12 and 10. Naming them here, spent, is how they stay visible
 * without pretending to exist.
 */

const t = m.amministrazione;

function Voce({ href, titolo, nota }: { href: string; titolo: string; nota: string }) {
  return (
    <Riga>
      <Link href={href} className="font-grassetto">
        {titolo}
      </Link>
      <span className={`${aiuto} block`}>{nota}</span>
    </Riga>
  );
}

export default async function PaginaAmministrazione() {
  const { client } = await amministratore();
  const daVerificare = await prenotazioniDaVerificare(client);

  const quante =
    daVerificare.length === 1
      ? t.daVerificare.unaSola
      : conValori(t.daVerificare.quante, { numero: daVerificare.length });

  return (
    <>
      <h1 className={titoloPagina}>{t.titolo}</h1>
      <p className={introduzione}>{t.introduzione}</p>

      <Elenco>
        <Voce href="/amministrazione/sedi" titolo={t.voci.sedi} nota={t.voci.sediNota} />
        <Voce
          href="/amministrazione/incarichi"
          titolo={t.voci.incarichi}
          nota={t.voci.incarichiNota}
        />
        <Voce
          href="/amministrazione/moderazione"
          titolo={t.voci.moderazione}
          nota={t.voci.moderazioneNota}
        />
        <Voce href="/amministrazione/termini" titolo={t.voci.termini} nota={t.voci.terminiNota} />
      </Elenco>

      <Sezione titolo={t.daVerificare.titolo}>
        {daVerificare.length === 0 ? (
          <Vuoto testo={t.daVerificare.nessuna} />
        ) : (
          <>
            <p className="mt-4 text-avviso">{quante}</p>
            <p className="mt-4">{t.daVerificare.introduzione}</p>
            <Elenco>
              {daVerificare.map((p) => (
                <Riga key={p.id}>
                  <Link href={`/amministrazione/sedi/${p.sedeId}`} className="font-grassetto">
                    {p.sedeNome}
                  </Link>
                  <span className={`${aiuto} block`}>{t.daVerificare.motivi[p.motivo]}</span>
                </Riga>
              ))}
            </Elenco>
          </>
        )}
      </Sezione>

      <Sezione titolo={t.piuAvanti.titolo}>
        <ul className="mt-4">
          <li className="text-testo-secondario">{t.piuAvanti.statistiche}</li>
          <li className="mt-2 text-testo-secondario">{t.piuAvanti.cancellazione}</li>
        </ul>
      </Sezione>

      <p className="mt-10">
        <Link href="/">{m.prenotazioni.vuoto.collegamento}</Link>
      </p>
    </>
  );
}
