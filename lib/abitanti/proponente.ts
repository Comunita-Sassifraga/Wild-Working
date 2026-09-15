/**
 * What is handed to the abitante who proposes an activity — SPEC §15.9,
 * «L'elenco degli iscritti, e cosa si passa al proponente».
 *
 * The rule is explicit, and it is the reason this file is separate from the
 * screen that shows it: **what goes to the proponente contains no email
 * address.** The application does not know the participants' real names; it
 * knows an address, which is there to write to and for nothing else, and it
 * knows the `nome_pubblico` of whoever chose to have one. So what comes out
 * of here is the sentence of §6.6, and only that:
 *
 *   «Sabato vengono in otto. Tre hanno lasciato il nome: Luca, Anna, Fabio.»
 *
 * If Maria needs the real names of all eight, that happens outside this
 * application, on the VIHTA list the association keeps for the residency. It
 * is a separate processing of the association's, exactly like the paper
 * register of D10 — and it is why no "name" field is being added to anybody's
 * profile to solve it (§15.9, rule 1).
 *
 * A pure function over what the panel already read: which names it is
 * allowed to see was decided by `iscritti_amministrazione`, which returns a
 * name only for whoever switched it on (rule 3). Nothing is decided again
 * here.
 */

import { dataEstesa, type DataISO } from "@/lib/dates";
import type { Iscritto } from "@/lib/db/iscritti";
import { conValori, m } from "@/lib/messaggi";

const t = m.amministrazione.attivita.iscritti.proponente;

/**
 * The numbers written out, because §15.9 writes them out: «Sabato vengono in
 * otto. Tre hanno lasciato il nome…». It is a sentence somebody reads to
 * Maria on the telephone or pastes into a message, not a figure in a table,
 * and «vengono in 8» reads like a receipt.
 *
 * Up to twenty, then the tens, which is far past what this ever has to say:
 * an edition is forty-five people and an activity a handful of them. Beyond
 * ninety-nine it falls back to the figure rather than growing a grammar.
 */
const PAROLE = [
  // "uno" and not "una": one person is never counted through here — the
  // templates say «viene una persona» and «una persona ha lasciato il nome»
  // in words of their own — and this value is only ever reached inside
  // twenty-one, thirty-one and their like.
  "zero", "uno", "due", "tre", "quattro", "cinque", "sei", "sette", "otto", "nove", "dieci",
  "undici", "dodici", "tredici", "quattordici", "quindici", "sedici", "diciassette", "diciotto",
  "diciannove", "venti",
];
const DECINE = ["", "", "venti", "trenta", "quaranta", "cinquanta", "sessanta", "settanta", "ottanta", "novanta"];

function inLettere(n: number): string {
  if (n <= 20) return PAROLE[n];
  if (n > 99) return String(n);
  const decina = DECINE[Math.floor(n / 10)];
  const unita = n % 10;
  if (unita === 0) return decina;
  // Venti + uno = ventuno, quaranta + otto = quarantotto: the tens drop their
  // last vowel before a vowel.
  const tronca = unita === 1 || unita === 8 ? decina.slice(0, -1) : decina;
  return `${tronca}${PAROLE[unita]}`;
}

/**
 * The sentence, in one or two lines.
 *
 * Counts every ATTIVA place and names only those who left a name — the two
 * numbers must add up to the people who will be in the room, which is the
 * one thing the abitante actually needs from it. Cancelled iscrizioni are not
 * in it: they are not coming.
 *
 * A card with no date yet says "A questa attività" instead of a day: half a
 * card is a valid card (§15.3.2), and an activity being organised is exactly
 * when somebody asks how many people are coming.
 */
export function frasePerProponente(
  iscritti: readonly Iscritto[],
  data: DataISO | null,
): string {
  const attivi = iscritti.filter((i) => i.stato === "ATTIVA");
  const nomi = attivi
    .flatMap((i) => (i.nomePubblico ? [i.nomePubblico] : []))
    .sort((a, b) => a.localeCompare(b, "it"));

  const giorno = data ? maiuscola(dataEstesa(data)) : t.senzaGiorno;

  const quanti =
    attivi.length === 0
      ? conValori(t.nessuno, { giorno })
      : attivi.length === 1
        ? conValori(t.unaSola, { giorno })
        : conValori(t.riga, { giorno, quanti: inLettere(attivi.length) });

  if (nomi.length === 0) return quanti;

  const elenco = nomi.join(m.chiCe.riga.separatore);
  const parte =
    nomi.length === 1
      ? conValori(t.unNome, { nomi: elenco })
      : conValori(t.nomi, { quanti: maiuscola(inLettere(nomi.length)), nomi: elenco });

  return `${quanti} ${parte}`;
}

/** "sabato 26 settembre" opens a sentence, so it opens it in upper case. */
function maiuscola(testo: string): string {
  return testo.charAt(0).toLocaleUpperCase("it") + testo.slice(1);
}
