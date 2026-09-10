/**
 * Le pulizie automatiche notturne — SPEC §7, §12 step 11.
 *
 * The retention table of §7, in the order it has to happen. Every decision
 * is taken inside the database (see supabase/migrations/*_pulizie.sql); this
 * file calls the six statements once each and counts what they did.
 *
 * The order is not arbitrary:
 *
 *   1. bookings are anonymised first, so a dormant account closed later in
 *      the same run has nothing older than thirty days still attached to it;
 *   2. the warnings go out before any closing, so nobody is ever warned and
 *      deleted on the same night — the database enforces the same thing from
 *      its side, but the order says it plainly;
 *   3. the closings run next, and each writes the date the consent register
 *      is measured from;
 *   4-6. the three sweeps have no bearing on the others and come last.
 *
 * Nothing here stops the run: a step that fails is reported and the rest go
 * on. A cleanup that did not happen tonight happens tomorrow — but a cleanup
 * skipped because an unrelated one failed would never happen at all.
 *
 * No address, name or identifier is returned or logged (rule 4): the outcome
 * is counts.
 */

import {
  GIORNI_ANONIMIZZAZIONE,
  MESI_ACCOUNT_DORMIENTE,
  MESI_AVVISO_DORMIENZA,
  MESI_CONSERVAZIONE_CONSENSI,
  ORE_RICHIESTE_INCOMPLETE,
} from "@/config/limits";
import type { Client } from "@/lib/db/client";
import { avvisaDormienza, type RigaDormienza } from "@/lib/posta/dormienza";

export type EsitoPulizie = {
  /** Bookings whose link with a person was cut tonight (§5.3). */
  prenotazioniAnonimizzate: number;
  /** Dormancy warnings the provider accepted, and those it refused (§7). */
  avvisiInviati: number;
  avvisiFalliti: number;
  /** Accounts closed for two years of silence (§7). */
  accountChiusi: number;
  /** Auth stubs of link requests never opened (§6.1 point 4). */
  richiesteIncomplete: number;
  /** Expired fingerprints of the request limit (§6.1). */
  impronteScadute: number;
  /** Consent rows of accounts closed 24 months ago (§5.5, §7). */
  consensiScaduti: number;
  /** Names of the steps that failed. Never a reason: a reason can quote data. */
  falliti: string[];
};

/** Runs the six cleanups and reports what each one did. */
export async function eseguiPulizie(client: Client): Promise<EsitoPulizie> {
  const esito: EsitoPulizie = {
    prenotazioniAnonimizzate: 0,
    avvisiInviati: 0,
    avvisiFalliti: 0,
    accountChiusi: 0,
    richiesteIncomplete: 0,
    impronteScadute: 0,
    consensiScaduti: 0,
    falliti: [],
  };

  esito.prenotazioniAnonimizzate = conta(
    esito,
    "anonimizza_prenotazioni",
    await client.rpc("anonimizza_prenotazioni", { p_giorni: GIORNI_ANONIMIZZAZIONE }),
  );

  const avvisi = await avvisaDormienti(client, esito);
  esito.avvisiInviati = avvisi.inviati;
  esito.avvisiFalliti = avvisi.falliti;

  esito.accountChiusi = conta(
    esito,
    "cancella_account_dormienti",
    await client.rpc("cancella_account_dormienti", {
      p_mesi: MESI_ACCOUNT_DORMIENTE,
      p_mesi_avviso: MESI_AVVISO_DORMIENZA,
    }),
  );

  esito.richiesteIncomplete = conta(
    esito,
    "cancella_richieste_incomplete",
    await client.rpc("cancella_richieste_incomplete", { p_ore: ORE_RICHIESTE_INCOMPLETE }),
  );

  esito.impronteScadute = conta(
    esito,
    "cancella_impronte_scadute",
    await client.rpc("cancella_impronte_scadute"),
  );

  esito.consensiScaduti = conta(
    esito,
    "cancella_consensi_scaduti",
    await client.rpc("cancella_consensi_scaduti", { p_mesi: MESI_CONSERVAZIONE_CONSENSI }),
  );

  return esito;
}

/**
 * Reads what one cleanup answered. A failure is recorded by its name — never
 * by its reason, which could quote a row — and counted as zero, so the run
 * carries on to the next one.
 */
function conta(
  esito: EsitoPulizie,
  mestiere: string,
  risposta: { data: number | null; error: unknown },
): number {
  if (risposta.error || risposta.data === null) {
    esito.falliti.push(mestiere);
    return 0;
  }
  return risposta.data;
}

/**
 * The dormancy warnings (§7). The rows are claimed by the database, so a
 * second run — or a run overlapping this one — finds nothing left and warns
 * nobody twice. A refused send is one warning lost: the account is not
 * closed until a month after the warning, and an account never warned is
 * never closed at all.
 */
async function avvisaDormienti(
  client: Client,
  esito: EsitoPulizie,
): Promise<{ inviati: number; falliti: number }> {
  const { data, error } = await client.rpc("avvisi_dormienza_da_inviare", {
    p_mesi: MESI_AVVISO_DORMIENZA,
  });
  if (error || !data) {
    esito.falliti.push("avvisi_dormienza_da_inviare");
    return { inviati: 0, falliti: 0 };
  }

  let inviati = 0;
  let falliti = 0;
  for (const riga of data as RigaDormienza[]) {
    const esitoInvio = await avvisaDormienza(riga);
    if (esitoInvio.ok) inviati += 1;
    else falliti += 1;
  }
  return { inviati, falliti };
}
