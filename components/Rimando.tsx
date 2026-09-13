import Link from "next/link";
import type { ReactNode } from "react";
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
 *
 * `accanto` puts a second control on the same line, to the right: the entry
 * to «Prenota un abitante» of §15.5, decided so on 2026-09-13. Only the link
 * on the left carries a note — the entry of §15.5 is the button and nothing
 * else.
 */

type Forma = "collegamento" | "pulsante";

type Proprieta = {
  href: string;
  etichetta: string;
  nota: string;
  forma?: Forma;
  /**
   * A second control on the same line, to the right — the entry to «Prenota
   * un abitante» of §15.5, and nothing else so far. It carries no note of
   * its own: the note below belongs to the link on the left and says what is
   * on the other side of *that* one. On a narrow screen the two wrap, and
   * the note stays under the link it describes.
   */
  accanto?: ReactNode;
};

export function Rimando({ href, etichetta, nota, forma = "collegamento", accanto }: Proprieta) {
  // inline-flex, so the touch target of §13.6 is real: a plain inline link
  // ignores a minimum height.
  const collegamento = (
    <Link
      href={href}
      className={forma === "pulsante" ? bottonePrimario : "inline-flex min-h-tocco items-center"}
    >
      {etichetta}
    </Link>
  );

  if (!accanto) {
    return (
      <p className="mt-6">
        {collegamento}
        <span className="mt-1 block text-nota text-testo-secondario">{nota}</span>
      </p>
    );
  }

  return (
    <div className="mt-6 flex flex-wrap items-start gap-4">
      <p>
        {collegamento}
        <span className="mt-1 block text-nota text-testo-secondario">{nota}</span>
      </p>
      {accanto}
    </div>
  );
}
