import { describe, expect, it } from "vitest";
import { OrgApiError } from "@/features/org/errors";
import { ORG_ID, ORG_ROOT, fakeClient, problem } from "@/features/org/testing";
import { createApiChampsSource } from "./source";
import type { FieldPayload } from "./schemas";

const FIELD_ID = "01934f6e-0000-7000-8000-0000000009c1";

const apiField = {
  id: FIELD_ID,
  entity: "unit",
  key: "exposition",
  labels: { fr: "Exposition", en: "Aspect" },
  type: "select",
  vocabulary: null,
  options: [{ key: "nord", labels: { fr: "Nord" } }],
  required: false,
  position: 2,
  type_locked: true,
  archived: false,
};

const payload: FieldPayload = { key: "exposition", labels: { fr: "Exposition" }, type: "select", vocabulary: null, options: [{ key: "nord", labels: { fr: "Nord" } }], required: true };

describe("source API des champs personnalisés", () => {
  it("liste les champs d’un objet et convertit les clés de l’API", async () => {
    const client = fakeClient(() => ({ data: [apiField, { ...apiField, id: "autre", type: "text", options: null, labels: [] }] }));
    const fields = await createApiChampsSource({ client, organizationId: ORG_ID }).list("unit", false);
    expect(client.calls[0]).toMatchObject({ method: "GET", path: `${ORG_ROOT}/catalog/custom-fields/unit` });
    expect(client.calls[0]?.query).toBeUndefined();
    expect(fields[0]).toMatchObject({ id: FIELD_ID, typeLocked: true, options: [{ key: "nord", labels: { fr: "Nord" } }] });
    expect(fields[1]).toMatchObject({ options: [], labels: {} });
  });

  it("demande les champs archivés seulement à la demande", async () => {
    const client = fakeClient(() => ({ data: [] }));
    await createApiChampsSource({ client, organizationId: ORG_ID }).list("party", true);
    expect(client.calls[0]?.query).toEqual({ include_archived: 1 });
    expect(client.calls[0]?.path).toBe(`${ORG_ROOT}/catalog/custom-fields/party`);
  });

  it("crée avec la clé, modifie sans la clé, archive et restaure", async () => {
    const client = fakeClient(() => ({ data: apiField }));
    const source = createApiChampsSource({ client, organizationId: ORG_ID });
    await source.create("unit", payload);
    await source.update(FIELD_ID, payload);
    await source.archive(FIELD_ID);
    await source.restore(FIELD_ID);
    expect(client.calls[0]).toMatchObject({ method: "POST", path: `${ORG_ROOT}/catalog/custom-fields/unit`, body: { key: "exposition", labels: { fr: "Exposition" }, type: "select", required: true } });
    expect(client.calls[1]).toMatchObject({ method: "PATCH", path: `${ORG_ROOT}/catalog/custom-fields/${FIELD_ID}` });
    expect(client.calls[1]?.body).not.toHaveProperty("key");
    expect(client.calls[2]).toMatchObject({ method: "POST", path: `${ORG_ROOT}/catalog/custom-fields/${FIELD_ID}/archive` });
    expect(client.calls[3]).toMatchObject({ method: "DELETE", path: `${ORG_ROOT}/catalog/custom-fields/${FIELD_ID}/archive` });
  });

  it("refuse un type inconnu plutôt que de l’afficher tel quel", async () => {
    const client = fakeClient(() => ({ data: [{ ...apiField, type: "couleur" }] }));
    const failure = await createApiChampsSource({ client, organizationId: ORG_ID }).list("unit", false).catch((error: unknown) => error);
    expect((failure as OrgApiError).kind).toBe("unexpected_response");
  });

  it.each([
    [403, "role_forbidden", "forbidden", /titulaire et les administrateurs/],
    [404, "custom_field_not_found", "not_found", /n’existe plus/],
    [409, "custom_field_type_locked", "conflict", /ne change plus/],
    [429, "too_many_requests", "rate_limited", /Trop de requêtes/],
  ] as const)("traduit %i en erreur %s", async (status, code, kind, message) => {
    const client = fakeClient(() => problem(status, code, "Détail brut."));
    const failure = await createApiChampsSource({ client, organizationId: ORG_ID }).update(FIELD_ID, payload).catch((error: unknown) => error);
    expect((failure as OrgApiError).kind).toBe(kind);
    expect((failure as OrgApiError).message).toMatch(message);
  });

  it("transmet les erreurs de validation par champ", async () => {
    const client = fakeClient(() => problem(422, "validation_failed", "Invalide.", { key: ["La clé est déjà utilisée."] }));
    const failure = await createApiChampsSource({ client, organizationId: ORG_ID }).create("unit", payload).catch((error: unknown) => error);
    expect((failure as OrgApiError).kind).toBe("invalid");
    expect((failure as OrgApiError).fieldErrors).toEqual({ key: ["La clé est déjà utilisée."] });
  });
});
