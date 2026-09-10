import { redirect } from "next/navigation";
import { URL_INFORMATIVA_PRIVACY, VALIDITA_LINK_MINUTI } from "@/config/limits";
import { utenteAttuale } from "@/lib/auth/sessione";
import { conValori, m } from "@/lib/messaggi";
import { inviaLink } from "./azioni";

// Sign-in page — SPEC §6.1. Deliberately unstyled: the visual tokens are
// wired into Tailwind at step 3 of §12, and this page is dressed there. No
// colour, size or class here, so rule 12 holds by construction.

type Props = {
  searchParams: Promise<{ stato?: string; errore?: string; motivo?: string }>;
};

export default async function PaginaAccedi({ searchParams }: Props) {
  if (await utenteAttuale()) redirect("/");

  const { stato, errore, motivo } = await searchParams;
  const t = m.accesso;
  const minuti = { minuti: VALIDITA_LINK_MINUTI };

  if (stato === "inviato") {
    return (
      <main>
        <h1>{t.titolo}</h1>
        <p>{conValori(t.inviato, minuti)}</p>
      </main>
    );
  }

  const avviso =
    motivo === "link"
      ? conValori(t.linkNonValido, minuti)
      : errore === "email"
        ? t.emailNonValida
        : errore === "invio"
          ? t.invioFallito
          : null;

  return (
    <main>
      <h1>{t.titolo}</h1>
      <p>{t.introduzione}</p>
      {avviso && <p role="alert">{avviso}</p>}
      <form action={inviaLink}>
        <p>
          <label htmlFor="email">{t.etichettaEmail}</label>
          <input id="email" name="email" type="email" inputMode="email" autoComplete="email" required />
        </p>
        <p>
          <a href={URL_INFORMATIVA_PRIVACY}>{t.informativa}</a>
        </p>
        <p>{t.consenso}</p>
        <button type="submit">{t.invia}</button>
      </form>
    </main>
  );
}
