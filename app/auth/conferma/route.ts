import { redirect } from "next/navigation";
import type { NextRequest } from "next/server";
import { isTipoLink, verificaLink } from "@/lib/auth/accesso";
import { clientServer } from "@/lib/db/server";

/**
 * Landing point of the email link — SPEC §6.1 point 4, §8.4.
 * The email carries `token_hash` and `type`; the token is verified here,
 * server-side, and the session cookie is set on the redirect. A used or
 * expired link sends the person back to the sign-in page with a clear
 * message and the form to ask for another.
 */
export async function GET(request: NextRequest): Promise<never> {
  const parametri = request.nextUrl.searchParams;
  const tokenHash = parametri.get("token_hash");
  const tipo = parametri.get("type");

  if (!tokenHash || !isTipoLink(tipo)) redirect("/accedi?motivo=link");

  const client = await clientServer();
  const esito = await verificaLink(client, { tokenHash, tipo });
  if (!esito.ok) redirect("/accedi?motivo=link");

  // esito.primoAccesso drives the one-time optional-fields screen of §6.1
  // point 5, which is built at step 6. Until then everyone lands on the
  // home page.
  redirect("/");
}
