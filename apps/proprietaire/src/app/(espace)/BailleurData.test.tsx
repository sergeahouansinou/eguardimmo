import { ToastProvider, TooltipProvider } from "@eguardimmo/ui";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { BauxScreen, LocatairesScreen, QuittancesScreen } from "@/features/locataires/screens";
import { BailleurData } from "./BailleurData";

const ORG = "01934f6e-0000-7000-8000-00000000000a";

const env = vi.hoisted((): { mode: "demo" | "api" } => ({ mode: "demo" }));

vi.mock("@/lib/env", () => ({
  get dataSource() {
    return env.mode;
  },
  apiEnv: () => ({ NEXT_PUBLIC_API_URL: "https://api.test", NEXT_PUBLIC_AUTH_URL: "https://auth.test", NEXT_PUBLIC_DATA_SOURCE: env.mode }),
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
  usePathname: () => "/baux",
}));

interface Reply {
  status?: number;
  body: unknown;
}

function stubApi(routes: Record<string, Reply>) {
  const calls: string[] = [];
  const fetchMock = vi.fn<typeof fetch>((input) => {
    const url = new URL(typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url);
    calls.push(url.pathname);
    const reply = routes[url.pathname] ?? { status: 500, body: { type: "about:blank", title: "Route non prévue", status: 500, code: "server_error" } };
    return Promise.resolve(new Response(JSON.stringify(reply.body), { status: reply.status ?? 200, headers: { "Content-Type": "application/json" } }));
  });
  vi.stubGlobal("fetch", fetchMock);
  return calls;
}

const profiles: Reply = {
  body: { data: [{ space: "organization", label: "Awa Diallo", meta: { organization: ORG, kind: "individual", role: "owner" } }] },
};

function renderBaux() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <TooltipProvider>
        <ToastProvider>
          <BailleurData>
            <BauxScreen />
          </BailleurData>
        </ToastProvider>
      </TooltipProvider>
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  env.mode = "demo";
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("données de l'espace bailleur", () => {
  it("garde la source de démonstration sans appeler l'API", async () => {
    const calls = stubApi({});

    renderBaux();

    expect(await screen.findByRole("table", { name: "Baux" })).toBeTruthy();
    expect(calls).toEqual([]);
  });

  it("monte la source API des baux sous la session de l'organisation individuelle", async () => {
    env.mode = "api";
    const calls = stubApi({
      "/api/v1/me/profiles": profiles,
      [`/api/v1/org/${ORG}/leases`]: { body: { data: [], meta: { per_page: 50, next_cursor: null } } },
    });

    renderBaux();

    expect(await screen.findByText("Aucun bail")).toBeTruthy();
    expect(screen.queryByRole("table", { name: "Baux" })).toBeNull();
    expect(calls).toContain(`/api/v1/org/${ORG}/leases`);
  });

  it("affiche l'erreur de chargement des baux sans retomber sur la démonstration", async () => {
    env.mode = "api";
    stubApi({ "/api/v1/me/profiles": profiles });

    renderBaux();

    expect(await screen.findByText("Les baux n’ont pas pu être chargés")).toBeTruthy();
    expect(screen.queryByRole("table", { name: "Baux" })).toBeNull();
  });

  it("affiche l'erreur de session sans monter la source des baux", async () => {
    env.mode = "api";
    const calls = stubApi({ "/api/v1/me/profiles": { status: 500, body: { type: "about:blank", title: "Erreur", status: 500, code: "server_error" } } });

    renderBaux();

    expect(await screen.findByText("Impossible d’ouvrir votre espace")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Réessayer" })).toBeTruthy();
    expect(calls.some((path) => path.includes("/leases"))).toBe(false);
  });

  it("signale l'absence d'espace bailleur", async () => {
    env.mode = "api";
    stubApi({ "/api/v1/me/profiles": { body: { data: [{ space: "tenant", label: "Locataire", meta: {} }] } } });

    renderBaux();

    expect(await screen.findByText("Aucune organisation")).toBeTruthy();
  });

  it("monte la source API des locataires sous la session de l'organisation individuelle", async () => {
    env.mode = "api";
    const calls = stubApi({
      "/api/v1/me/profiles": profiles,
      [`/api/v1/org/${ORG}/parties`]: { body: { data: [], meta: { per_page: 100, next_cursor: null } } },
    });

    render(
      <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
        <TooltipProvider>
          <ToastProvider>
            <BailleurData>
              <LocatairesScreen />
            </BailleurData>
          </ToastProvider>
        </TooltipProvider>
      </QueryClientProvider>,
    );

    await waitFor(() => { expect(calls).toContain(`/api/v1/org/${ORG}/parties`); });
  });

  it("n'affiche aucune quittance de démonstration en mode API : la page est indisponible", async () => {
    env.mode = "api";
    const calls = stubApi({ "/api/v1/me/profiles": profiles });

    render(
      <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
        <TooltipProvider>
          <ToastProvider>
            <BailleurData>
              <QuittancesScreen />
            </BailleurData>
          </ToastProvider>
        </TooltipProvider>
      </QueryClientProvider>,
    );

    expect(await screen.findByText("Bientôt disponible")).toBeTruthy();
    expect(screen.queryByRole("table")).toBeNull();
    expect(document.body.textContent).not.toContain("SCI Les Tilleuls");
    expect(calls.some((path) => path.includes("/receipts") || path.includes("/leases"))).toBe(false);
  });
});
