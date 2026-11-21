import { describe, expect, it, vi } from "vitest";
import { downloadTransmission } from "./download";

const TOKEN = "aB3dE5gH7jK9mN1pQ3sT5vW7yZ9bC2dE4fG6hJ8kL0mN2pQ4";
const BASE = "https://api.test";

const problem = (status: number, code: string, extra: Record<string, unknown> = {}, headers: Record<string, string> = {}) =>
  new Response(JSON.stringify({ status, code, ...extra }), { status, headers: { "Content-Type": "application/problem+json", ...headers } });

const zip = (body = "PK-fixture-zip") => new Response(body, { status: 200, headers: { "Content-Type": "application/zip" } });

describe("téléchargement par lien", () => {
  it("appelle l’endpoint public sans cookie, sans référent et renvoie le ZIP", async () => {
    const fetchImpl = vi.fn<typeof fetch>(() => Promise.resolve(zip()));

    const outcome = await downloadTransmission(TOKEN, `${BASE}/`, fetchImpl);

    expect(outcome.kind).toBe("ok");
    if (outcome.kind === "ok") expect(await outcome.blob.text()).toBe("PK-fixture-zip");
    const [url, init] = fetchImpl.mock.calls[0] ?? [];
    expect(url).toBe(`${BASE}/api/v1/recovery/downloads/${TOKEN}`);
    expect(init).toMatchObject({ method: "GET", credentials: "omit", referrerPolicy: "no-referrer", cache: "no-store" });
    expect(Object.keys(init?.headers ?? {}).map((name) => name.toLowerCase())).toEqual(["accept"]);
  });

  it("répond « introuvable » pour un 404, quel qu’en soit le motif", async () => {
    for (const code of ["recovery_link_not_found", "autre_code"]) {
      const outcome = await downloadTransmission(TOKEN, BASE, () => Promise.resolve(problem(404, code)));
      expect(outcome).toEqual({ kind: "not_found" });
    }
  });

  it("lit le délai d’un 429 dans l’en-tête, puis dans le corps, puis prend 60 secondes", async () => {
    const header = await downloadTransmission(TOKEN, BASE, () => Promise.resolve(problem(429, "too_many_requests", { retry_after: 10 }, { "Retry-After": "45" })));
    const body = await downloadTransmission(TOKEN, BASE, () => Promise.resolve(problem(429, "too_many_requests", { retry_after: 20 })));
    const none = await downloadTransmission(TOKEN, BASE, () => Promise.resolve(new Response("pas du json", { status: 429 })));

    expect(header).toEqual({ kind: "rate_limited", retryAfterSeconds: 45 });
    expect(body).toEqual({ kind: "rate_limited", retryAfterSeconds: 20 });
    expect(none).toEqual({ kind: "rate_limited", retryAfterSeconds: 60 });
  });

  it("borne un délai absurde", async () => {
    const outcome = await downloadTransmission(TOKEN, BASE, () => Promise.resolve(problem(429, "too_many_requests", {}, { "Retry-After": "999999" })));
    expect(outcome).toEqual({ kind: "rate_limited", retryAfterSeconds: 3600 });
  });

  it("signale une indisponibilité pour une erreur serveur ou une réponse qui n’est pas un ZIP", async () => {
    expect(await downloadTransmission(TOKEN, BASE, () => Promise.resolve(problem(503, "recovery_bundle_unavailable")))).toEqual({ kind: "unavailable" });
    expect(await downloadTransmission(TOKEN, BASE, () => Promise.resolve(new Response("<html>", { status: 200, headers: { "Content-Type": "text/html" } })))).toEqual({ kind: "unavailable" });
  });

  it("signale un serveur injoignable", async () => {
    expect(await downloadTransmission(TOKEN, BASE, () => Promise.reject(new TypeError("network")))).toEqual({ kind: "unreachable" });
  });
});
