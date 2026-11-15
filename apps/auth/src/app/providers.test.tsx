import { render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

async function renderProviders() {
  const { Providers } = await import("./providers");
  const { useAuthSource } = await import("@/features/auth/source");
  const Probe = () => <span>source:{useAuthSource().kind}</span>;
  render(
    <Providers>
      <Probe />
    </Providers>,
  );
}

afterEach(() => {
  vi.unstubAllEnvs();
  vi.resetModules();
});

describe("fournisseurs de l’application", () => {
  it("démarrent en mode démo sans aucune variable d’environnement", async () => {
    vi.stubEnv("NEXT_PUBLIC_DATA_SOURCE", undefined);
    vi.stubEnv("NEXT_PUBLIC_API_URL", undefined);
    vi.resetModules();
    await renderProviders();
    expect(await screen.findByText("source:demo")).toBeTruthy();
  });

  it("branchent la source API quand NEXT_PUBLIC_DATA_SOURCE vaut api", async () => {
    vi.stubEnv("NEXT_PUBLIC_DATA_SOURCE", "api");
    vi.stubEnv("NEXT_PUBLIC_API_URL", "https://api.test");
    vi.resetModules();
    await renderProviders();
    expect(await screen.findByText("source:api")).toBeTruthy();
  });

  it("refusent la source API sans URL d’API plutôt que de retomber sur la démo", async () => {
    vi.stubEnv("NEXT_PUBLIC_DATA_SOURCE", "api");
    vi.stubEnv("NEXT_PUBLIC_API_URL", undefined);
    vi.resetModules();
    const spy = vi.spyOn(console, "error").mockImplementation(() => undefined);
    await expect(renderProviders()).rejects.toThrow();
    spy.mockRestore();
  });
});
