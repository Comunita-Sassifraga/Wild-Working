import { URL_INFORMATIVA_PRIVACY, URL_SITO } from "@/config/limits";
import { m } from "@/lib/messaggi";

// Footer — SPEC §13.8: the same institutional details as the site, plus the
// links to the app's privacy notice and to the main site.
export function PieDiPagina() {
  const t = m.pieDiPagina;
  return (
    <footer className="border-t border-linea">
      <div className="mx-auto flex max-w-contenuto flex-col gap-2 px-4 py-8 text-nota text-testo-secondario">
        <p>{t.denominazione}</p>
        <p>{t.dati}</p>
        <p>
          <a href={`mailto:${t.email}`}>{t.email}</a>
        </p>
        <p className="flex flex-wrap gap-6">
          <a href={URL_INFORMATIVA_PRIVACY}>{t.informativa}</a>
          <a href={URL_SITO}>{t.sito}</a>
        </p>
      </div>
    </footer>
  );
}
