import { describe, expect, it } from "vitest";
import { AMENDMENT_LOCKED_MESSAGE } from "./apiErrors";
import { DEFAULTS_STALE_MESSAGE, SIGNED_AVENANT_REQUIRED, createApiPortefeuilleSource } from "./apiPortefeuille";
import { createApiMandatesSource } from "./mandatesSource";
import { ID, ORG, documentJson, mandateDetail, mockApi, orgPath, problem, termDefaultsJson } from "./testing";
import type { MockRoute } from "./testing";
import type { NewAvenant } from "../source";

const NOW = new Date(2026, 10, 16, 10, 0, 0);
const TODAY = "2026-11-16";
const mandatePath = (suffix = "") => orgPath(`/mandates/${ID.mandate}${suffix}`);
const detail = (overrides = {}) => ({ body: { data: mandateDetail(overrides) } });

function setup(routes: Record<string, MockRoute> = {}, options: { canEditDefaults?: boolean } = {}) {
  const api = mockApi({ [`GET ${mandatePath()}`]: detail(), ...routes });
  const mandates = createApiMandatesSource({ client: api.client, organizationId: ORG });
  const source = createApiPortefeuilleSource({ mandates, agencyName: "Agence Soleil", canWrite: true, now: () => NOW, ...options });
  return { ...api, source };
}

const avenant = (overrides: Partial<NewAvenant>): NewAvenant => ({ mandatId: ID.mandate, kind: "honoraires", effectIso: TODAY, note: "", feeBasisPoints: 600, ...overrides });

describe("avenant signé", () => {
  it("refuse un avenant de conditions sans pièce signée, sans appel d'écriture", async () => {
    const { source, calls } = setup();

    await expect(source.createAvenant(avenant({}))).rejects.toMatchObject({ kind: "invalid", field: "signedFile", message: SIGNED_AVENANT_REQUIRED });
    expect(calls.filter((call) => call.method !== "GET")).toHaveLength(0);
  });

  it("envoie la pièce signée et les points de base relocation / suivi de travaux", async () => {
    const { source, callsTo } = setup({ [`POST ${mandatePath("/terms")}`]: detail({ lock_version: 4 }) });

    await source.createAvenant(avenant({ signedFileId: ID.signedFile, lettingFeeBasisPoints: 5_000, worksFeeBasisPoints: null }));

    expect(callsTo("POST", mandatePath("/terms"))[0]?.body).toEqual({
      lock_version: 3,
      effective_on: TODAY,
      fee_kind: "percentage",
      fee_basis_points: 600,
      letting_fee_basis_points: 5_000,
      works_fee_basis_points: null,
      signed_file_id: ID.signedFile,
    });
  });

  it("rattache le 422 mandate_amendment_signature_required au champ de la pièce signée", async () => {
    const { source } = setup({ [`POST ${mandatePath("/terms")}`]: problem(422, "mandate_amendment_signature_required", "La pièce signée est requise.") });

    await expect(source.createAvenant(avenant({ signedFileId: ID.signedFile }))).rejects.toMatchObject({ kind: "invalid", field: "signedFile" });
  });

  it("rattache le 422 mandate_document_invalid au champ de la pièce signée", async () => {
    const { source } = setup({ [`POST ${mandatePath("/terms")}`]: problem(422, "mandate_document_invalid", "Pièce non conforme.") });

    await expect(source.createAvenant(avenant({ signedFileId: ID.signedFile }))).rejects.toMatchObject({ kind: "invalid", field: "signedFile" });
  });

  it("rattache le 404 mandate_document_not_found au champ de la pièce signée", async () => {
    const { source } = setup({ [`POST ${mandatePath("/terms")}`]: problem(404, "mandate_document_not_found", "Pièce introuvable.") });

    await expect(source.createAvenant(avenant({ signedFileId: ID.signedFile }))).rejects.toMatchObject({ field: "signedFile" });
  });

  it("signale l'analyse antivirus en cours par le 409 document_not_clean", async () => {
    const { source } = setup({ [`POST ${mandatePath("/terms")}`]: problem(409, "document_not_clean", "Analyse en cours.") });

    await expect(source.createAvenant(avenant({ signedFileId: ID.signedFile }))).rejects.toMatchObject({ kind: "not_clean", field: "signedFile" });
  });
});

describe("conditions par défaut dans la source", () => {
  it("convertit la réponse et expose le droit d'écriture réservé aux administrateurs", async () => {
    const { source } = setup({ [`GET ${orgPath("/mandates/term-defaults")}`]: { body: { data: termDefaultsJson() } } }, { canEditDefaults: true });

    const defaults = await source.termDefaults?.load();

    expect(source.termDefaults?.canSave).toBe(true);
    expect(defaults).toMatchObject({ feeKind: "percentage", feeBasisPoints: 650, lettingFeeBasisPoints: 5_000, worksFeeBasisPoints: null, currency: "EUR", lockVersion: 2, payoutDay: 7 });
  });

  it("ne donne pas le droit d'écriture par défaut", () => {
    expect(setup().source.termDefaults?.canSave).toBe(false);
  });

  it("rend null quand aucun défaut n'est posé", async () => {
    const { source } = setup({ [`GET ${orgPath("/mandates/term-defaults")}`]: problem(404, "mandate_term_defaults_not_found", "Aucun défaut.") });

    await expect(source.termDefaults?.load()).resolves.toBeNull();
  });

  it("refuse des montants de devises différentes", async () => {
    const { source } = setup({ [`GET ${orgPath("/mandates/term-defaults")}`]: { body: { data: termDefaultsJson({ works_limit_amount: { amount: 1, currency: "XOF" } }) } } });

    await expect(source.termDefaults?.load()).rejects.toThrow(/Réponse inattendue/);
  });

  it("remplace le message d'obsolescence du mandat par celui des conditions par défaut", async () => {
    const { source } = setup({ [`PUT ${orgPath("/mandates/term-defaults")}`]: problem(409, "mandate_stale_version", "Version périmée.") });

    await expect(
      source.termDefaults?.save(1, { feeKind: "percentage", feeBasisPoints: 650, feeBase: "rent", feeMinimumMinor: 0, feeTaxMode: "excl_tax", payoutDay: 5, worksLimitMinor: 0, lettingFeeBasisPoints: null, worksFeeBasisPoints: null }),
    ).rejects.toMatchObject({ kind: "stale_version", message: DEFAULTS_STALE_MESSAGE });
  });
});

describe("documents dans la source", () => {
  it("convertit les documents et rattache un refus de partage au champ du fichier", async () => {
    const { source } = setup({
      [`GET ${mandatePath("/documents")}`]: { body: { data: [documentJson({ kind: "amendment" })], meta: { per_page: 100, next_cursor: null } } },
      [`POST ${mandatePath("/documents")}`]: problem(422, "mandate_document_invalid", "Pièce non conforme."),
    });

    const documents = await source.documents?.list(ID.mandate);

    expect(documents).toEqual([{ id: ID.documentA, mandateId: ID.mandate, storedFileId: ID.storedFile, kind: "amendment", uploadedBy: "agency", sharedAtIso: "2026-11-12T08:00:00+00:00", revokedAtIso: null }]);
    await expect(source.documents?.share(ID.mandate, ID.storedFile, "other")).rejects.toMatchObject({ kind: "invalid", field: "file" });
  });

  it("traduit le retrait refusé d'un avenant (409) en conflit lisible", async () => {
    const { source } = setup({ [`DELETE ${mandatePath(`/documents/${ID.documentA}`)}`]: problem(409, "mandate_amendment_document_locked", "Locked.") });

    await expect(source.documents?.unshare(ID.mandate, ID.documentA)).rejects.toMatchObject({ kind: "conflict", message: AMENDMENT_LOCKED_MESSAGE });
  });
});
