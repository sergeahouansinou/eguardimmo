import { describe, expect, it } from "vitest";
import { MandatesApiError } from "./apiErrors";
import { createApiMandatesSource } from "./mandatesSource";
import { ID, ORG, mandantRow, mandateDetail, mandateSummary, mockApi, orgPath, page, problem, unitLine } from "./testing";

const detailReply = (overrides = {}, status = 200) => ({ status, body: { data: mandateDetail(overrides) } });
const mandatePath = (suffix = "") => orgPath(`/mandates/${ID.mandate}${suffix}`);

function sourceWith(routes: Parameters<typeof mockApi>[0]) {
  const api = mockApi(routes);
  return { ...api, source: createApiMandatesSource({ client: api.client, organizationId: ORG }) };
}

describe("lecture des mandats", () => {
  it("liste avec filtres et curseur, sous le préfixe de l'organisation", async () => {
    const { source, callsTo } = sourceWith({ [`GET ${orgPath("/mandates")}`]: { body: page([mandateSummary()], "abc") } });

    const result = await source.list({ search: "Vasseur", status: "active", mandantId: ID.mandant, unitId: ID.unitA, archived: true, cursor: "c1", perPage: 50 });

    expect(result.items).toHaveLength(1);
    expect(result.nextCursor).toBe("abc");
    const [call] = callsTo("GET", orgPath("/mandates"));
    expect(Object.fromEntries(call?.search ?? [])).toEqual({ per_page: "50", cursor: "c1", q: "Vasseur", status: "active", mandant: ID.mandant, unit: ID.unitA, archived: "1" });
  });

  it("suit le curseur jusqu'à la dernière page", async () => {
    const { source, callsTo } = sourceWith({
      [`GET ${orgPath("/mandates")}`]: (call) => (call.search.get("cursor") === null ? { body: page([mandateSummary()], "page-2") } : { body: page([mandateSummary({ id: ID.other, reference: "M-2026-0002" })]) }),
    });

    const all = await source.listAll();

    expect(all.map((item) => item.reference)).toEqual(["M-2026-0001", "M-2026-0002"]);
    expect(callsTo("GET", orgPath("/mandates"))).toHaveLength(2);
  });

  it("refuse une réponse qui ne respecte pas le contrat", async () => {
    const { source } = sourceWith({ [`GET ${orgPath("/mandates")}`]: { body: page([{ ...mandateSummary(), status: "inconnu" }]) } });

    await expect(source.list()).rejects.toMatchObject({ kind: "unexpected_response" });
  });

  it("lit le détail avec l'historique des conditions", async () => {
    const { source } = sourceWith({ [`GET ${mandatePath()}`]: detailReply() });

    const detail = await source.get(ID.mandate);

    expect(detail.lock_version).toBe(3);
    expect(detail.terms_history).toHaveLength(1);
  });

  it("pagine la liste des mandants avec le curseur after", async () => {
    const rows = Array.from({ length: 200 }, (_, position) => mandantRow({ party_id: `01934f6e-0000-7000-8000-${String(position).padStart(12, "0")}` }));
    const { source, callsTo } = sourceWith({
      [`GET ${orgPath("/mandates/mandants")}`]: (call) => ({ body: { data: call.search.get("after") === null ? rows : [mandantRow()] } }),
    });

    const all = await source.mandants();

    expect(all).toHaveLength(201);
    const calls = callsTo("GET", orgPath("/mandates/mandants"));
    expect(calls[0]?.search.get("limit")).toBe("200");
    expect(calls[1]?.search.get("after")).toBe(rows.at(-1)?.party_id);
  });
});

describe("mutations", () => {
  it("crée un brouillon avec les conditions en unités mineures", async () => {
    const { source, callsTo } = sourceWith({ [`POST ${orgPath("/mandates")}`]: detailReply({ status: "draft" }, 201) });

    await source.createDraft({
      mandantPartyId: ID.mandant,
      mandateTypeTermId: ID.type,
      startsOn: "2026-12-01",
      endDate: "2029-11-30",
      tacitRenewal: true,
      currency: "EUR",
      terms: { feeKind: "percentage", feeBasisPoints: 650, payoutDay: 5, worksLimitMinor: 50_000 },
      units: [{ unitId: ID.unitA }, { unitId: ID.unitB, validFrom: "2027-01-01" }],
    });

    expect(callsTo("POST", orgPath("/mandates"))[0]?.body).toEqual({
      mandant_party_id: ID.mandant,
      mandate_type_term_id: ID.type,
      starts_on: "2026-12-01",
      end_date: "2029-11-30",
      tacit_renewal: true,
      currency: "EUR",
      terms: { fee_kind: "percentage", fee_basis_points: 650, payout_day: 5, works_limit_amount: 50_000 },
      units: [{ unit_id: ID.unitA }, { unit_id: ID.unitB, valid_from: "2027-01-01" }],
    });
  });

  it("envoie le forfait et jamais de taux pour des honoraires forfaitaires", async () => {
    const { source, callsTo } = sourceWith({ [`POST ${orgPath("/mandates")}`]: detailReply({ status: "draft" }, 201) });

    await source.createDraft({
      mandantPartyId: ID.mandant,
      mandateTypeTermId: ID.type,
      startsOn: "2026-12-01",
      endDate: "2027-11-30",
      tacitRenewal: false,
      currency: "EUR",
      terms: { feeKind: "flat", feeFlatAmountMinor: 4_500, feeBasisPoints: 700, payoutDay: 10, worksLimitMinor: 0 },
      units: [{ unitId: ID.unitA }],
    });

    expect(callsTo("POST", orgPath("/mandates"))[0]?.body).toMatchObject({ terms: { fee_kind: "flat", fee_flat_amount: 4_500, payout_day: 10, works_limit_amount: 0 } });
    expect(JSON.stringify(callsTo("POST", orgPath("/mandates"))[0]?.body)).not.toContain("fee_basis_points");
  });

  it("met à jour avec la version du mandat", async () => {
    const { source, callsTo } = sourceWith({ [`PATCH ${mandatePath()}`]: detailReply() });

    await source.update(ID.mandate, 3, { endDate: "2029-12-31", terms: { feeKind: "percentage", feeBasisPoints: 800, payoutDay: 6, worksLimitMinor: 60_000 } });

    expect(callsTo("PATCH", mandatePath())[0]?.body).toEqual({
      lock_version: 3,
      end_date: "2029-12-31",
      terms: { fee_kind: "percentage", fee_basis_points: 800, payout_day: 6, works_limit_amount: 60_000 },
    });
  });

  it.each([
    ["activate", (s: ReturnType<typeof sourceWith>["source"]) => s.activate(ID.mandate, 3, "2026-11-13"), { lock_version: 3, signed_on: "2026-11-13" }],
    ["suspend", (s: ReturnType<typeof sourceWith>["source"]) => s.suspend(ID.mandate, 3), { lock_version: 3 }],
    ["resume", (s: ReturnType<typeof sourceWith>["source"]) => s.resume(ID.mandate, 3), { lock_version: 3 }],
    ["renew", (s: ReturnType<typeof sourceWith>["source"]) => s.renew(ID.mandate, 3, 12), { lock_version: 3, months: 12 }],
    [
      "terminate",
      (s: ReturnType<typeof sourceWith>["source"]) => s.terminate(ID.mandate, 3, { noticeGivenOn: "2026-11-16", effectiveOn: "2027-02-16", reason: "Vente des biens", amicable: false, note: "Vente du lot A12" }),
      { lock_version: 3, notice_given_on: "2026-11-16", effective_on: "2027-02-16", reason: "Vente des biens", amicable: false, note: "Vente du lot A12" },
    ],
    [
      "terms",
      (s: ReturnType<typeof sourceWith>["source"]) => s.amendTerms(ID.mandate, 3, { effectiveOn: "2027-01-01", feeBasisPoints: 600, feeKind: "percentage", payoutDay: 10 }),
      { lock_version: 3, effective_on: "2027-01-01", fee_kind: "percentage", fee_basis_points: 600, payout_day: 10 },
    ],
    ["units", (s: ReturnType<typeof sourceWith>["source"]) => s.addUnit(ID.mandate, 3, { unitId: ID.unitB, validFrom: "2027-02-01" }), { lock_version: 3, unit_id: ID.unitB, valid_from: "2027-02-01" }],
    ["units/" + ID.lineA + "/end", (s: ReturnType<typeof sourceWith>["source"]) => s.endUnit(ID.mandate, 3, ID.lineA, "2026-12-31"), { lock_version: 3, end_date: "2026-12-31" }],
  ] as const)("POST …/%s envoie la version et le corps attendus", async (suffix, run, body) => {
    const { source, callsTo } = sourceWith({ [`POST ${mandatePath(`/${suffix}`)}`]: detailReply() });

    await run(source);

    const calls = callsTo("POST", mandatePath(`/${suffix}`));
    expect(calls).toHaveLength(1);
    expect(calls[0]?.body).toEqual(body);
  });

  it("archive par POST et restaure par DELETE sur la même ressource", async () => {
    const { source, callsTo } = sourceWith({ [`POST ${mandatePath("/archive")}`]: detailReply(), [`DELETE ${mandatePath("/archive")}`]: detailReply() });

    await source.archive(ID.mandate);
    await source.restore(ID.mandate);

    expect(callsTo("POST", mandatePath("/archive"))).toHaveLength(1);
    expect(callsTo("DELETE", mandatePath("/archive"))).toHaveLength(1);
  });

  it("retire un lot par DELETE avec la version en paramètre de requête", async () => {
    const { source, calls } = sourceWith({ [`DELETE ${mandatePath(`/units/${ID.lineA}`)}`]: detailReply({ units: [unitLine({ id: ID.lineB })] }) });

    await source.removeUnit(ID.mandate, 3, ID.lineA);

    expect(calls[0]?.method).toBe("DELETE");
    expect(calls[0]?.search.get("lock_version")).toBe("3");
  });
});

describe("erreurs du serveur", () => {
  const stale = problem(409, "mandate_stale_version", "Version périmée");

  it("traduit un conflit de version en proposition de recharger", async () => {
    const { source } = sourceWith({ [`POST ${mandatePath("/suspend")}`]: stale });

    const failure = await source.suspend(ID.mandate, 1).catch((error: unknown) => error);

    expect(failure).toBeInstanceOf(MandatesApiError);
    expect(failure).toMatchObject({ kind: "stale_version", status: 409 });
    expect((failure as MandatesApiError).message).toContain("Rechargez");
  });

  it("explique un chevauchement de mandats sur un lot", async () => {
    const { source } = sourceWith({ [`POST ${mandatePath("/activate")}`]: problem(409, "mandate_overlap", "Chevauchement") });

    const failure = await source.activate(ID.mandate, 3, "2026-11-13").catch((error: unknown) => error);

    expect(failure).toMatchObject({ kind: "overlap" });
    expect((failure as MandatesApiError).message).toContain("Un autre mandat de votre agence couvre déjà un de ces lots");
  });

  it("garde le détail du serveur pour les autres conflits", async () => {
    const { source } = sourceWith({ [`POST ${mandatePath("/activate")}`]: problem(409, "mandate_not_draft", "Seul un brouillon peut être activé.") });

    await expect(source.activate(ID.mandate, 3, "2026-11-13")).rejects.toMatchObject({ kind: "conflict", message: "Seul un brouillon peut être activé." });
  });

  it("remonte les champs en erreur d'un 422", async () => {
    const { source } = sourceWith({ [`POST ${orgPath("/mandates")}`]: problem(422, "validation_failed", "Invalide", { "terms.payout_day": ["Le jour de reversement est entre 1 et 28."] }) });

    const failure = await source
      .createDraft({ mandantPartyId: ID.mandant, mandateTypeTermId: ID.type, startsOn: "2026-12-01", endDate: "2027-11-30", tacitRenewal: false, currency: "EUR", terms: { feeKind: "percentage", feeBasisPoints: 700, payoutDay: 31, worksLimitMinor: 0 }, units: [{ unitId: ID.unitA }] })
      .catch((error: unknown) => error);

    expect(failure).toMatchObject({ kind: "invalid", message: "Le jour de reversement est entre 1 et 28.", fieldErrors: { "terms.payout_day": ["Le jour de reversement est entre 1 et 28."] } });
  });

  it("refuse un rôle sans droit d'écriture avec un message clair", async () => {
    const { source } = sourceWith({ [`POST ${mandatePath("/suspend")}`]: problem(403, "role_forbidden", "Interdit") });

    const failure = await source.suspend(ID.mandate, 3).catch((error: unknown) => error);

    expect(failure).toMatchObject({ kind: "forbidden", status: 403 });
    expect((failure as MandatesApiError).message).toContain("Votre rôle ne permet pas");
  });

  it("distingue l'espace réservé aux agences d'un refus de rôle", async () => {
    const { source } = sourceWith({ [`GET ${orgPath("/mandates")}`]: problem(403, "mandate_agency_only", "Les mandats sont réservés aux agences.") });

    await expect(source.list()).rejects.toMatchObject({ kind: "agency_only" });
  });

  it("n'appelle pas le réseau sans organisation", async () => {
    const api = mockApi({});
    const source = createApiMandatesSource({ client: api.client, organizationId: null });

    await expect(source.list()).rejects.toMatchObject({ kind: "no_organization" });
    expect(api.fetchImpl).not.toHaveBeenCalled();
  });
});
