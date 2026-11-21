import { describe, expect, it } from "vitest";
import { AMEND_ACTIVE_BY_AVENANT, createApiPortefeuilleSource, monthsToExtend } from "./apiPortefeuille";
import { createApiMandatesSource } from "./mandatesSource";
import { ID, ORG, mandantRow, mandateDetail, mandateSummary, mockApi, orgPath, page, problem, termsJson, xofTermsJson } from "./testing";
import type { MockRoute } from "./testing";
import { parsePortefeuille, PortefeuilleError } from "../source";
import type { NewAvenant, NewMandat } from "../source";

const NOW = new Date(2026, 10, 16, 10, 0, 0);
const TODAY = "2026-11-16";
const mandatePath = (suffix = "", id: string = ID.mandate) => orgPath(`/mandates/${id}${suffix}`);
const detail = (overrides = {}, status = 200) => ({ status, body: { data: mandateDetail(overrides) } });

function setup(routes: Record<string, MockRoute> = {}, canWrite = true) {
  const api = mockApi({
    [`GET ${orgPath("/mandates")}`]: (call) => ({ body: page(call.search.get("archived") === "1" ? [mandateSummary({ id: ID.archived, reference: "M-2025-0009", archived_at: "2026-06-01T08:00:00+00:00", status: "terminated", end_date: "2026-05-31" })] : [mandateSummary()]) }),
    [`GET ${orgPath("/mandates/mandants")}`]: { body: { data: [mandantRow()] } },
    ...routes,
  });
  const mandates = createApiMandatesSource({ client: api.client, organizationId: ORG });
  const source = createApiPortefeuilleSource({ mandates, agencyName: "Agence Soleil", canWrite, now: () => NOW });
  return { ...api, source };
}

const operationsOf = (source: ReturnType<typeof setup>["source"]) => {
  if (!source.operations) throw new Error("opérations absentes");
  return source.operations;
};

describe("chargement du portefeuille", () => {
  it("convertit les réponses du serveur vers les types de l'écran sans valeur inventée", async () => {
    const { source } = setup();

    const data = parsePortefeuille(await source.load());

    expect(data.origin).toBe("api");
    expect(data.agencyName).toBe("Agence Soleil");
    expect(data.todayIso).toBe(TODAY);
    expect(data.unavailable).toEqual(["baux", "reversements", "documents", "historique", "coordonnees", "garantie"]);
    expect(data.biens).toEqual([]);
    expect(data.baux).toEqual([]);
    expect(data.events).toEqual([]);
    expect(data.mandants).toEqual([{ id: ID.mandant, name: "Claire Vasseur", legal: "Particulier", type: "particulier" }]);
    const mandat = data.mandats.find((item) => item.id === ID.mandate);
    expect(mandat).toMatchObject({
      number: "M-2026-0001",
      mandantId: ID.mandant,
      status: "actif",
      startIso: "2026-01-01",
      endIso: "2028-12-31",
      feeBasisPoints: 700,
      payoutDay: 5,
      worksLimitMinor: 50_000,
      renewal: "aucune",
      currency: "EUR",
      typeLabel: "Mandat de gestion",
      archived: false,
    });
    expect(mandat?.units).toEqual([{ id: ID.lineA, unitId: ID.unitA, reference: "A12", propertyName: "Résidence du Port", fromIso: "2026-01-01", endIso: null }]);
    expect(mandat?.guaranteeUntilIso).toBeUndefined();
    expect(mandat?.signedOnIso).toBeUndefined();
  });

  it("charge aussi les mandats archivés et les marque", async () => {
    const { source, callsTo } = setup();

    const data = parsePortefeuille(await source.load());

    expect(data.mandats.map((item) => [item.number, item.archived])).toEqual([["M-2026-0001", false], ["M-2025-0009", true]]);
    expect(callsTo("GET", orgPath("/mandates")).map((call) => call.search.get("archived"))).toEqual([null, "1"]);
  });

  it.each([
    ["brouillon", { status: "draft" }],
    ["suspendu", { status: "suspended" }],
    ["termine", { status: "expired", end_date: "2026-10-31" }],
    ["termine", { status: "active", end_date: "2026-11-15" }],
    ["a_renouveler", { status: "active", end_date: "2027-01-31", tacit_renewal: false }],
    ["actif", { status: "active", end_date: "2027-01-31", tacit_renewal: true }],
    ["actif", { status: "terminated", end_date: "2027-02-16" }],
  ])("traduit le statut serveur en « %s »", async (expected, overrides) => {
    const { source } = setup({ [`GET ${orgPath("/mandates")}`]: (call) => ({ body: page(call.search.get("archived") === "1" ? [] : [mandateSummary(overrides)]) }) });

    const data = parsePortefeuille(await source.load());

    expect(data.mandats[0]?.status).toBe(expected);
  });

  it("expose la résiliation programmée d'un mandat en cours de préavis", async () => {
    const { source } = setup({ [`GET ${orgPath("/mandates")}`]: (call) => ({ body: page(call.search.get("archived") === "1" ? [] : [mandateSummary({ status: "terminated", end_date: "2027-02-16" })]) }) });

    const data = parsePortefeuille(await source.load());

    expect(data.mandats[0]?.termination).toMatchObject({ effectIso: "2027-02-16" });
  });

  it("garde le forfait d'un mandat à honoraires forfaitaires", async () => {
    const flat = termsJson({ fee_kind: "flat", fee_basis_points: null, fee_flat_amount: { amount: 4_500, currency: "EUR" } });
    const { source } = setup({ [`GET ${orgPath("/mandates")}`]: (call) => ({ body: page(call.search.get("archived") === "1" ? [] : [mandateSummary({ terms: flat })]) }) });

    const data = parsePortefeuille(await source.load());

    expect(data.mandats[0]).toMatchObject({ flatFeeMinor: 4_500, feeBasisPoints: 0 });
  });

  it("lit les conditions d'un mandat en FCFA sans les multiplier ni les refuser", async () => {
    const terms = xofTermsJson({ fee_kind: "flat", fee_basis_points: null, fee_flat_amount: { amount: 45_000, currency: "XOF" }, fee_base: "rent", fee_tax_mode: "incl_tax" });
    const { source } = setup({ [`GET ${orgPath("/mandates")}`]: (call) => ({ body: page(call.search.get("archived") === "1" ? [] : [mandateSummary({ currency: "XOF", terms })]) }) });

    const data = parsePortefeuille(await source.load());

    expect(data.mandats[0]).toMatchObject({
      currency: "XOF",
      flatFeeMinor: 45_000,
      worksLimitMinor: 300_000,
      feeBase: "rent",
      feeMinimumMinor: 5_000,
      feeTaxMode: "incl_tax",
    });
  });

  it("expose la base, le minimum et le mode de taxe renvoyés par le serveur", async () => {
    const { source } = setup();

    const data = parsePortefeuille(await source.load());

    expect(data.mandats.find((item) => item.id === ID.mandate)).toMatchObject({ feeBase: "rent_and_charges", feeMinimumMinor: 0, feeTaxMode: "excl_tax" });
  });

  it("laisse la base vide quand le mandat n'en porte pas, sans en inventer une", async () => {
    const { source } = setup({ [`GET ${orgPath("/mandates")}`]: (call) => ({ body: page(call.search.get("archived") === "1" ? [] : [mandateSummary({ terms: termsJson({ fee_base: null }) })]) }) });

    const data = parsePortefeuille(await source.load());

    expect(data.mandats[0]?.feeBase).toBeUndefined();
  });

  it("refuse une devise inconnue au lieu de l'afficher en euros", async () => {
    const { source } = setup({ [`GET ${orgPath("/mandates")}`]: (call) => ({ body: page(call.search.get("archived") === "1" ? [] : [mandateSummary({ currency: "USD" })]) }) });

    await expect(source.load()).rejects.toMatchObject({ kind: "unavailable" });
  });

  it("refuse des conditions dont la devise diffère de celle du mandat", async () => {
    const { source } = setup({ [`GET ${orgPath("/mandates")}`]: (call) => ({ body: page(call.search.get("archived") === "1" ? [] : [mandateSummary({ currency: "XOF", terms: termsJson() })]) }) });

    await expect(source.load()).rejects.toBeDefined();
  });

  it("signale une panne du serveur au lieu de renvoyer un portefeuille vide", async () => {
    const { source } = setup({ [`GET ${orgPath("/mandates")}`]: { status: 500, body: { detail: "Panne" } } });

    await expect(source.load()).rejects.toBeDefined();
  });
});

describe("cycle de vie", () => {
  it("active avec la version lue au chargement", async () => {
    const { source, callsTo } = setup({ [`POST ${mandatePath("/activate")}`]: detail({ lock_version: 4 }) });
    await source.load();

    await operationsOf(source).activate(ID.mandate, "2026-11-13");

    expect(callsTo("POST", mandatePath("/activate"))[0]?.body).toEqual({ lock_version: 3, signed_on: "2026-11-13" });
  });

  it("enchaîne deux actions avec la version renvoyée par la première", async () => {
    const { source, callsTo } = setup({
      [`POST ${mandatePath("/suspend")}`]: detail({ lock_version: 4, status: "suspended" }),
      [`POST ${mandatePath("/resume")}`]: detail({ lock_version: 5 }),
    });
    await source.load();

    await operationsOf(source).suspend(ID.mandate);
    await operationsOf(source).resume(ID.mandate);

    expect(callsTo("POST", mandatePath("/suspend"))[0]?.body).toEqual({ lock_version: 3 });
    expect(callsTo("POST", mandatePath("/resume"))[0]?.body).toEqual({ lock_version: 4 });
  });

  it("lit la version du serveur quand le mandat n'a pas été chargé", async () => {
    const { source, callsTo } = setup({ [`GET ${mandatePath()}`]: detail({ lock_version: 9 }), [`POST ${mandatePath("/suspend")}`]: detail() });

    await operationsOf(source).suspend(ID.mandate);

    expect(callsTo("POST", mandatePath("/suspend"))[0]?.body).toEqual({ lock_version: 9 });
  });

  it("transmet un conflit de version comme tel, avec la proposition de recharger", async () => {
    const { source } = setup({ [`POST ${mandatePath("/suspend")}`]: problem(409, "mandate_stale_version", "Périmée") });
    await source.load();

    const failure = await operationsOf(source).suspend(ID.mandate).catch((error: unknown) => error);

    expect(failure).toBeInstanceOf(PortefeuilleError);
    expect(failure).toMatchObject({ kind: "stale_version" });
    expect((failure as PortefeuilleError).message).toContain("Rechargez");
  });

  it("restaure un mandat archivé sans version", async () => {
    const { source, callsTo } = setup({ [`DELETE ${mandatePath("/archive", ID.archived)}`]: detail({ id: ID.archived }) });

    await operationsOf(source).restore(ID.archived);

    expect(callsTo("DELETE", mandatePath("/archive", ID.archived))).toHaveLength(1);
  });

  it("ajoute, termine et retire un lot avec la version courante", async () => {
    const { source, callsTo } = setup({
      [`POST ${mandatePath("/units")}`]: detail({ lock_version: 4 }),
      [`POST ${mandatePath(`/units/${ID.lineA}/end`)}`]: detail({ lock_version: 5 }),
      [`DELETE ${mandatePath(`/units/${ID.lineB}`)}`]: detail({ lock_version: 6 }),
    });
    await source.load();

    await operationsOf(source).addUnit(ID.mandate, ID.unitB, "2027-01-01");
    await operationsOf(source).endUnit(ID.mandate, ID.lineA, "2026-12-31");
    await operationsOf(source).removeUnit(ID.mandate, ID.lineB);

    expect(callsTo("POST", mandatePath("/units"))[0]?.body).toEqual({ lock_version: 3, unit_id: ID.unitB, valid_from: "2027-01-01" });
    expect(callsTo("POST", mandatePath(`/units/${ID.lineA}/end`))[0]?.body).toEqual({ lock_version: 4, end_date: "2026-12-31" });
    expect(callsTo("DELETE", mandatePath(`/units/${ID.lineB}`))[0]?.search.get("lock_version")).toBe("5");
  });
});

describe("création d'un mandat", () => {
  const DRAFT_API: NonNullable<NewMandat["api"]> = { typeId: ID.type, unitIds: [ID.unitA, ID.unitB], currency: "EUR", feeKind: "percentage", feeBase: "rent", feeMinimumMinor: 1_500, feeTaxMode: "excl_tax" };
  const input: NewMandat = {
    mandantId: ID.mandant,
    lots: [],
    api: DRAFT_API,
    feeBasisPoints: 650,
    payoutDay: 5,
    worksLimitMinor: 50_000,
    renewal: "tacite",
    startIso: "2026-12-01",
    endIso: "2029-11-30",
    signed: false,
  };

  it("enregistre un brouillon sans appeler l'activation", async () => {
    const { source, callsTo, calls } = setup({ [`POST ${orgPath("/mandates")}`]: detail({ status: "draft", lock_version: 1 }, 201) });

    const mandat = await source.createMandat(input);

    expect(mandat).toMatchObject({ number: "M-2026-0001", status: "brouillon" });
    expect(callsTo("POST", orgPath("/mandates"))[0]?.body).toEqual({
      mandant_party_id: ID.mandant,
      mandate_type_term_id: ID.type,
      starts_on: "2026-12-01",
      end_date: "2029-11-30",
      tacit_renewal: true,
      currency: "EUR",
      terms: { fee_kind: "percentage", fee_basis_points: 650, payout_day: 5, works_limit_amount: 50_000, fee_base: "rent", fee_minimum_amount: 1_500, fee_tax_mode: "excl_tax" },
      units: [{ unit_id: ID.unitA }, { unit_id: ID.unitB }],
    });
    expect(calls.some((call) => call.path.endsWith("/activate"))).toBe(false);
  });

  it("active le brouillon créé avec sa version et la date de signature", async () => {
    const { source, callsTo } = setup({
      [`POST ${orgPath("/mandates")}`]: detail({ status: "draft", lock_version: 1 }, 201),
      [`POST ${mandatePath("/activate")}`]: detail({ lock_version: 2 }),
    });

    const mandat = await source.createMandat({ ...input, api: { ...DRAFT_API, signedOnIso: "2026-11-13" }, signed: true });

    expect(mandat.status).toBe("actif");
    expect(callsTo("POST", mandatePath("/activate"))[0]?.body).toEqual({ lock_version: 1, signed_on: "2026-11-13" });
  });

  it("annonce un brouillon enregistré quand l'activation échoue sur un chevauchement", async () => {
    const { source } = setup({
      [`POST ${orgPath("/mandates")}`]: detail({ status: "draft", lock_version: 1 }, 201),
      [`POST ${mandatePath("/activate")}`]: problem(409, "mandate_overlap", "Chevauchement"),
    });

    const failure = await source.createMandat({ ...input, api: { ...DRAFT_API, signedOnIso: "2026-11-13" }, signed: true }).catch((error: unknown) => error);

    expect(failure).toMatchObject({ kind: "overlap", field: "lots" });
    expect((failure as PortefeuilleError).message).toContain("Le brouillon M-2026-0001 est enregistré, mais l’activation a échoué");
  });

  it("rattache un chevauchement à la création au champ des lots", async () => {
    const { source } = setup({ [`POST ${orgPath("/mandates")}`]: problem(409, "mandate_overlap", "Chevauchement") });

    await expect(source.createMandat(input)).rejects.toMatchObject({ kind: "overlap", field: "lots" });
  });

  it("rattache une erreur 422 au champ du formulaire", async () => {
    const { source } = setup({ [`POST ${orgPath("/mandates")}`]: problem(422, "validation_failed", "Invalide", { "terms.payout_day": ["Le jour de reversement est entre 1 et 28."] }) });

    await expect(source.createMandat(input)).rejects.toMatchObject({ kind: "invalid", field: "payoutDay", message: "Le jour de reversement est entre 1 et 28." });
  });

  it("refuse une création sans choix de lots réels plutôt que d'inventer des lots", async () => {
    const { source, calls } = setup();

    await expect(source.createMandat({ ...input, api: undefined })).rejects.toMatchObject({ field: "lots" });
    expect(calls).toHaveLength(0);
  });

  it("refuse la création pour un rôle en lecture", async () => {
    const { source } = setup({ [`POST ${orgPath("/mandates")}`]: problem(403, "role_forbidden", "Interdit") });

    await expect(source.createMandat(input)).rejects.toMatchObject({ kind: "forbidden" });
  });
});

describe("avenants, renouvellement et résiliation", () => {
  const avenant = (overrides: Partial<NewAvenant>): NewAvenant => ({ mandatId: ID.mandate, kind: "honoraires", effectIso: TODAY, note: "", ...overrides });

  it("applique un avenant d'honoraires par les conditions, avec la date d'effet", async () => {
    const { source, callsTo } = setup({ [`POST ${mandatePath("/terms")}`]: detail({ lock_version: 4 }) });
    await source.load();

    const result = await source.createAvenant(avenant({ effectIso: "2027-01-01", feeBasisPoints: 600, signedFileId: ID.signedFile }));

    expect(callsTo("POST", mandatePath("/terms"))[0]?.body).toEqual({ lock_version: 3, effective_on: "2027-01-01", fee_kind: "percentage", fee_basis_points: 600, signed_file_id: ID.signedFile });
    expect(result).toEqual({ mandatId: ID.mandate, applied: false, effectIso: "2027-01-01" });
  });

  it("prolonge la durée par un renouvellement d'un nombre de mois entiers", async () => {
    const { source, callsTo } = setup({ [`GET ${mandatePath()}`]: detail(), [`POST ${mandatePath("/renew")}`]: detail({ lock_version: 4 }) });
    await source.load();

    const result = await source.createAvenant(avenant({ kind: "duree", endIso: "2029-12-31" }));

    expect(callsTo("POST", mandatePath("/renew"))[0]?.body).toEqual({ lock_version: 3, months: 12 });
    expect(result.applied).toBe(true);
  });

  it("refuse une prolongation qui ne tombe pas sur des mois entiers sans appeler le serveur", async () => {
    const { source, callsTo } = setup({ [`GET ${mandatePath()}`]: detail() });
    await source.load();

    await expect(source.createAvenant(avenant({ kind: "duree", endIso: "2029-12-15" }))).rejects.toMatchObject({ kind: "invalid", field: "endIso" });
    expect(callsTo("POST", mandatePath("/renew"))).toHaveLength(0);
  });

  it("refuse une prolongation à effet différé", async () => {
    const { source } = setup({ [`GET ${mandatePath()}`]: detail() });
    await source.load();

    await expect(source.createAvenant(avenant({ kind: "duree", endIso: "2029-12-31", effectIso: "2027-01-01" }))).rejects.toMatchObject({ field: "effectIso" });
  });

  it("signale une période en conflit sur la date d'effet", async () => {
    const { source } = setup({ [`POST ${mandatePath("/terms")}`]: problem(409, "mandate_term_conflict", "Une condition existe déjà à cette date.") });
    await source.load();

    await expect(source.createAvenant(avenant({ feeBasisPoints: 600, signedFileId: ID.signedFile }))).rejects.toMatchObject({ kind: "conflict", field: "effectIso" });
  });

  it("renouvelle pour la durée de reconduction du mandat", async () => {
    const { source, callsTo } = setup({ [`GET ${mandatePath()}`]: detail({ renewal_months: 24 }), [`POST ${mandatePath("/renew")}`]: detail({ lock_version: 4, end_date: "2030-12-31" }) });

    const renewed = await source.renewMandat(ID.mandate);

    expect(callsTo("POST", mandatePath("/renew"))[0]?.body).toEqual({ lock_version: 3, months: 24 });
    expect(renewed.endIso).toBe("2030-12-31");
  });

  it("résilie avec préavis, motif et mention d'accord amiable", async () => {
    const { source, callsTo } = setup({ [`POST ${mandatePath("/terminate")}`]: detail({ status: "terminated", end_date: "2027-02-16", lock_version: 4 }) });
    await source.load();

    const result = await source.terminateMandat(ID.mandate, { reason: "Accord amiable des parties", effectIso: "2026-12-01", noticeIso: TODAY, note: "Accord du 10 novembre", amicable: true });

    expect(callsTo("POST", mandatePath("/terminate"))[0]?.body).toEqual({
      lock_version: 3,
      notice_given_on: TODAY,
      effective_on: "2026-12-01",
      reason: "Accord amiable des parties",
      amicable: true,
      note: "Accord du 10 novembre",
    });
    expect(result.status).toBe("actif");
  });

  it("rattache un préavis insuffisant à la date d'effet", async () => {
    const { source } = setup({ [`POST ${mandatePath("/terminate")}`]: problem(422, "mandate_termination_invalid", "Le préavis de 3 mois n'est pas respecté.") });
    await source.load();

    await expect(source.terminateMandat(ID.mandate, { reason: "Vente", effectIso: "2026-12-01", noticeIso: TODAY, note: "" })).rejects.toMatchObject({ kind: "invalid", field: "effectIso" });
  });
});

describe("modification des conditions", () => {
  it("met à jour les conditions d'un brouillon sur place", async () => {
    const { source, callsTo } = setup({
      [`GET ${mandatePath()}`]: detail({ status: "draft", lock_version: 2 }),
      [`PATCH ${mandatePath()}`]: detail({ status: "draft", lock_version: 3 }),
    });

    await source.patch("mandat", ID.mandate, { payoutDay: 10, worksLimitMinor: 80_000 });

    expect(callsTo("PATCH", mandatePath())[0]?.body).toEqual({ lock_version: 2, terms: { fee_kind: "percentage", fee_basis_points: 700, payout_day: 10, works_limit_amount: 80_000, fee_base: "rent_and_charges", fee_minimum_amount: 0, fee_tax_mode: "excl_tax" } });
  });

  it("refuse de modifier sur place un mandat activé et renvoie vers l'avenant signé, sans appel d'écriture", async () => {
    const { source, calls } = setup({ [`GET ${mandatePath()}`]: detail() });

    await expect(source.patch("mandat", ID.mandate, { payoutDay: 10 })).rejects.toMatchObject({ kind: "invalid", message: AMEND_ACTIVE_BY_AVENANT });
    expect(calls.filter((call) => call.method !== "GET")).toHaveLength(0);
  });

  it("n'invente pas de modification pour les fiches que l'API ne porte pas", async () => {
    const { source, calls } = setup();

    await expect(source.patch("mandant", ID.mandant, { email: "x@example.com" })).rejects.toMatchObject({ kind: "unavailable" });
    expect(calls).toHaveLength(0);
  });

  it.each(["createMandant", "createBail", "createBien", "createInvitation", "sendAvis"] as const)("%s est indisponible sans appel réseau", async (name) => {
    const { source, calls } = setup();

    await expect((source[name] as (input: never) => Promise<unknown>)(undefined as never)).rejects.toMatchObject({ kind: "unavailable" });
    expect(calls).toHaveLength(0);
  });
});

describe("options des formulaires", () => {
  it("compose mandants, lots et types depuis le carnet d'adresses, le patrimoine et le catalogue", async () => {
    const { source } = setup({
      [`GET ${orgPath("/parties")}`]: { body: page([{ id: ID.mandant, kind: "person", display_name: "Claire Vasseur", is_anonymized: false, archived_at: null }, { id: ID.company, kind: "company", display_name: "SCI Horizon", is_anonymized: false, archived_at: null }, { id: "01934f6e-0000-7000-8000-0000000000b3", kind: "person", display_name: "Ancien", is_anonymized: false, archived_at: "2026-01-01T00:00:00+00:00" }]) },
      [`GET ${orgPath("/units")}`]: { body: page([{ id: ID.unitA, reference: "A12", property: { id: ID.property, name: "Résidence du Port" }, archived_at: null }]) },
      [`GET ${orgPath("/catalog/vocabularies/mandate_type/terms")}`]: { body: { data: [{ id: ID.type, key: "gestion", labels: { fr: "Mandat de gestion" }, semantic_key: "management", archived: false }] } },
    });

    const options = await source.formOptions?.();

    expect(options?.mandants).toEqual([
      { id: ID.mandant, name: "Claire Vasseur", legal: "Particulier" },
      { id: ID.company, name: "SCI Horizon", legal: "Personne morale" },
    ]);
    expect(options?.units).toEqual([{ id: ID.unitA, reference: "A12", propertyName: "Résidence du Port" }]);
    expect(options?.types).toEqual([{ id: ID.type, key: "gestion", label: "Mandat de gestion", semanticKey: "management" }]);
  });
});

describe("monthsToExtend", () => {
  it.each([
    ["2028-12-31", "2029-12-31", 12],
    ["2028-12-31", "2029-03-31", 3],
    ["2026-06-30", "2026-09-30", 3],
  ])("de %s à %s : %i mois", (from, to, months) => {
    expect(monthsToExtend(from, to)).toBe(months);
  });

  it.each([["2028-12-31", "2029-12-15"], ["2028-12-31", "2028-12-31"], ["2028-12-31", "2028-06-30"], ["2028-12-31", "2040-01-01"]])("refuse %s vers %s", (from, to) => {
    expect(() => monthsToExtend(from, to)).toThrow();
  });
});
