import Link from "next/link";
import { bottoneSecondario } from "@/components/controlli";
import { dataEstesa, ora } from "@/lib/dates";
import { iscrizioniDaVerificare, prenotazioniDaVerificare } from "@/lib/db/amministrazione";
import { conValori, m } from "@/lib/messaggi";
import { amministratore } from "./guardia";
import {
  Elenco,
  Riga,
  Sezione,
  Vuoto,
  aiuto,
  introduzione,
  titoloPagina,
  titoloSezione,
} from "./parti";

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
  const [daVerificare, iscrizioniDaControllare] = await Promise.all([
    prenotazioniDaVerificare(client),
    iscrizioniDaVerificare(client),
  ]);

  const quante =
    daVerificare.length === 1
      ? t.daVerificare.unaSola
      : conValori(t.daVerificare.quante, { numero: daVerificare.length });

  const i = t.daVerificare.iscrizioni;
  const quanteIscrizioni =
    iscrizioniDaControllare.length === 1
      ? i.unaSola
      : conValori(i.quante, { numero: iscrizioniDaControllare.length });

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

      {/*
        «Prenota un abitante» is a second service inside the same application
        (§15.1), so its screens sit in a section of their own rather than
        among the coworking ones: somebody looking after sedi and referenti
        should not have to read past them.
      */}
      <Sezione titolo={t.abitanti.titolo}>
        <p className={introduzione}>{t.abitanti.introduzione}</p>
        <Elenco>
          <Voce
            href="/amministrazione/edizioni"
            titolo={t.voci.edizioni}
            nota={t.voci.edizioniNota}
          />
          <Voce
            href="/amministrazione/attivita"
            titolo={t.voci.attivita}
            nota={t.voci.attivitaNota}
          />
          <Voce href="/amministrazione/codici" titolo={t.voci.codici} nota={t.voci.codiciNota} />
          <Voce
            href="/amministrazione/abilitazioni"
            titolo={t.voci.abilitazioni}
            nota={t.voci.abilitazioniNota}
          />
        </Elenco>
      </Sezione>

      <Sezione titolo={t.daVerificare.titolo}>
        {daVerificare.length === 0 && iscrizioniDaControllare.length === 0 ? (
          <Vuoto testo={t.daVerificare.nessuna} />
        ) : (
          <>
            {daVerificare.length > 0 && (
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

            {/*
              The same list takes the iscrizioni a change has left behind
              (§6.7, §15.12) — a capienza lowered under the number of people
              signed up, or an activity returned to BOZZA. Same discipline as
              above: it shows, a person decides, nothing is cancelled here
              (rule 6). The address to write to is on the row, because that
              is the whole point of the list.
            */}
            {iscrizioniDaControllare.length > 0 && (
              <>
                <h3 className={`${titoloSezione} mt-8`}>{i.titolo}</h3>
                <p className="mt-4 text-avviso">{quanteIscrizioni}</p>
                <p className="mt-4">{i.introduzione}</p>
                <Elenco>
                  {iscrizioniDaControllare.map((riga) => (
                    <Riga key={riga.id}>
                      <Link
                        href={`/amministrazione/attivita/${riga.attivitaId}/iscritti`}
                        className="font-grassetto"
                      >
                        {riga.titolo ?? i.senzaTitolo}
                      </Link>
                      <span className={`${aiuto} block`}>
                        {riga.data && `${dataEstesa(riga.data)} · `}
                        {riga.oraInizio && `${conValori(i.orario, { orario: ora(riga.oraInizio) })} · `}
                        {i.motivi[riga.motivo]}
                      </span>
                      {riga.email && (
                        <span className={`${aiuto} block`}>
                          {t.daVerificare.scriviA}{" "}
                          <a href={`mailto:${riga.email}`}>{riga.email}</a>
                        </span>
                      )}
                    </Riga>
                  ))}
                </Elenco>
              </>
            )}
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
        <Link href="/" className={bottoneSecondario}>
          {m.prenotazioni.vuoto.collegamento}
        </Link>
      </p>
    </>
  );
}
