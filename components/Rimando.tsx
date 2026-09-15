import Link from "next/link";
import { bottonePrimario, notaControllo } from "./controlli";

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
 * The note is always `testo-secondario`, and always says what is on the other
 * side — the link alone would not. It stands **above** the control since
 * 2026-09-15 (§6.2, §6.6), at the distance `notaControllo` fixes, which is the
 * same one the entry of §15.5 keeps below its own line: the two blocks of the
 * availability page are built the same way round, and the public page stays
 * the mirror of it.
 *
 * It carries one control and no more. Between 2026-09-13 and 2026-09-15 it
 * could take a second one on the same line, the entry to «Prenota un
 * abitante» of §15.5; that entry now stands below this block with a line of
 * its own (§6.2), and draws itself in app/page.tsx.
 */

type Forma = "collegamento" | "pulsante";

type Proprieta = {
  href: string;
  etichetta: string;
  nota: string;
  forma?: Forma;
};

export function Rimando({ href, etichetta, nota, forma = "collegamento" }: Proprieta) {
  // inline-flex, so the touch target of §13.6 is real: a plain inline link
  // ignores a minimum height.
  return (
    <p className="mt-6">
      <span className={notaControllo}>{nota}</span>
      <Link
        href={href}
        className={forma === "pulsante" ? bottonePrimario : "inline-flex min-h-tocco items-center"}
      >
        {etichetta}
      </Link>
    </p>
  );
}
