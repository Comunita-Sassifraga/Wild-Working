import Link from "next/link";
import { bottonePrimario } from "./controlli";

/**
 * The reciprocal link between the availability page and "Chi c'è in Valle"
 * — SPEC §6.2 and §6.6, §12 step 7.
 *
 * One component, two shapes, because the two pages ask for different weight
 * (decision of 2026-09-10, written into §6.2):
 *
 *  - `pulsante` on the availability page: the primary-action button of §13.6,
 *    verde fill and `testo` text — never white on green (rule 13). "Chi c'è
 *    in Valle" is the feature that gives the app its value (§1), and it has
 *    to be seen without being looked for.
 *  - `collegamento` on the public page: an ordinary underlined `verde-testo`
 *    link. It sits right under the green band of the title, and a second
 *    green surface against it would read as one block.
 *
 * Neither shape is ever a full-width Stile 2 band: a band is a register
 * (§13.2), and one above the grid would flatten it.
 *
 * The note underneath is always `testo-secondario`, and always says what is
 * on the other side — the link alone would not.
 */

type Forma = "collegamento" | "pulsante";

type Proprieta = {
  href: string;
  etichetta: string;
  nota: string;
  forma?: Forma;
};

export function Rimando({ href, etichetta, nota, forma = "collegamento" }: Proprieta) {
  return (
    <p className="mt-6">
      {/* inline-flex, so the touch target of §13.6 is real: a plain inline
          link ignores a minimum height. */}
      <Link
        href={href}
        className={forma === "pulsante" ? bottonePrimario : "inline-flex min-h-tocco items-center"}
      >
        {etichetta}
      </Link>
      <span className="mt-1 block text-nota text-testo-secondario">{nota}</span>
    </p>
  );
}
