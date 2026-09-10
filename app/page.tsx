import Link from "next/link";
import { bottonePrimario } from "@/components/controlli";
import { utenteAttuale } from "@/lib/auth/sessione";
import { m } from "@/lib/messaggi";
import { esciAzione } from "./accedi/azioni";

// Placeholder home page, so that sign-in has somewhere to land. The
// availability view replaces it at step 4 of SPEC §12.
export default async function Home() {
  const utente = await utenteAttuale();
  return (
    <>
      <h1 className="text-titolo-pagina font-grassetto grande:text-titolo-pagina-grande">{m.home.titolo}</h1>
      {utente ? (
        <>
          <p className="mt-6">{m.home.collegato}</p>
          <form action={esciAzione} className="mt-8">
            {/* Primary on purpose, like "Entra": the maintainer wants the two
                buttons of this placeholder page to match. */}
            <button type="submit" className={bottonePrimario}>
              {m.home.esci}
            </button>
          </form>
        </>
      ) : (
        <>
          <p className="mt-6">{m.home.nonCollegato}</p>
          <p className="mt-8">
            <Link href="/accedi" className={bottonePrimario}>
              {m.home.entra}
            </Link>
          </p>
        </>
      )}
    </>
  );
}
