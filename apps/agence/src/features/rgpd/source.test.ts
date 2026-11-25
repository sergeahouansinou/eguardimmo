import { describe, expect, it } from "vitest";
import { OrgApiError } from "@/features/org/errors";
import { ORG_ID, ORG_ROOT, fakeClient, problem } from "@/features/org/testing";
import { createApiRgpdSource } from "./source";

const FORWARD = "01934f6e-0000-7000-8000-0000000007a1";

const forward = {
  id: FORWARD,
  kind: "erasure",
  requester: { name: "Pauline Lefort", email: "pauline.lefort@example.com" },
  deadline: "2026-12-04T23:59:59+00:00",
  forwarded_at: "2026-11-05T09:12:00+00:00",
  handled: false,
  handled_at: null,
};

describe("source API des demandes RGPD", () => {
  it("liste les demandes transmises avec le curseur", async () => {
    const client = fakeClient(() => ({ data: [forward], meta: { has_more: true, next_cursor: "suite" } }));
    const page = await createApiRgpdSource({ client, organizationId: ORG_ID }).list("debut");
    expect(client.calls[0]).toMatchObject({ method: "GET", path: `${ORG_ROOT}/privacy-requests`, query: { per_page: 25, cursor: "debut" } });
    expect(page.nextCursor).toBe("suite");
    expect(page.items[0]).toEqual({ id: FORWARD, kind: "erasure", requesterName: "Pauline Lefort", requesterEmail: "pauline.lefort@example.com", deadline: "2026-12-04T23:59:59+00:00", forwardedAt: "2026-11-05T09:12:00+00:00", handled: false, handledAt: null });
  });

  it("marque une transmission comme traitée sans corps ni clé d’idempotence", async () => {
    const client = fakeClient(() => ({ data: { ...forward, handled: true, handled_at: "2026-11-13T10:02:00+00:00" } }));
    const result = await createApiRgpdSource({ client, organizationId: ORG_ID }).markHandled(FORWARD);
    expect(client.calls[0]).toMatchObject({ method: "POST", path: `${ORG_ROOT}/privacy-requests/${FORWARD}/handled` });
    expect(client.calls[0]?.body).toBeUndefined();
    expect(result.handled).toBe(true);
    expect(result.handledAt).toBe("2026-11-13T10:02:00+00:00");
  });

  it("refuse un type de demande inconnu plutôt que de l’afficher tel quel", async () => {
    const client = fakeClient(() => ({ data: [{ ...forward, kind: "autre" }] }));
    const failure = await createApiRgpdSource({ client, organizationId: ORG_ID }).list(null).catch((error: unknown) => error);
    expect(failure).toBeInstanceOf(OrgApiError);
    expect((failure as OrgApiError).kind).toBe("unexpected_response");
  });

  it.each([
    [403, "role_forbidden", "forbidden", /titulaire et les administrateurs/],
    [404, "privacy_request_not_found", "not_found", /n’existe plus/],
    [429, "too_many_requests", "rate_limited", /Trop de requêtes/],
  ] as const)("traduit %i en erreur %s", async (status, code, kind, message) => {
    const client = fakeClient(() => problem(status, code, "Détail brut."));
    const failure = await createApiRgpdSource({ client, organizationId: ORG_ID }).markHandled(FORWARD).catch((error: unknown) => error);
    expect((failure as OrgApiError).kind).toBe(kind);
    expect((failure as OrgApiError).message).toMatch(message);
  });
});
