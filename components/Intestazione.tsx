import Image from "next/image";
import { URL_SITO } from "@/config/limits";
import { forma } from "@/config/tokens";
import { m } from "@/lib/messaggi";
import logo from "@/public/logo.png";

// Header — SPEC §13.8. Logo and "Comunità Sassifraga" on the left, as on
// the site; the logo links back to the institutional site. Flat: sfondo
// background and one hairline rule below, no shadow.
//
// The logo is the official PNG until the vector version of §13.10 arrives:
// it is drawn at the `logo` token height, and Next serves it resized.
export function Intestazione() {
  const altezza = forma.larghezze.logo;
  const larghezza = Math.round((altezza * logo.width) / logo.height);
  return (
    <header className="border-b border-linea bg-sfondo">
      <div className="mx-auto flex max-w-contenuto items-center px-4 py-3">
        <a
          href={URL_SITO}
          className="inline-flex min-h-tocco items-center gap-3 text-testo no-underline"
        >
          <Image src={logo} alt="" width={larghezza} height={altezza} className="h-logo w-auto" priority />
          <span className="font-grassetto">{m.intestazione.nome}</span>
        </a>
      </div>
    </header>
  );
}
