/**
 * The list handed to the abitante who proposes the activity — SPEC §15.9,
 * «L'elenco degli iscritti, e cosa si passa al proponente».
 *
 * A Route Handler and not a page, because what is asked for is a file: an
 * ordinary link, a GET, and the browser saves it. Like everything else here
 * it works with JavaScript switched off.
 *
 * It is not under `/api/`: that path belongs to the scheduled jobs, which are
 * protected by a shared secret and serve nobody's request. This one hangs off
 * the screen it is reached from and is bound to the session cookie — and the
 * view behind it answers an amministratore and nobody else (§8.3).
 *
 * **No email address goes into this file**, and that is the whole rule of
 * §15.9: what the application knows is an address, which is there to write
 * to, and a `nome_pubblico` for whoever chose to have one. So the file
 * carries the sentence of §6.6 and the day, and nothing more. Giving Maria
 * everybody's real name is done outside this application, on the VIHTA list
 * the association keeps for the residency.
 *
 * Nothing is logged, and no name reaches the file name (rule 4): a downloads
 * folder is a place other people look at.
 */

import { notFound } from "next/navigation";
import { sonoAmministratore } from "@/lib/auth/ruoli";
import { utenteAttuale } from "@/lib/auth/sessione";
import { frasePerProponente } from "@/lib/abitanti/proponente";
import { oggiRoma, type DataISO } from "@/lib/dates";
import { attivitaSingola } from "@/lib/db/attivita";
import { iscrittiAttivita } from "@/lib/db/iscritti";
import { clientServer } from "@/lib/db/server";
import { m } from "@/lib/messaggi";

export const dynamic = "force-dynamic";

export async function GET(
  _richiesta: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  const [utente, client, { id }] = await Promise.all([
    utenteAttuale(),
    clientServer(),
    params,
  ]);
  // The same door as every page of the panel: not what protects the data,
  // but what stops a non-amministratore being shown an empty file instead of
  // "pagina non trovata" (§6.7).
  if (!utente || !(await sonoAmministratore(client))) notFound();

  const attivita = await attivitaSingola(client, id);
  if (!attivita?.id) notFound();

  const iscritti = await iscrittiAttivita(client, attivita.id);

  const titolo = attivita.titolo ?? m.amministrazione.attivita.senzaTitolo;
  const corpo = `${titolo}\n\n${frasePerProponente(iscritti, (attivita.data as DataISO | null) ?? null)}\n`;

  return new Response(corpo, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Content-Disposition": `attachment; filename="iscritti-${oggiRoma()}.txt"`,
      // A list of who is going to somebody's house must not sit in a cache
      // along the way, nor come back out of the browser's history.
      "Cache-Control": "no-store, private",
    },
  });
}
