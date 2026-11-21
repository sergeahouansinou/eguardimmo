import { OrganizationGate } from "@eguardimmo/shell";
import { ACCOUNT_IDS, devicesResponse, meResponse, securityResponse } from "@eguardimmo/shell/account/fixtures";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import ComptePage from "./page";
import SecuritePage from "./securite/page";

const state = vi.hoisted((): { mode: "demo" | "api" } => ({ mode: "api" }));

vi.mock("@/lib/env", () => ({
  get dataSource() {
    return state.mode;
  },
}));

vi.mock("next/link", () => ({
  default: ({ href, children, ...props }: { href: string; children?: React.ReactNode }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), back: vi.fn(), prefetch: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
  usePathname: () => "/compte",
}));

const PROFILES = {
  data: [{ space: "organization", label: "Agence Les Tilleuls", meta: { organization: ACCOUNT_IDS.organization, kind: "agency", role: "owner" } }],
};

const FORBIDDEN = ["Sophie Delmas", "Cabinet Delmas"];

function stubFetch() {
  const routes: Record<string, unknown> = {
    "/api/v1/me/profiles": PROFILES,
    "/api/v1/me": meResponse,
    "/api/v1/me/security": securityResponse,
    "/api/v1/me/devices": devicesResponse,
  };
  const calls: string[] = [];
  vi.stubGlobal(
    "fetch",
    vi.fn<typeof fetch>((input, init) => {
      const url = new URL(typeof input === "string" ? input : input instanceof URL ? input.href : input.url);
      calls.push(`${init?.method ?? "GET"} ${url.pathname}`);
      const body = routes[url.pathname];
      return Promise.resolve(new Response(JSON.stringify(body ?? {}), { status: body === undefined ? 500 : 200, headers: { "Content-Type": "application/json" } }));
    }),
  );
  return calls;
}

function renderInGate(page: React.ReactNode) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <OrganizationGate apiUrl="http://api.test" authUrl="http://localhost:3040" kind="agency">
        {page}
      </OrganizationGate>
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  state.mode = "api";
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("pages du compte de l'espace agence en mode api", () => {
  it("Mon compte lit l'identité du serveur, sans donnée de démonstration ni écriture", async () => {
    const calls = stubFetch();

    renderInGate(<ComptePage />);

    expect(await screen.findByRole("heading", { level: 1, name: "Mon compte" })).toBeTruthy();
    expect(await screen.findByText("jeanne@exemple.fr")).toBeTruthy();
    for (const text of FORBIDDEN) expect(document.body.textContent).not.toContain(text);
    expect(calls.every((call) => call.startsWith("GET "))).toBe(true);
  });

  it("Connexion et sécurité lit l'état de sécurité et les appareils du serveur", async () => {
    stubFetch();

    renderInGate(<SecuritePage />);

    expect(await screen.findByRole("heading", { level: 1, name: "Connexion et sécurité" })).toBeTruthy();
    expect(await screen.findByText("Non activée")).toBeTruthy();
    expect(await screen.findByRole("button", { name: "Révoquer Pixel 9" })).toBeTruthy();
    for (const text of FORBIDDEN) expect(document.body.textContent).not.toContain(text);
  });
});
