import { afterEach, describe, expect, it, vi } from "vitest";

const API = "https://api.exemple.test";

async function policyFor(nodeEnv: string, apiUrl: string | undefined): Promise<string> {
  vi.stubEnv("NODE_ENV", nodeEnv);
  if (apiUrl === undefined) vi.stubEnv("NEXT_PUBLIC_API_URL", "");
  else vi.stubEnv("NEXT_PUBLIC_API_URL", apiUrl);
  vi.resetModules();
  const { default: config } = await import("../next.config");
  const rules = await config.headers?.();
  const header = rules?.[0]?.headers.find((entry) => entry.key === "Content-Security-Policy");
  if (!header) throw new Error("CSP absente de next.config.ts.");
  return header.value;
}

function directive(policy: string, name: string): string[] {
  const found = policy.split("; ").find((entry) => entry.startsWith(`${name} `));
  return found ? found.slice(name.length + 1).split(" ") : [];
}

describe("CSP de apps/sebook", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  it("en production : fermée, scripts sans eval, API injectée dans connect-src seulement", async () => {
    const policy = await policyFor("production", `${API}/`);
    expect(directive(policy, "default-src")).toEqual(["'self'"]);
    expect(directive(policy, "script-src")).toEqual(["'self'", "'unsafe-inline'"]);
    expect(directive(policy, "connect-src")).toEqual(["'self'", API]);
    expect(directive(policy, "frame-src")).toEqual(["'none'"]);
    expect(directive(policy, "object-src")).toEqual(["'none'"]);
    expect(directive(policy, "base-uri")).toEqual(["'self'"]);
    expect(directive(policy, "form-action")).toEqual(["'self'"]);
    expect(directive(policy, "frame-ancestors")).toEqual(["'none'"]);
    expect(policy).toContain("; upgrade-insecure-requests");
    expect(policy).not.toContain("unsafe-eval");
    expect(policy.split(API)).toHaveLength(2);
  });

  it("sans variable d’API : aucune origine externe n’est ajoutée", async () => {
    const policy = await policyFor("production", undefined);
    expect(directive(policy, "connect-src")).toEqual(["'self'"]);
  });

  it("en développement : eval et rechargement à chaud locaux seulement", async () => {
    const policy = await policyFor("development", API);
    expect(directive(policy, "script-src")).toContain("'unsafe-eval'");
    expect(directive(policy, "connect-src")).toEqual(["'self'", API, "ws://localhost:*", "ws://127.0.0.1:*"]);
    expect(policy).not.toContain("upgrade-insecure-requests");
  });
});
