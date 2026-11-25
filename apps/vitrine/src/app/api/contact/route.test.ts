// @vitest-environment node
import { afterEach, describe, expect, it, vi } from "vitest";

const VALID = { organisation: "Agence Rhône Immo", email: "contact@agence-exemple.fr", profil: "agence", consentement: true };

function request(ip: string): Request {
  return new Request("http://localhost:3070/api/contact", {
    method: "POST",
    headers: { "content-type": "application/json", "x-forwarded-for": ip },
    body: JSON.stringify(VALID),
  });
}

async function loadRoute() {
  vi.resetModules();
  return import("./route");
}

describe("route handler /api/contact", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it("sans CONTACT_WEBHOOK_URL : 503 et aucun appel sortant", async () => {
    vi.stubEnv("CONTACT_WEBHOOK_URL", "");
    const outgoing = vi.fn();
    vi.stubGlobal("fetch", outgoing);
    const { POST } = await loadRoute();
    const response = await POST(request("10.1.1.1"));
    expect(response.status).toBe(503);
    expect(outgoing).not.toHaveBeenCalled();
  });

  it("avec un webhook autorisé : 202 après un envoi réel au webhook", async () => {
    vi.stubEnv("CONTACT_WEBHOOK_URL", "https://hooks.example.org/contact");
    vi.stubEnv("CONTACT_WEBHOOK_ALLOWED_HOSTS", "hooks.example.org");
    const outgoing = vi.fn().mockResolvedValue(new Response(null, { status: 204 }));
    vi.stubGlobal("fetch", outgoing);
    const { POST } = await loadRoute();
    const response = await POST(request("10.2.2.2"));
    expect(response.status).toBe(202);
    expect(outgoing).toHaveBeenCalledTimes(1);
  });
});
