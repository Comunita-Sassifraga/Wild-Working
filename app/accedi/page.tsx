import { redirect } from "next/navigation";
import { bottonePrimario, campo } from "@/components/controlli";
import { URL_INFORMATIVA_PRIVACY, VALIDITA_LINK_MINUTI } from "@/config/limits";
import { utenteAttuale } from "@/lib/auth/sessione";
import { conValori, m } from "@/lib/messaggi";
import { inviaLink } from "./azioni";

// Sign-in page — SPEC §6.1, dressed with the tokens of §13 (Stile 1). The
// "email sent" state stays in Stile 1 too: the green register is kept for
// booking confirmations and empty states (§13.2).

type Props = {
  searchParams: Promise<{ stato?: string; errore?: string; motivo?: string }>;
};

const titolo = "text-titolo-pagina font-grassetto grande:text-titolo-pagina-grande";

export default async function PaginaAccedi({ searchParams }: Props) {
  if (await utenteAttuale()) redirect("/");

  const { stato, errore, motivo } = await searchParams;
  const t = m.accesso;
  const minuti = { minuti: VALIDITA_LINK_MINUTI };

  if (stato === "inviato") {
    return (
      <>
        <h1 className={titolo}>{t.titolo}</h1>
        <p className="mt-6">{conValori(t.inviato, minuti)}</p>
      </>
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
    <>
      <h1 className={titolo}>{t.titolo}</h1>
      <p className="mt-6">{t.introduzione}</p>
      {avviso && (
        <p role="alert" className="mt-6 text-errore">
          {avviso}
        </p>
      )}
      <form action={inviaLink} className="mt-8 flex flex-col gap-6">
        <p>
          <label htmlFor="email" className="mb-2 block">
            {t.etichettaEmail}
          </label>
          <input
            id="email"
            name="email"
            type="email"
            inputMode="email"
            autoComplete="email"
            required
            className={campo}
          />
        </p>
        <p className="text-nota">
          <a href={URL_INFORMATIVA_PRIVACY}>{t.informativa}</a>
        </p>
        <p className="text-nota text-testo-secondario">{t.consenso}</p>
        <p>
          <button type="submit" className={bottonePrimario}>
            {t.invia}
          </button>
        </p>
      </form>
    </>
  );
}
