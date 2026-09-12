"use server";

/**
 * Taking a place and giving it up — SPEC §15.7.
 *
 * Both actions are one call to `lib/db/iscrizioni.ts` and one redirect. No
 * condition is examined here: whether there is a place left, whether the
 * caller may take it, whether the activity has begun and whose row this is
 * are all decided inside the database, which is the only place a page cannot
 * fail to have consulted (rule 5, rule 22, §8.3).
 *
 * Nothing personal travels in the address, in either direction: what comes
 * back is one word out of a closed list, and the page re-reads everything
 * else from the database under the caller's own identity.
 */

import { redirect } from "next/navigation";
import { annullaIscrizione, iscrivitiAttivita } from "@/lib/db/iscrizioni";
import { clientServer } from "@/lib/db/server";

export async function iscrivitiAzione(formData: FormData): Promise<void> {
  const attivitaId = String(formData.get("attivita") ?? "");
  if (!attivitaId) redirect("/abitanti");

  const client = await clientServer();
  const esito = await iscrivitiAttivita(client, attivitaId);

  redirect(
    esito.ok
      ? `/abitanti/${attivitaId}?esito=iscritto`
      : `/abitanti/${attivitaId}?esito=${esito.motivo}`,
  );
}

export async function annullaAzione(formData: FormData): Promise<void> {
  const attivitaId = String(formData.get("attivita") ?? "");
  const iscrizioneId = String(formData.get("iscrizione") ?? "");
  if (!attivitaId || !iscrizioneId) redirect("/abitanti");

  const client = await clientServer();
  const esito = await annullaIscrizione(client, iscrizioneId);

  // The policy changes no row once the activity has begun, and none at all on
  // somebody else's: one refusal covers both, and it says what to do next.
  redirect(`/abitanti/${attivitaId}?esito=${esito.ok ? "annullata" : "TARDI"}`);
}
