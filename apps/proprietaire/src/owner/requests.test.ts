import { createApiClient } from "@eguardimmo/api";
import { afterEach, describe, expect, it, vi } from "vitest";
import { stubApi, API_URL } from "../../test/api";
import { UnexpectedResponseError } from "./errors";
import { detachLink, fetchAgencies, fetchLinks, fetchMe } from "./requests";
import { ACCESS_ENTRY, ACCESS_ID, AGENCY_ID, LINKS_RESPONSE, ME_RESPONSE, SECOND_ACCESS_ENTRY, problem } from "./responses.fixtures";

const client = () => createApiClient({ baseUrl: API_URL });

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("requêtes de l'espace propriétaire", () => {
  it("lit les accès et les convertit", async () => {
    const stub = stubApi({ "GET /api/v1/owner/agencies": { body: { data: [ACCESS_ENTRY, { ...SECOND_ACCESS_ENTRY, access_until: "2026-12-31", in_grace: true, read_only: true }] } } });

    const accesses = await fetchAgencies(client());

    expect(accesses).toEqual([
      { accessId: ACCESS_ID, role: "holder", agencyId: AGENCY_ID, agencyName: "Agence du Lac", mandantName: "Famille Dossou", accessUntil: null, inGrace: false, readOnly: false },
      expect.objectContaining({ role: "representative", accessUntil: "2026-12-31", inGrace: true, readOnly: true }),
    ]);
    expect(stub.calls[0]?.query).toEqual({});
  });

  it("transmet le filtre d'agence", async () => {
    const stub = stubApi();

    await fetchAgencies(client(), AGENCY_ID);

    expect(stub.calls.find((call) => call.path === "/api/v1/owner/agencies")?.query).toEqual({ agency: AGENCY_ID });
  });

  it("accepte un nom d'agence absent", async () => {
    stubApi({ "GET /api/v1/owner/agencies": { body: { data: [{ ...ACCESS_ENTRY, agency: { id: AGENCY_ID, name: null } }] } } });

    expect((await fetchAgencies(client()))[0]?.agencyName).toBeNull();
  });

  it("refuse une réponse qui ne respecte pas le contrat", async () => {
    stubApi({ "GET /api/v1/owner/agencies": { body: { data: [{ ...ACCESS_ENTRY, role: "admin" }] } } });

    await expect(fetchAgencies(client())).rejects.toBeInstanceOf(UnexpectedResponseError);
  });

  it("lit les rattachements", async () => {
    stubApi({ "GET /api/v1/owner/links": { body: LINKS_RESPONSE } });

    const links = await fetchLinks(client());

    expect(links).toHaveLength(2);
    expect(links[0]).toEqual({ id: ACCESS_ID, role: "holder", agencyId: AGENCY_ID, agencyName: "Agence du Lac", mandantName: "Famille Dossou", linkedAt: "2026-10-02T09:30:00+00:00" });
  });

  it("détache un accès par son identifiant", async () => {
    const stub = stubApi({ [`DELETE /api/v1/owner/links/${ACCESS_ID}`]: { status: 204 } });

    await detachLink(client(), ACCESS_ID);

    expect(stub.count("DELETE", `/api/v1/owner/links/${ACCESS_ID}`)).toBe(1);
  });

  it("propage l'erreur d'un détachement déjà effectué", async () => {
    stubApi({ [`DELETE /api/v1/owner/links/${ACCESS_ID}`]: problem(404, "owner_access_not_found") });

    await expect(detachLink(client(), ACCESS_ID)).rejects.toMatchObject({ status: 404, code: "owner_access_not_found" });
  });

  it("lit le profil de la coquille", async () => {
    stubApi({ "GET /api/v1/me": { body: ME_RESPONSE } });

    expect(await fetchMe(client())).toEqual({ name: "Aline Dossou", email: "aline@example.test" });
  });
});
