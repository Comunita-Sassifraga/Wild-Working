import Link from "next/link";

/**
 * The reciprocal link between the availability page and "Chi c'è in Valle"
 * — SPEC §6.2 and §6.6, §12 step 7.
 *
 * One shape, two destinations: a plain link with its note underneath, always
 * under the introduction and above the content of the page. Never a Stile 2
 * band — Stile 2 is an accent register (§13.2), and a green band above the
 * grid would take first place away from the main action.
 *
 * On the public page it sits outside the green band, on the cream ground,
 * which is why it can stay `verde-testo` on both pages (§13.6).
 */

type Proprieta = {
  href: string;
  etichetta: string;
  nota: string;
};

export function Rimando({ href, etichetta, nota }: Proprieta) {
  return (
    <p className="mt-6">
      {/* inline-flex, so the touch target of §13.6 is real: a plain inline
          link ignores a minimum height. */}
      <Link href={href} className="inline-flex min-h-tocco items-center">
        {etichetta}
      </Link>
      <span className="mt-1 block text-nota text-testo-secondario">{nota}</span>
    </p>
  );
}
