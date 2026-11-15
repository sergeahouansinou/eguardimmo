import { describe, expect, it } from "vitest";
import * as api from "./responses.fixtures";
import { UNAVAILABLE_MESSAGE } from "./index";
import { noContent, problem, setup } from "./testing";

describe("source API : appareils", () => {
  it("révoque un appareil par son identifiant", async () => {
    const { source, call } = setup([noContent()]);

    await source.signOutDevice(api.IDS.device);
    expect(call(0).method).toBe("DELETE");
    expect(call(0).url.pathname).toBe(`/api/v1/me/devices/${api.IDS.device}`);
  });

  it("propage 401 (session expirée), 404 (appareil inconnu) et 429", async () => {
    await expect(setup([problem(401, "unauthenticated")]).source.signOutDevice(api.IDS.device)).rejects.toMatchObject({ status: 401 });
    await expect(setup([problem(404, "not_found")]).source.signOutDevice(api.IDS.device)).rejects.toMatchObject({ status: 404 });
    await expect(setup([problem(429, "too_many_requests", { retryAfter: 5 })]).source.signOutDevice(api.IDS.device)).rejects.toMatchObject({
      status: 429,
      retryAfterSeconds: 5,
    });
  });

  it("n’invente pas la déconnexion des autres appareils : erreur explicite sans appel réseau", async () => {
    const { source, fetchImpl } = setup([]);

    await expect(source.signOutOtherDevices()).rejects.toThrow(UNAVAILABLE_MESSAGE);
    expect(fetchImpl).not.toHaveBeenCalled();
  });
});
