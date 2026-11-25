import { describe, expect, it } from "vitest";
import { OrgApiError } from "@/features/org/errors";
import { ORG_ID, ORG_ROOT, fakeClient, problem } from "@/features/org/testing";
import { createApiAnnoncesSource } from "./source";
import type { ListingPayload } from "./schemas";

const ID = "01934f6e-0000-7000-8000-0000000008a1";

const apiListing = {
  id: ID,
  public_ref: "h9t2x6kq7mre",
  kind: "short_stay",
  category: "studio",
  status: "draft",
  title: "Studio lumineux",
  description: null,
  city: { slug: "paris", name: "Paris", postal_code: "75010" },
  city_id: "01934f6e-0000-7000-8000-0000000000c1",
  neighbourhood: null,
  price: { amount: 8500, currency: "EUR" },
  price_unit: "night",
  deposit: null,
  capacity: 2,
  area_m2: 24,
  rooms: 1,
  amenities: ["wifi"],
  min_nights: 2,
  cancellation_policy: "flexible",
  published_at: null,
  missing_for_publication: [],
  lock_version: 3,
};

const payload: ListingPayload = {
  kind: "short_stay",
  category: "studio",
  title: "Studio lumineux",
  description: null,
  neighbourhood: null,
  priceMinor: 8500,
  currency: "EUR",
  depositMinor: null,
  capacity: 2,
  areaM2: 24,
  rooms: 1,
  amenities: ["wifi"],
  minNights: 2,
  cancellationPolicy: "flexible",
};

describe("source API des annonces", () => {
  it("liste avec filtre de statut et curseur, et convertit la représentation", async () => {
    const client = fakeClient(() => ({ data: [apiListing], meta: { has_more: true, next_cursor: "suite" } }));
    const page = await createApiAnnoncesSource({ client, organizationId: ORG_ID }).list("draft", "debut");
    expect(client.calls[0]).toMatchObject({ method: "GET", path: `${ORG_ROOT}/listings`, query: { per_page: 25, cursor: "debut", status: "draft" } });
    expect(page.nextCursor).toBe("suite");
    expect(page.items[0]).toMatchObject({ id: ID, publicRef: "h9t2x6kq7mre", priceUnit: "night", price: { amount: 8500, currency: "EUR" }, lockVersion: 3, city: { name: "Paris", postalCode: "75010" } });
  });

  it("omet le filtre quand aucun statut n’est choisi", async () => {
    const client = fakeClient(() => ({ data: [] }));
    await createApiAnnoncesSource({ client, organizationId: ORG_ID }).list(null, null);
    expect(client.calls[0]?.query?.status).toBeUndefined();
  });

  it("crée avec le type, sans identifiant ni statut, puis lit une fiche", async () => {
    const client = fakeClient(() => ({ data: apiListing }));
    const source = createApiAnnoncesSource({ client, organizationId: ORG_ID });
    await source.create(payload);
    await source.get(ID);
    expect(client.calls[0]).toMatchObject({ method: "POST", path: `${ORG_ROOT}/listings`, body: { kind: "short_stay", price_minor: 8500, min_nights: 2, cancellation_policy: "flexible", amenities: ["wifi"] } });
    expect(Object.keys(client.calls[0]?.body ?? {})).not.toEqual(expect.arrayContaining(["status", "organization_id", "lock_version", "city_id"]));
    expect(client.calls[1]).toMatchObject({ method: "GET", path: `${ORG_ROOT}/listings/${ID}` });
  });

  it("transmet la version de verrou à la modification, à la publication et à l’archivage, sans le type", async () => {
    const client = fakeClient(() => ({ data: apiListing }));
    const source = createApiAnnoncesSource({ client, organizationId: ORG_ID });
    await source.update(ID, 3, { ...payload, kind: undefined });
    await source.publish(ID, 3);
    await source.archive(ID, 4);
    expect(client.calls[0]).toMatchObject({ method: "PATCH", path: `${ORG_ROOT}/listings/${ID}`, body: { lock_version: 3, title: "Studio lumineux" } });
    expect(client.calls[0]?.body).not.toHaveProperty("kind");
    expect(client.calls[1]).toMatchObject({ method: "POST", path: `${ORG_ROOT}/listings/${ID}/publish`, body: { lock_version: 3 } });
    expect(client.calls[2]).toMatchObject({ method: "POST", path: `${ORG_ROOT}/listings/${ID}/archive`, body: { lock_version: 4 } });
  });

  it("refuse un statut inconnu plutôt que de l’afficher tel quel", async () => {
    const client = fakeClient(() => ({ data: [{ ...apiListing, status: "suspended" }] }));
    const failure = await createApiAnnoncesSource({ client, organizationId: ORG_ID }).list(null, null).catch((error: unknown) => error);
    expect((failure as OrgApiError).kind).toBe("unexpected_response");
  });

  it.each([
    [403, "role_forbidden", "forbidden", /titulaire, les administrateurs et les gestionnaires/],
    [404, "listing_not_found", "not_found", /n’existe pas/],
    [409, "listing_stale_version", "stale", /modifiée depuis sa lecture/],
    [409, "listing_archived", "conflict", /republiez-la d’abord/],
    [422, "listing_incomplete", "invalid", /renseignez le titre/],
    [429, "too_many_requests", "rate_limited", /Trop de requêtes/],
  ] as const)("traduit %i %s en erreur %s", async (status, code, kind, message) => {
    const client = fakeClient(() => problem(status, code, "Détail brut."));
    const failure = await createApiAnnoncesSource({ client, organizationId: ORG_ID }).publish(ID, 3).catch((error: unknown) => error);
    expect((failure as OrgApiError).kind).toBe(kind);
    expect((failure as OrgApiError).message).toMatch(message);
  });
});
