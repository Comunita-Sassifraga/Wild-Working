import Link from "next/link";
import { utenteAttuale } from "@/lib/auth/sessione";
import { m } from "@/lib/messaggi";
import { esciAzione } from "./accedi/azioni";

// Placeholder home page, so that sign-in has somewhere to land. The
// availability view replaces it at step 4 of SPEC §12. Unstyled on purpose
// (see app/accedi/page.tsx).
export default async function Home() {
  const utente = await utenteAttuale();
  return (
    <main>
      <h1>{m.home.titolo}</h1>
      {utente ? (
        <>
          <p>{m.home.collegato}</p>
          <form action={esciAzione}>
            <button type="submit">{m.home.esci}</button>
          </form>
        </>
      ) : (
        <>
          <p>{m.home.nonCollegato}</p>
          <p>
            <Link href="/accedi">{m.home.entra}</Link>
          </p>
        </>
      )}
    </main>
  );
}
