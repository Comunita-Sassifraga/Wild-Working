import { notFound } from "next/navigation";
import { sonoAmministratore } from "@/lib/auth/ruoli";
import { utenteAttuale } from "@/lib/auth/sessione";
import type { Client } from "@/lib/db/client";
import { clientServer } from "@/lib/db/server";

/**
 * The door of the panel — SPEC §6.7, §4.
 *
 * Every page and every Server Action of `app/amministrazione` starts here.
 * It is not what protects the data: each table, view and function the panel
 * touches is closed by its own access policy, and a page written wrong would
 * still come back empty (§8.3, rule 2). This exists so that someone who is
 * not an amministratore gets "pagina non trovata" rather than a screen full
 * of empty lists — and so the panel does not advertise its own existence.
 */
export async function amministratore(): Promise<{ client: Client; id: string }> {
  const [utente, client] = await Promise.all([utenteAttuale(), clientServer()]);
  if (!utente || !(await sonoAmministratore(client))) notFound();
  return { client, id: utente.id };
}
