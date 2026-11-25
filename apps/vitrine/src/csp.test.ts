import { afterEach, describe, expect, it, vi } from "vitest";

async function policyFor(nodeEnv: string): Promise<string> {
  vi.stubEnv("NODE_ENV", nodeEnv);
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

describe("en-têtes de sécurité de apps/vitrine", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  it("en production : CSP fermée, aucune origine externe, pas d’eval", async () => {
    const policy = await policyFor("production");
    expect(directive(policy, "default-src")).toEqual(["'self'"]);
    expect(directive(policy, "connect-src")).toEqual(["'self'"]);
    expect(directive(policy, "frame-ancestors")).toEqual(["'none'"]);
    expect(directive(policy, "form-action")).toEqual(["'self'"]);
    expect(directive(policy, "object-src")).toEqual(["'none'"]);
    expect(policy).not.toContain("unsafe-eval");
    expect(policy).toContain("upgrade-insecure-requests");
  });

  it("n’expose pas X-Powered-By et pose les en-têtes durcis", async () => {
    vi.resetModules();
    const { default: config } = await import("../next.config");
    expect(config.poweredByHeader).toBe(false);
    const keys = (await config.headers?.())?.[0]?.headers.map((entry) => entry.key) ?? [];
    expect(keys).toEqual(expect.arrayContaining(["X-Content-Type-Options", "Strict-Transport-Security", "Referrer-Policy", "X-Frame-Options"]));
  });
});
