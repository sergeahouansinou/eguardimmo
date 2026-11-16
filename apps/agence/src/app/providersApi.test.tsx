import { ToastProvider, TooltipProvider } from "@eguardimmo/ui";
import { useShellSource } from "@eguardimmo/shell";
import { render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { BiensRoot } from "@/features/gestion/BiensRoot";
import { BauxScreen, LocatairesScreen } from "@/features/gestion/screens";
import { LotsScreen } from "@eguardimmo/gestion/biens";
import { Providers } from "./providers";

const ORG = "01934f6e-0000-7000-8000-00000000000b";

const state = vi.hoisted((): { mode: "demo" | "api" } => ({ mode: "api" }));

vi.mock("@/lib/env", () => ({
  get dataSource() {
    return state.mode;
  },
  apiEnv: () => ({ NEXT_PUBLIC_API_URL: "https://api.test", NEXT_PUBLIC_AUTH_URL: "https://auth.test", NEXT_PUBLIC_DATA_SOURCE: state.mode }),
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
  usePathname: () => "/biens",
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
  body: { data: [{ space: "organization", label: "Agence Soleil", meta: { organization: ORG, kind: "agency", role: "owner" } }] },
};

const emptyPage: Reply = { body: { data: [], meta: { per_page: 50, next_cursor: null } } };

function Probe() {
  return <p>{typeof useShellSource().shell}</p>;
}

function renderWith(children: React.ReactNode) {
  return render(
    <Providers>
      <TooltipProvider>
        <ToastProvider>{children}</ToastProvider>
      </TooltipProvider>
    </Providers>,
  );
}

beforeEach(() => {
  state.mode = "api";
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("fournisseurs de l'application selon la source de données", () => {
  it("fournit la coquille de démonstration en mode démo, sans appeler l'API", () => {
    state.mode = "demo";
    const calls = stubApi({});

    renderWith(<Probe />);

    expect(screen.getByText("function")).toBeTruthy();
    expect(calls).toEqual([]);
  });

  it("fournit la coquille du serveur en mode api, après l'ouverture de l'agence", async () => {
    const calls = stubApi({ "/api/v1/me/profiles": profiles });

    renderWith(<Probe />);

    expect(await screen.findByText("function")).toBeTruthy();
    expect(calls).toEqual(["/api/v1/me/profiles"]);
  });

  it("monte la source API des baux sous l'agence", async () => {
    const calls = stubApi({ "/api/v1/me/profiles": profiles, [`/api/v1/org/${ORG}/leases`]: emptyPage });

    renderWith(<BauxScreen />);

    expect(await screen.findByText("Aucun bail")).toBeTruthy();
    expect(screen.queryByRole("table", { name: "Baux" })).toBeNull();
    expect(calls).toContain(`/api/v1/org/${ORG}/leases`);
  });

  it("monte la source API des locataires sous l'agence", async () => {
    const calls = stubApi({ "/api/v1/me/profiles": profiles, [`/api/v1/org/${ORG}/parties`]: emptyPage });

    renderWith(<LocatairesScreen />);

    await waitFor(() => { expect(calls).toContain(`/api/v1/org/${ORG}/parties`); });
  });

  it("monte la source API des biens sous l'agence", async () => {
    const calls = stubApi({ "/api/v1/me/profiles": profiles, [`/api/v1/org/${ORG}/units`]: emptyPage, [`/api/v1/org/${ORG}/properties`]: emptyPage });

    renderWith(
      <BiensRoot>
        <LotsScreen />
      </BiensRoot>,
    );

    await waitFor(() => { expect(calls).toContain(`/api/v1/org/${ORG}/units`); });
    expect(document.body.textContent).not.toContain("Apt 12");
  });

  it("ne monte aucune source de démonstration des biens en mode api sans session", () => {
    state.mode = "api";
    vi.spyOn(console, "error").mockImplementation(() => undefined);

    expect(() => render(<BiensRoot><LotsScreen /></BiensRoot>)).toThrow();
  });

  it("n'enveloppe pas les biens de démonstration en mode démo", () => {
    state.mode = "demo";

    render(
      <BiensRoot>
        <p>Écran de démonstration</p>
      </BiensRoot>,
    );

    expect(screen.getByText("Écran de démonstration")).toBeTruthy();
  });

  it("affiche l'erreur de session sans monter les sources", async () => {
    const calls = stubApi({ "/api/v1/me/profiles": { status: 500, body: { type: "about:blank", title: "Erreur", status: 500, code: "server_error" } } });

    renderWith(<BauxScreen />);

    expect(await screen.findByText("Impossible d’ouvrir votre espace")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Réessayer" })).toBeTruthy();
    expect(calls.some((path) => path.includes("/leases"))).toBe(false);
  });
});
