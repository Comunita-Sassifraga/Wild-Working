/**
 * SPEC §6.1, §8.4 — sign-in by email link.
 *
 * Goes through the real flow: ask for a link, read the email from the local
 * mailbox, open the link, check the session and the profile. Then the
 * refusals: link reused, link malformed, address malformed, hourly limits.
 * The same lib/auth functions serve the pages, so what passes here is what
 * runs in the app. Email addresses are never printed (CLAUDE.md rule 4).
 */

import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { afterAll, describe, expect, it } from "vitest";
import {
  MAX_LINK_PER_EMAIL_ORA,
  MAX_LINK_PER_RETE_ORA,
  VALIDITA_LINK_MINUTI,
} from "@/config/limits";
import { esci, isTipoLink, richiediLink, verificaLink } from "@/lib/auth/accesso";
import { impronta, indirizzoRete, normalizzaEmail } from "@/lib/auth/impronte";
import {
  attendiIntervalloPosta,
  contaEmail,
  linkDaEmail,
  servizio,
  visitatore,
} from "./setup/supabase";

const CHIAVE = "chiave-di-prova-non-segreta";
const emailDiProva = () => `accesso-${randomUUID()}@example.com`;
/** A fresh "network" per run, so the hourly counters of previous runs never interfere. */
const reteDiProva = () => `rete-${randomUUID()}`;

describe("§6.1 accesso via link email", () => {
  const emailCreate: string[] = [];

  afterAll(async () => {
    const s = servizio();
    for (const email of emailCreate) {
      const { data } = await s.from("utenti").select("id").eq("email", email);
      for (const riga of data ?? []) await s.auth.admin.deleteUser(riga.id);
    }
  });

  it("richiesta, email, clic: il profilo nasce al clic, con la sola email", async () => {
    const email = emailDiProva();
    emailCreate.push(email);
    const rete = reteDiProva();
    const client = visitatore();

    expect(await richiediLink(client, { email, rete, chiaveImpronte: CHIAVE })).toBe("INVIATO");

    // Before the link is opened there is no profile (§6.1 point 4).
    const prima = await servizio().from("utenti").select("id").eq("email", email);
    expect(prima.error).toBeNull();
    expect(prima.data).toHaveLength(0);

    const link = await linkDaEmail(email);
    expect(isTipoLink(link.tipo)).toBe(true);
    if (!isTipoLink(link.tipo)) return;

    const esito = await verificaLink(client, { tokenHash: link.tokenHash, tipo: link.tipo });
    expect(esito).toEqual({ ok: true, primoAccesso: true });

    // The profile exists now, with the email and nothing else (rule 17).
    const dopo = await servizio()
      .from("utenti")
      .select("id, nome_pubblico, eta, genere, professione, motivo_visita, residenza, mostra_nome_pubblico, lingua, creato_il, ultimo_accesso")
      .eq("email", email)
      .single();
    expect(dopo.error).toBeNull();
    expect(dopo.data).toMatchObject({
      nome_pubblico: null,
      eta: null,
      genere: null,
      professione: null,
      motivo_visita: null,
      residenza: null,
      mostra_nome_pubblico: false,
      lingua: "it",
    });
    expect(dopo.data!.ultimo_accesso > dopo.data!.creato_il).toBe(true);

    // The session is real: the person reads their own row under RLS.
    const mio = await client.from("utenti").select("id").eq("id", dopo.data!.id).single();
    expect(mio.error).toBeNull();
    expect(mio.data?.id).toBe(dopo.data!.id);

    // Single use (§6.1 point 3): the same link opens nothing a second time.
    const riuso = await verificaLink(visitatore(), { tokenHash: link.tokenHash, tipo: link.tipo });
    expect(riuso).toEqual({ ok: false });

    // Sign out: the client no longer has a person behind it.
    await esci(client);
    const { data: dopoUscita } = await client.auth.getUser();
    expect(dopoUscita.user).toBeNull();

    // Second sign-in: not the first access any more, ultimo_accesso moves on.
    await attendiIntervalloPosta();
    const client2 = visitatore();
    expect(await richiediLink(client2, { email, rete, chiaveImpronte: CHIAVE })).toBe("INVIATO");
    const link2 = await linkDaEmail(email, 1);
    if (!isTipoLink(link2.tipo)) throw new Error("unexpected link type");
    const esito2 = await verificaLink(client2, { tokenHash: link2.tokenHash, tipo: link2.tipo });
    expect(esito2).toEqual({ ok: true, primoAccesso: false });

    const terzo = await servizio().from("utenti").select("ultimo_accesso").eq("email", email).single();
    expect(terzo.data!.ultimo_accesso > dopo.data!.ultimo_accesso).toBe(true);
  });

  it("un link inesistente o di tipo sconosciuto non apre nulla (§8.4)", async () => {
    expect(await verificaLink(visitatore(), { tokenHash: "non-esiste", tipo: "magiclink" })).toEqual({ ok: false });
    expect(isTipoLink("recovery")).toBe(false);
    expect(isTipoLink(null)).toBe(false);
  });

  it("un indirizzo malformato è rifiutato prima di toccare il fornitore", async () => {
    const esito = await richiediLink(visitatore(), { email: "non-una-email", rete: reteDiProva(), chiaveImpronte: CHIAVE });
    expect(esito).toBe("EMAIL_NON_VALIDA");
    expect(normalizzaEmail("  Persona@Example.COM ")).toBe("persona@example.com");
    expect(normalizzaEmail("")).toBeNull();
    expect(normalizzaEmail("a@b")).toBeNull();
  });

  it(`la ${MAX_LINK_PER_EMAIL_ORA + 1}-esima richiesta in un'ora per la stessa email non invia nulla`, async () => {
    const email = emailDiProva();
    const rete = reteDiProva();
    const client = visitatore();
    // Fill the hour's quota with the fingerprints the app would compute.
    for (let i = 0; i < MAX_LINK_PER_EMAIL_ORA; i++) {
      const { data, error } = await client.rpc("consenti_richiesta_link", {
        p_impronta_email: impronta(email, CHIAVE),
        p_impronta_rete: impronta(rete, CHIAVE),
        p_max_email: MAX_LINK_PER_EMAIL_ORA,
        p_max_rete: MAX_LINK_PER_RETE_ORA,
      });
      expect(error).toBeNull();
      expect(data).toBe(true);
    }
    expect(await richiediLink(client, { email, rete, chiaveImpronte: CHIAVE })).toBe("LIMITE");
    expect(await contaEmail(email)).toBe(0);
  });

  it(`la ${MAX_LINK_PER_RETE_ORA + 1}-esima richiesta in un'ora dalla stessa rete non invia nulla`, async () => {
    const rete = reteDiProva();
    const client = visitatore();
    for (let i = 0; i < MAX_LINK_PER_RETE_ORA; i++) {
      const { data, error } = await client.rpc("consenti_richiesta_link", {
        p_impronta_email: impronta(emailDiProva(), CHIAVE),
        p_impronta_rete: impronta(rete, CHIAVE),
        p_max_email: MAX_LINK_PER_EMAIL_ORA,
        p_max_rete: MAX_LINK_PER_RETE_ORA,
      });
      expect(error).toBeNull();
      expect(data).toBe(true);
    }
    const email = emailDiProva();
    expect(await richiediLink(client, { email, rete, chiaveImpronte: CHIAVE })).toBe("LIMITE");
    expect(await contaEmail(email)).toBe(0);
  });

  it("la tabella delle impronte non è leggibile da nessuno tranne il backend", async () => {
    const daVisitatore = await visitatore().from("richieste_link").select("id").limit(1);
    expect(daVisitatore.error).not.toBeNull();
    const daBackend = await servizio().from("richieste_link").select("id").limit(1);
    expect(daBackend.error).toBeNull();
  });

  it("le impronte non contengono l'indirizzo e dipendono dalla chiave", () => {
    const email = "persona@example.com";
    const a = impronta(email, "chiave-uno");
    const b = impronta(email, "chiave-due");
    expect(a).not.toContain("persona");
    expect(a).not.toContain("example");
    expect(a).not.toBe(b);
    expect(impronta(email, "chiave-uno")).toBe(a);
  });

  it("l'indirizzo di rete viene letto dagli header del proxy, con un valore fisso altrimenti", () => {
    expect(indirizzoRete(new Headers({ "x-forwarded-for": "203.0.113.5, 10.0.0.1" }))).toBe("203.0.113.5");
    expect(indirizzoRete(new Headers({ "x-real-ip": "203.0.113.9" }))).toBe("203.0.113.9");
    expect(indirizzoRete(new Headers())).toBe("sconosciuto");
  });

  it("i limiti di §6.1 sono quelli scritti nello spec", () => {
    expect(MAX_LINK_PER_EMAIL_ORA).toBe(5);
    expect(MAX_LINK_PER_RETE_ORA).toBe(20);
  });

  it("la validità del link in config.toml e nei modelli email coincide con config/limits.ts (§10)", () => {
    const toml = readFileSync("supabase/config.toml", "utf8");
    const scadenza = /^otp_expiry\s*=\s*(\d+)/m.exec(toml);
    expect(scadenza).not.toBeNull();
    expect(Number(scadenza![1])).toBe(VALIDITA_LINK_MINUTI * 60);
    expect(VALIDITA_LINK_MINUTI).toBe(15);
    // Confirmation on: the profile is created when the link is opened, not requested.
    expect(/^enable_confirmations\s*=\s*true/m.test(toml)).toBe(true);

    for (const modello of ["confirmation", "magic_link"]) {
      const html = readFileSync(`supabase/templates/${modello}.html`, "utf8");
      // What the person reads: the file without its developer comments.
      const testo = html.replace(/<!--[\s\S]*?-->/g, "");
      expect(testo).toContain(`${VALIDITA_LINK_MINUTI} minuti`);
      expect(testo).toContain("/auth/conferma?token_hash={{ .TokenHash }}");
      // No exclamation marks, no emoji (§13.9).
      expect(testo).not.toMatch(/!/);
      expect(testo).not.toMatch(/\p{Extended_Pictographic}/u);
    }
  });
});
