import type { Metadata } from "next";
import Link from "next/link";
import { m } from "@/lib/messaggi";

/**
 * "Installa sul telefono" — SPEC §12 step 13.
 *
 * Android offers the installation by itself; iPhone never does, and the
 * gesture that does it — share, then "Aggiungi a Home" — is not something
 * one guesses. Since §14.1 turns on iPhone users being able to use this app
 * at all, the instructions are written down rather than assumed.
 *
 * Two lists and nothing else: no detection of which phone is reading, which
 * would be wrong exactly for the person holding an unusual one.
 */

export const metadata: Metadata = { title: m.installa.titolo };

function Passi({ titolo, passi }: { titolo: string; passi: readonly string[] }) {
  return (
    <section className="mt-10 border-t border-linea pt-6">
      <h2 className="text-titolo-sezione font-grassetto">{titolo}</h2>
      <ol className="mt-4 flex list-decimal flex-col gap-3 pl-6">
        {passi.map((passo) => (
          <li key={passo}>{passo}</li>
        ))}
      </ol>
    </section>
  );
}

export default function Installa() {
  const t = m.installa;
  return (
    <>
      <h1 className="text-titolo-pagina font-grassetto grande:text-titolo-pagina-grande">
        {t.titolo}
      </h1>
      <p className="mt-6 italic">{t.introduzione}</p>

      <Passi titolo={t.iphone.titolo} passi={t.iphone.passi} />
      <Passi titolo={t.android.titolo} passi={t.android.passi} />

      <p className="mt-10 text-nota text-testo-secondario">{t.nota}</p>
      <p className="mt-8">
        <Link href="/" className="inline-flex min-h-tocco items-center">
          {t.torna}
        </Link>
      </p>
    </>
  );
}
