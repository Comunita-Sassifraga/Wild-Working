import type { Metadata } from "next";
import { PresenzeSede } from "@/components/PresenzeSede";
import { Rimando } from "@/components/Rimando";
import { FINESTRA_GIORNI } from "@/config/limits";
import { disponibilitaPubblica, sediPubbliche } from "@/lib/db/disponibilita";
import { presenzePubbliche } from "@/lib/db/presenze";
import { clientServer } from "@/lib/db/server";
import { presenzePerSede } from "@/lib/presenze";
import { conValori, m } from "@/lib/messaggi";

/**
 * "Chi c'è in Valle" — SPEC §6.6, §12 step 7. Readable without signing in,
 * and made to be shared: a link from a message or a story lands here.
 *
 * This is the ONLY page in the app where a nome_pubblico appears (rule 8).
 * The grid of §6.2 stops at counts; adding names to it would erase the
 * reason this page exists.
 *
 * It never shows the past, and never more than the bookable window: both
 * are decided inside `presenze_pubbliche` and `disponibilita_pubblica`, so
 * the limit holds whatever this page does (§8.3).
 *
 * The green band of §13.2 carries the title and the introduction. The link
 * back to the availability page sits under it, on the cream ground, so it
 * stays `verde-testo` like every other link (§6.6, §13.6).
 */

export const metadata: Metadata = {
  title: m.chiCe.titolo,
  description: m.chiCe.descrizione,
};

export default async function ChiCeInValle() {
  const client = await clientServer();
  const [sedi, celle, presenze] = await Promise.all([
    sediPubbliche(client),
    disponibilitaPubblica(client),
    presenzePubbliche(client),
  ]);

  const t = m.chiCe;
  const perSede = presenzePerSede(sedi, celle, presenze);
  const qualcuno = perSede.some((s) => s.giorni.length > 0);

  return (
    <>
      <section className="bg-verde px-6 py-8 text-testo">
        <h1 className="text-titolo-pagina font-grassetto grande:text-titolo-pagina-grande">
          {t.titolo}
        </h1>
        <p className="mt-4 italic">{conValori(t.introduzione, { giorni: FINESTRA_GIORNI })}</p>
      </section>

      <Rimando href="/" etichetta={t.rimando} nota={t.rimandoNota} />

      {qualcuno ? (
        perSede.map((presenza) => <PresenzeSede key={presenza.sede.id} presenza={presenza} />)
      ) : (
        <section className="mt-10 bg-verde px-6 py-8 text-testo">
          <h2 className="text-titolo-sezione font-grassetto">{t.vuoto.titolo}</h2>
          <p className="mt-4">{t.vuoto.testo}</p>
        </section>
      )}
    </>
  );
}
