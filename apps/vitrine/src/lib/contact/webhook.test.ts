// @vitest-environment node
import { describe, expect, it, vi } from "vitest";
import { resolveWebhook, sendToWebhook } from "./webhook";
import type { FetchLike } from "./webhook";
import { sentBody } from "../../../test/body";

const HOSTS = "hooks.example.org, autre.example.org";

describe("résolution du webhook (SSRF)", () => {
  it("non configuré quand l’adresse est vide", () => {
    expect(resolveWebhook({ url: undefined, allowedHosts: HOSTS })).toEqual({ status: "unconfigured" });
    expect(resolveWebhook({ url: "  ", allowedHosts: HOSTS })).toEqual({ status: "unconfigured" });
  });

  it("accepte une adresse https dont l’hôte est dans la liste blanche, sans tenir compte de la casse", () => {
    const result = resolveWebhook({ url: "https://Hooks.Example.org/v1/contact?token=abc", allowedHosts: HOSTS });
    expect(result.status).toBe("ready");
  });

  it.each([
    ["http en clair", "http://hooks.example.org/x"],
    ["hôte absent de la liste", "https://pirate.example.net/x"],
    ["identifiants dans l’adresse", "https://u:p@hooks.example.org/x"],
    ["port explicite", "https://hooks.example.org:8443/x"],
    ["localhost", "https://localhost/x"],
    ["adresse IPv4 privée", "https://10.0.0.5/x"],
    ["adresse de métadonnées cloud", "https://169.254.169.254/latest"],
    ["IPv4 écrite en hexadécimal", "https://0x7f.1/x"],
    ["IPv4 en entier", "https://2130706433/x"],
    ["IPv6", "https://[::1]/x"],
    ["nom interne", "https://service.internal/x"],
    ["nom sans point", "https://intranet/x"],
    ["adresse illisible", "pas une adresse"],
  ])("refuse : %s", (_label, url) => {
    const result = resolveWebhook({ url, allowedHosts: "hooks.example.org,localhost,10.0.0.5,169.254.169.254,service.internal,intranet,0x7f.1,2130706433,[::1]" });
    expect(result.status).toBe("invalid");
  });

  it("refuse tout hôte quand la liste blanche est vide", () => {
    expect(resolveWebhook({ url: "https://hooks.example.org/x", allowedHosts: "" }).status).toBe("invalid");
    expect(resolveWebhook({ url: "https://hooks.example.org/x", allowedHosts: undefined }).status).toBe("invalid");
  });
});

describe("envoi au webhook", () => {
  const input = { organisation: "Agence", email: "a@exemple.fr", profil: "agence" as const, consentement: true as const };
  const url = new URL("https://hooks.example.org/x");

  it("poste le JSON sans suivre les redirections et signale le succès", async () => {
    const fetchImpl = vi.fn<FetchLike>().mockResolvedValue(new Response(null, { status: 200 }));
    const sent = await sendToWebhook(url, input, new Date("2026-11-21T10:00:00Z"), fetchImpl);
    expect(sent).toBe(true);
    const [target, init] = fetchImpl.mock.calls[0] ?? [];
    expect(target).toBe("https://hooks.example.org/x");
    expect(init?.method).toBe("POST");
    expect(init?.redirect).toBe("error");
    expect(sentBody(init)).toEqual({
      source: "vitrine",
      receivedAt: "2026-11-21T10:00:00.000Z",
      organisation: "Agence",
      email: "a@exemple.fr",
      profil: "agence",
      message: "",
    });
  });

  it("signale l’échec sur statut non 2xx ou erreur réseau", async () => {
    expect(await sendToWebhook(url, input, new Date(), vi.fn<FetchLike>().mockResolvedValue(new Response(null, { status: 500 })))).toBe(false);
    expect(await sendToWebhook(url, input, new Date(), vi.fn<FetchLike>().mockRejectedValue(new Error("réseau")))).toBe(false);
  });
});
