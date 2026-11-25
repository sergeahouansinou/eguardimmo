// @vitest-environment node
import { describe, expect, it, vi } from "vitest";
import { handleContact } from "./handler";
import type { ContactDeps } from "./handler";
import { createRateLimiter } from "./rateLimit";
import { sentBody } from "../../../test/body";
import type { FetchLike, WebhookEnv } from "./webhook";

const SITE = "https://www.exemple.fr";
const VALID = { organisation: "Agence Rhône Immo", email: "contact@agence-exemple.fr", profil: "agence", message: "Bonjour", consentement: true };

interface Setup {
  deps: ContactDeps;
  fetchImpl: ReturnType<typeof vi.fn<FetchLike>>;
  log: ReturnType<typeof vi.fn<(event: string) => void>>;
}

function setup(overrides: Partial<ContactDeps> = {}, webhook: WebhookEnv = { url: "https://hooks.example.org/contact", allowedHosts: "hooks.example.org" }): Setup {
  const fetchImpl = vi.fn<FetchLike>().mockResolvedValue(new Response(null, { status: 200 }));
  const log = vi.fn<(event: string) => void>();
  const deps: ContactDeps = {
    limiter: createRateLimiter({ limit: 3, windowMs: 60_000, maxKeys: 100 }),
    webhook,
    siteOrigin: SITE,
    fetch: fetchImpl,
    now: () => new Date("2026-11-21T10:00:00Z"),
    log,
    ...overrides,
  };
  return { deps, fetchImpl, log };
}

function post(body: unknown, headers: Record<string, string> = {}): Request {
  return new Request(`${SITE}/api/contact`, {
    method: "POST",
    headers: { "content-type": "application/json", "x-forwarded-for": "9.9.9.9", ...headers },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
}

async function json(response: Response): Promise<Record<string, unknown>> {
  return (await response.json()) as Record<string, unknown>;
}

describe("POST /api/contact", () => {
  it("chemin nominal : transmet au webhook configuré et répond 202", async () => {
    const { deps, fetchImpl, log } = setup();
    const response = await handleContact(post(VALID, { origin: SITE }), deps);
    expect(response.status).toBe(202);
    expect(await json(response)).toMatchObject({ code: "accepte" });
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    expect(fetchImpl.mock.calls[0]?.[0]).toBe("https://hooks.example.org/contact");
    expect(sentBody(fetchImpl.mock.calls[0]?.[1])).toMatchObject({ organisation: "Agence Rhône Immo", email: "contact@agence-exemple.fr", profil: "agence" });
    expect(log).toHaveBeenCalledWith("contact.envoye");
  });

  it("n’envoie jamais le leurre, le consentement ni d’autres champs", async () => {
    const { deps, fetchImpl } = setup();
    await handleContact(post({ ...VALID, siteWeb: "" }), deps);
    expect(Object.keys(sentBody(fetchImpl.mock.calls[0]?.[1]) as object).sort()).toEqual(["email", "message", "organisation", "profil", "receivedAt", "source"]);
  });

  it("sans webhook configuré : 503 « envoi non configuré », jamais 202, rien n’est envoyé", async () => {
    const { deps, fetchImpl, log } = setup({}, { url: undefined, allowedHosts: undefined });
    const response = await handleContact(post(VALID), deps);
    expect(response.status).toBe(503);
    const body = await json(response);
    expect(body.code).toBe("envoi_non_configure");
    expect(String(body.message)).toMatch(/Envoi non configuré/);
    expect(fetchImpl).not.toHaveBeenCalled();
    expect(log).toHaveBeenCalledWith("contact.envoi_non_configure");
  });

  it.each([
    ["hôte hors liste blanche", { url: "https://pirate.example.net/x", allowedHosts: "hooks.example.org" }],
    ["adresse IP interne", { url: "https://169.254.169.254/x", allowedHosts: "169.254.169.254" }],
    ["http", { url: "http://hooks.example.org/x", allowedHosts: "hooks.example.org" }],
  ])("webhook refusé (%s) : 503 sans aucun appel sortant", async (_label, webhook) => {
    const { deps, fetchImpl } = setup({}, webhook);
    const response = await handleContact(post(VALID), deps);
    expect(response.status).toBe(503);
    expect((await json(response)).code).toBe("configuration_invalide");
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("échec du webhook : 502, jamais 202", async () => {
    const { deps, fetchImpl } = setup();
    fetchImpl.mockResolvedValue(new Response(null, { status: 500 }));
    const response = await handleContact(post(VALID), deps);
    expect(response.status).toBe(502);
    expect((await json(response)).code).toBe("envoi_impossible");
  });

  it("le journal ne contient aucune donnée personnelle", async () => {
    const { deps, log } = setup();
    await handleContact(post(VALID), deps);
    await handleContact(post({ ...VALID, organisation: "Autre" }, { "x-forwarded-for": "8.8.8.8" }), { ...deps, webhook: { url: undefined, allowedHosts: undefined } });
    const logged = JSON.stringify(log.mock.calls);
    expect(logged).not.toContain("contact@agence-exemple.fr");
    expect(logged).not.toContain("Agence Rhône Immo");
    expect(logged).not.toContain("9.9.9.9");
  });

  it("validation : 422 avec une erreur par champ, rien n’est envoyé", async () => {
    const { deps, fetchImpl } = setup();
    const response = await handleContact(post({ ...VALID, email: "nope", consentement: false }), deps);
    expect(response.status).toBe(422);
    const body = await json(response);
    expect(Object.keys(body.errors as object).sort()).toEqual(["consentement", "email"]);
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("leurre rempli ou champ inconnu : 400 générique, rien n’est envoyé", async () => {
    const { deps, fetchImpl } = setup();
    for (const extra of [{ siteWeb: "http://spam.example" }, { role: "admin" }]) {
      const response = await handleContact(post({ ...VALID, ...extra }), deps);
      expect(response.status).toBe(400);
      expect((await json(response)).code).toBe("requete_invalide");
    }
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("corps illisible, tableau ou nul : 400", async () => {
    const { deps } = setup();
    expect((await handleContact(post("{pas du json"), deps)).status).toBe(400);
    expect((await handleContact(post("[]"), deps)).status).toBe(400);
    expect((await handleContact(post("null"), deps)).status).toBe(400);
  });

  it("type de contenu non JSON : 415", async () => {
    const { deps } = setup();
    expect((await handleContact(post(JSON.stringify(VALID), { "content-type": "text/plain" }), deps)).status).toBe(415);
  });

  it("corps trop volumineux : 413, déclaré ou réel", async () => {
    const { deps, fetchImpl } = setup();
    const big = JSON.stringify({ ...VALID, message: "x".repeat(20_000) });
    expect((await handleContact(post(big), deps)).status).toBe(413);
    expect((await handleContact(post(JSON.stringify(VALID), { "content-length": "999999" }), deps)).status).toBe(413);
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("origine étrangère : 403", async () => {
    const { deps, fetchImpl } = setup();
    const response = await handleContact(post(VALID, { origin: "https://pirate.example.net" }), deps);
    expect(response.status).toBe(403);
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("limitation de débit par IP : 429 avec Retry-After après la limite, une autre IP passe", async () => {
    const { deps } = setup({ limiter: createRateLimiter({ limit: 2, windowMs: 60_000, maxKeys: 100 }) });
    expect((await handleContact(post(VALID), deps)).status).toBe(202);
    expect((await handleContact(post(VALID), deps)).status).toBe(202);
    const blocked = await handleContact(post(VALID), deps);
    expect(blocked.status).toBe(429);
    expect(Number(blocked.headers.get("retry-after"))).toBeGreaterThan(0);
    expect((await handleContact(post(VALID, { "x-forwarded-for": "7.7.7.7" }), deps)).status).toBe(202);
  });
});
