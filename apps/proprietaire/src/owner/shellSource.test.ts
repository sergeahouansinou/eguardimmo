import { createApiClient } from "@eguardimmo/api";
import { shellSchema } from "@eguardimmo/shell";
import { afterEach, describe, expect, it, vi } from "vitest";
import { API_URL, stubApi } from "../../test/api";
import { ME_RESPONSE } from "./responses.fixtures";
import { NOTIFICATIONS_UNAVAILABLE_MESSAGE, WORKSPACE_NAME, createApiShellSource, toShellData } from "./shellSource";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("source de la coquille en mode api", () => {
  it("construit l'utilisateur depuis /me, sans donnée de démonstration", async () => {
    stubApi({ "GET /api/v1/me": { body: ME_RESPONSE } });

    const data = shellSchema.parse(await createApiShellSource(createApiClient({ baseUrl: API_URL })).shell());

    expect(data.user).toEqual({ firstName: "Aline", fullName: "Aline Dossou", initials: "AD", email: "aline@example.test" });
    expect(data.workspace.name).toBe(WORKSPACE_NAME);
    expect(data.notifications).toEqual([]);
    expect(data.counts).toEqual({});
  });

  it("gère un nom d'un seul mot", () => {
    expect(toShellData({ name: "Aline", email: "a@example.test" }).user.initials).toBe("A");
  });

  it("refuse de marquer des notifications lues", async () => {
    stubApi();

    await expect(createApiShellSource(createApiClient({ baseUrl: API_URL })).markAllNotificationsRead()).rejects.toThrow(NOTIFICATIONS_UNAVAILABLE_MESSAGE);
  });
});
