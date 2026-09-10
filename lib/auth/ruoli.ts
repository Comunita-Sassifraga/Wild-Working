/**
 * Roles — SPEC §4, §5.6.
 *
 * The answer comes from the database function the access policies themselves
 * use, so a page and a policy can never disagree about who is an
 * amministratore. Nothing here grants anything: every table and view the
 * panel touches is closed by RLS as well (§8.3). This check exists so that
 * the panel can answer "pagina non trovata" instead of an empty screen.
 */

import type { Client } from "@/lib/db/client";

export async function sonoAmministratore(client: Client): Promise<boolean> {
  const { data, error } = await client.rpc("is_amministratore");
  return !error && data === true;
}
