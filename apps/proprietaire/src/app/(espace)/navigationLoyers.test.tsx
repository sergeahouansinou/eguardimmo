import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ORG, stubApi } from "@/features/loyers/testing";
import { Providers } from "../providers";
import { EspaceShell } from "./EspaceShell";

const state = vi.hoisted((): { mode: "demo" | "api"; pathname: string } => ({ mode: "api", pathname: "/" }));

vi.mock("@/lib/env", () => ({
  get dataSource() {
    return state.mode;
  },
  apiEnv: () => ({ NEXT_PUBLIC_API_URL: "https://api.test", NEXT_PUBLIC_AUTH_URL: "http://localhost:3040", NEXT_PUBLIC_DATA_SOURCE: state.mode }),
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
  usePathname: () => state.pathname,
}));

const shellRoutes = {
  "/api/v1/me": {
    data: {
      id: "01934f6e-0000-7000-8000-0000000000a1",
      name: "Jeanne Dupont",
      email: "jeanne.dupont@example.com",
      email_verified_at: "2026-11-01T09:00:00+00:00",
      last_login_at: "2026-11-16T08:30:00+00:00",
      previous_login_at: null,
    },
  },
  [`/api/v1/org/${ORG}`]: { data: { id: ORG, kind: "individual", name: "Dupont Gestion", country: "FR", two_factor_required: false } },
  [`/api/v1/org/${ORG}/conversations/stats`]: { data: { unread: 0, stale: 0 } },
};

function renderEspace() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <Providers>
      <QueryClientProvider client={client}>
        <EspaceShell>
          <p>Contenu réel</p>
        </EspaceShell>
      </QueryClientProvider>
    </Providers>,
  );
}

beforeEach(() => {
  state.pathname = "/finances/loyers";
  window.localStorage.clear();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("entrée Loyers de la navigation de l'espace bailleur", () => {
  it("apparaît en mode api, pointe vers /finances/loyers et est active sur ses sous-pages", async () => {
    state.mode = "api";
    state.pathname = "/finances/loyers/paiements";
    stubApi(shellRoutes);

    renderEspace();

    const side = await screen.findByRole("navigation", { name: "Navigation principale" });
    const link = await within(side).findByRole("link", { name: "Loyers" });
    expect(link.getAttribute("href")).toBe("/finances/loyers");
    expect(link.getAttribute("aria-current")).toBe("page");
  });

  it("n'existe pas en mode démo", async () => {
    state.mode = "demo";
    stubApi(shellRoutes);

    renderEspace();

    const side = await screen.findByRole("navigation", { name: "Navigation principale" });
    await waitFor(() => { expect(within(side).getByRole("link", { name: "Accueil" })).toBeTruthy(); });
    expect(within(side).queryByRole("link", { name: "Loyers" })).toBeNull();
  });
});

describe("entrée Conformité de la navigation de l'espace bailleur", () => {
  it("apparaît en mode api et pointe vers /conformite", async () => {
    state.mode = "api";
    state.pathname = "/conformite";
    stubApi(shellRoutes);

    renderEspace();

    const side = await screen.findByRole("navigation", { name: "Navigation principale" });
    const link = await within(side).findByRole("link", { name: "Conformité" });
    expect(link.getAttribute("href")).toBe("/conformite");
    expect(link.getAttribute("aria-current")).toBe("page");
  });

  it("n'existe pas en mode démo", async () => {
    state.mode = "demo";
    stubApi(shellRoutes);

    renderEspace();

    const side = await screen.findByRole("navigation", { name: "Navigation principale" });
    await waitFor(() => { expect(within(side).getByRole("link", { name: "Accueil" })).toBeTruthy(); });
    expect(within(side).queryByRole("link", { name: "Conformité" })).toBeNull();
  });
});
