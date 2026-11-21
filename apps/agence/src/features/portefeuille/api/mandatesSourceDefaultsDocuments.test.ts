import { describe, expect, it } from "vitest";
import { createApiMandatesSource } from "./mandatesSource";
import { ID, ORG, documentJson, mockApi, orgPath, page, problem, storedFileJson, termDefaultsJson } from "./testing";
import type { TermDefaultsInput } from "./apiDefaults";

const defaultsPath = orgPath("/mandates/term-defaults");
const documentsPath = orgPath(`/mandates/${ID.mandate}/documents`);

function sourceWith(routes: Parameters<typeof mockApi>[0]) {
  const api = mockApi(routes);
  return { ...api, source: createApiMandatesSource({ client: api.client, organizationId: ORG }) };
}

const percentageInput: TermDefaultsInput = {
  feeKind: "percentage",
  feeBasisPoints: 650,
  feeBase: "rent_and_charges",
  feeMinimumMinor: 1_500,
  feeTaxMode: "excl_tax",
  payoutDay: 7,
  worksLimitMinor: 60_000,
  lettingFeeBasisPoints: 5_000,
  worksFeeBasisPoints: null,
};

describe("conditions par défaut", () => {
  it("lit les conditions posées avec leur version", async () => {
    const { source } = sourceWith({ [`GET ${defaultsPath}`]: { body: { data: termDefaultsJson() } } });

    const defaults = await source.termDefaults();

    expect(defaults).toMatchObject({ fee_kind: "percentage", fee_basis_points: 650, lock_version: 2, letting_fee_basis_points: 5_000, currency: "EUR" });
  });

  it("traite le 404 mandate_term_defaults_not_found comme l'absence de défauts, pas comme une erreur", async () => {
    const { source } = sourceWith({ [`GET ${defaultsPath}`]: problem(404, "mandate_term_defaults_not_found", "Aucune condition par défaut.") });

    await expect(source.termDefaults()).resolves.toBeNull();
  });

  it("laisse remonter un 404 portant un autre code", async () => {
    const { source } = sourceWith({ [`GET ${defaultsPath}`]: problem(404, "organization_not_found", "Introuvable.") });

    await expect(source.termDefaults()).rejects.toMatchObject({ kind: "not_found" });
  });

  it("laisse remonter une panne du serveur au lieu de la prendre pour une absence", async () => {
    const { source } = sourceWith({ [`GET ${defaultsPath}`]: problem(500, "server_error", "Erreur interne.") });

    await expect(source.termDefaults()).rejects.toBeDefined();
  });

  it("refuse une réponse qui ne respecte pas le contrat", async () => {
    const { source } = sourceWith({ [`GET ${defaultsPath}`]: { body: { data: termDefaultsJson({ payout_day: 31 }) } } });

    await expect(source.termDefaults()).rejects.toMatchObject({ kind: "unexpected_response" });
  });

  it("première écriture : PUT sans lock_version, montants en unités mineures et pourcentages en points de base", async () => {
    const { source, callsTo } = sourceWith({ [`PUT ${defaultsPath}`]: { body: { data: termDefaultsJson({ lock_version: 1 }) } } });

    const saved = await source.saveTermDefaults(null, percentageInput);

    expect(callsTo("PUT", defaultsPath)[0]?.body).toEqual({
      fee_kind: "percentage",
      fee_basis_points: 650,
      fee_base: "rent_and_charges",
      fee_minimum_amount: 1_500,
      fee_tax_mode: "excl_tax",
      payout_day: 7,
      works_limit_amount: 60_000,
      letting_fee_basis_points: 5_000,
      works_fee_basis_points: null,
    });
    expect(saved.lock_version).toBe(1);
  });

  it("mise à jour : lock_version envoyé, forfait sans taux", async () => {
    const { source, callsTo } = sourceWith({ [`PUT ${defaultsPath}`]: { body: { data: termDefaultsJson({ fee_kind: "flat", fee_basis_points: null, fee_flat_amount: { amount: 4_500, currency: "EUR" }, lock_version: 3 }) } } });

    await source.saveTermDefaults(2, { ...percentageInput, feeKind: "flat", feeBasisPoints: undefined, flatFeeMinor: 4_500 });

    const body = callsTo("PUT", defaultsPath)[0]?.body;
    expect(body).toMatchObject({ lock_version: 2, fee_kind: "flat", fee_flat_amount: 4_500 });
    expect(body).not.toHaveProperty("fee_basis_points");
  });

  it("remonte le 409 mandate_stale_version", async () => {
    const { source } = sourceWith({ [`PUT ${defaultsPath}`]: problem(409, "mandate_stale_version", "Version périmée.") });

    await expect(source.saveTermDefaults(1, percentageInput)).rejects.toMatchObject({ kind: "stale_version" });
  });
});

describe("documents d'un mandat", () => {
  it("suit le curseur jusqu'à la dernière page", async () => {
    const { source, callsTo } = sourceWith({
      [`GET ${documentsPath}`]: (call) => (call.search.get("cursor") === null ? { body: page([documentJson()], "p2") } : { body: page([documentJson({ id: ID.documentB, kind: "insurance" })]) }),
    });

    const all = await source.documents(ID.mandate);

    expect(all.map((document) => document.kind)).toEqual(["diagnostic", "insurance"]);
    expect(callsTo("GET", documentsPath)).toHaveLength(2);
  });

  it("téléverse en catégorie supporting, sujet mandate, et rend l'identifiant du fichier", async () => {
    const { source, callsTo } = sourceWith({ [`POST ${orgPath("/documents/files")}`]: { status: 201, body: { data: storedFileJson() } } });

    const id = await source.uploadFile(ID.mandate, new File(["%PDF-1.4"], "diagnostic.pdf", { type: "application/pdf" }));

    const form = callsTo("POST", orgPath("/documents/files"))[0]?.form;
    expect(form?.get("category")).toBe("supporting");
    expect(form?.get("subject_type")).toBe("mandate");
    expect(form?.get("subject_id")).toBe(ID.mandate);
    expect(form?.get("file")).toBeInstanceOf(File);
    expect(id).toBe(ID.storedFile);
  });

  it("partage le fichier téléversé avec sa nature", async () => {
    const { source, callsTo } = sourceWith({ [`POST ${documentsPath}`]: { status: 201, body: { data: documentJson() } } });

    const shared = await source.shareDocument(ID.mandate, ID.storedFile, "diagnostic");

    expect(callsTo("POST", documentsPath)[0]?.body).toEqual({ stored_file_id: ID.storedFile, kind: "diagnostic" });
    expect(shared.id).toBe(ID.documentA);
  });

  it("retire le partage par DELETE sur le document", async () => {
    const { source, callsTo } = sourceWith({ [`DELETE ${documentsPath}/${ID.documentA}`]: { body: { data: documentJson({ revoked_at: "2026-11-15T10:00:00+00:00" }) } } });

    const revoked = await source.unshareDocument(ID.mandate, ID.documentA);

    expect(callsTo("DELETE", `${documentsPath}/${ID.documentA}`)).toHaveLength(1);
    expect(revoked.revoked_at).toBe("2026-11-15T10:00:00+00:00");
  });

  it("refuse un document dont la nature est inconnue", async () => {
    const { source } = sourceWith({ [`GET ${documentsPath}`]: { body: page([documentJson({ kind: "secret" })]) } });

    await expect(source.documents(ID.mandate)).rejects.toMatchObject({ kind: "unexpected_response" });
  });

  it("traduit le 409 document_not_clean en état d'attente d'analyse", async () => {
    const { source } = sourceWith({ [`POST ${documentsPath}`]: problem(409, "document_not_clean", "Analyse en cours.") });

    await expect(source.shareDocument(ID.mandate, ID.storedFile, "other")).rejects.toMatchObject({ kind: "not_clean" });
  });
});
