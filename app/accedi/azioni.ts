"use server";

/**
 * Server Actions for sign-in and sign-out. They run on the server, read the
 * request context, and hand everything to lib/auth. No email address or
 * token is logged here or anywhere (CLAUDE.md rule 4).
 */

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { esci, richiediLink } from "@/lib/auth/accesso";
import { indirizzoRete } from "@/lib/auth/impronte";
import { clientServer } from "@/lib/db/server";
import { envServer } from "@/lib/env";

export async function inviaLink(formData: FormData): Promise<void> {
  const email = String(formData.get("email") ?? "");
  const rete = indirizzoRete(await headers());
  const client = await clientServer();
  const esito = await richiediLink(client, { email, rete, chiaveImpronte: envServer().chiaveImpronte });

  switch (esito) {
    case "EMAIL_NON_VALIDA":
      redirect("/accedi?errore=email");
    case "ERRORE":
      redirect("/accedi?errore=invio");
    default:
      // INVIATO and LIMITE alike: the sentence after sending is always the
      // same, whether or not the address exists or has asked too often (§6.1).
      redirect("/accedi?stato=inviato");
  }
}

export async function esciAzione(): Promise<void> {
  const client = await clientServer();
  await esci(client);
  redirect("/");
}
