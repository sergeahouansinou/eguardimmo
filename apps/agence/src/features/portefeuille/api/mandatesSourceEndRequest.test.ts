import { describe, expect, it } from "vitest";
import { createApiMandatesSource } from "./mandatesSource";
import { ID, ORG, mandateSummary, mockApi, orgPath, page, problem } from "./testing";

const ENDPOINT = orgPath(`/mandates/${ID.mandate}/end-request`);
const DISMISS = `${ENDPOINT}/dismiss`;

const request = (overrides: Record<string, unknown> = {}) => ({
  id: "01934f6e-0000-7000-8000-0000000000e9",
  mandate_id: ID.mandate,
  status: "dismissed",
  reason: "Je vends.",
  requested_at: "2026-11-14T09:15:00+00:00",
  cancelled_at: null,
  decided_at: "2026-11-16T10:00:00+00:00",
  decision_note: "Vu au téléphone.",
  ...overrides,
});

function sourceWith(routes: Parameters<typeof mockApi>[0]) {
  const api = mockApi(routes);
  return { ...api, source: createApiMandatesSource({ client: api.client, organizationId: ORG }) };
}

describe("demandes de fin de mandat côté serveur", () => {
  it.each(["pending", "dismissed", "fulfilled", "cancelled"])("lit une demande à l'état %s", async (status) => {
    const { source } = sourceWith({ [`GET ${ENDPOINT}`]: { body: { data: request({ status }) } } });

    await expect(source.endRequest(ID.mandate)).resolves.toMatchObject({ status, decision_note: "Vu au téléphone." });
  });

  it("refuse un état de demande inconnu", async () => {
    const { source } = sourceWith({ [`GET ${ENDPOINT}`]: { body: { data: request({ status: "archived" }) } } });

    await expect(source.endRequest(ID.mandate)).rejects.toMatchObject({ kind: "unexpected_response" });
  });

  it("poste le classement avec la note, ou un corps vide sans note", async () => {
    const { source, callsTo } = sourceWith({ [`POST ${DISMISS}`]: { body: { data: request() } } });

    await source.dismissEndRequest(ID.mandate, "Vu au téléphone.");
    await source.dismissEndRequest(ID.mandate, null);

    expect(callsTo("POST", DISMISS).map((call) => call.body)).toEqual([{ note: "Vu au téléphone." }, {}]);
  });

  it("n'accepte comme classement qu'une demande à l'état dismissed", async () => {
    const { source } = sourceWith({ [`POST ${DISMISS}`]: { body: { data: request({ status: "pending" }) } } });

    await expect(source.dismissEndRequest(ID.mandate, null)).rejects.toMatchObject({ kind: "unexpected_response" });
  });

  it.each([
    [409, "mandate_end_request_not_pending", "conflict", "a déjà été traitée ou retirée"],
    [404, "mandate_end_request_not_found", "not_found", "Il n’y a plus de demande"],
    [404, "mandate_not_found", "not_found", "n’existe plus"],
    [403, "role_forbidden", "forbidden", "Votre rôle ne permet pas"],
  ])("traduit %i %s", async (status, code, kind, text) => {
    const { source } = sourceWith({ [`POST ${DISMISS}`]: problem(status, code, "Message brut du serveur") });

    const failure = await source.dismissEndRequest(ID.mandate, null).catch((error: unknown) => error);

    expect(failure).toMatchObject({ kind, status, code });
    expect((failure as Error).message).toContain(text);
    expect((failure as Error).message).not.toContain("Message brut");
  });

  it("exige le drapeau has_end_request dans la liste des mandats", async () => {
    const withoutFlag = Object.fromEntries(Object.entries(mandateSummary()).filter(([key]) => key !== "has_end_request"));
    const { source } = sourceWith({ [`GET ${orgPath("/mandates")}`]: { body: page([withoutFlag]) } });

    await expect(source.list()).rejects.toMatchObject({ kind: "unexpected_response" });
  });
});
