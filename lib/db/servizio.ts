/**
 * The backend client — SPEC §12 step 9, step 11.
 *
 * Bypasses RLS, so it is built here and used only where no signed-in person
 * could do the work: the reminder job (§6.3) and the notice to a person whose
 * public name has been cleared, whose address the amministratore must never
 * see (§6.5, §6.7).
 *
 * Never call this from a page or from an action that serves a request on
 * somebody's behalf: those go through `clientServer()`, under the RLS
 * identity of whoever is signed in.
 */

import { envServizio } from "@/lib/env";
import { clientServizio, type Client } from "./client";

export function clientDiServizio(): Client {
  const { url, serviceRoleKey } = envServizio();
  return clientServizio(url, serviceRoleKey);
}
