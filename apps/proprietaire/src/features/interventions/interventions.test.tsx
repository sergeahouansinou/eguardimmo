import { ToastProvider, TooltipProvider } from "@eguardimmo/ui";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { expectNoA11yViolations } from "../../../test/axe";
import { BailleurData } from "@/app/(espace)/BailleurData";
import InterventionsPage from "@/app/(espace)/interventions/page";
import NouvelleInterventionPage from "@/app/(espace)/interventions/nouvelle/page";
import PrestatairesPage from "@/app/(espace)/interventions/prestataires/page";
import { ORG, stubApi } from "@/features/loyers/testing";
import { InterventionDetailApiScreen } from "./screens";

const env = vi.hoisted((): { mode: "demo" | "api" } => ({ mode: "api" }));

vi.mock("@/lib/env", () => ({
  get dataSource() {
    return env.mode;
  },
  apiEnv: () => ({ NEXT_PUBLIC_API_URL: "https://api.test", NEXT_PUBLIC_AUTH_URL: "http://localhost:3040", NEXT_PUBLIC_DATA_SOURCE: env.mode }),
}));

vi.mock("next/link", () => ({
  default: ({ href, children, ...props }: { href: string; children?: ReactNode }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), back: vi.fn(), prefetch: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
  usePathname: () => "/interventions",
  notFound: () => {
    throw new Error("NEXT_NOT_FOUND");
  },
}));

const org = (path: string) => `/api/v1/org/${ORG}${path}`;
const INTERVENTION = "01a1e544-3c7b-7316-ad15-a82486eff499";
const emptyPage = { data: [], meta: { per_page: 25, next_cursor: null, prev_cursor: null } };

function renderInSpace(ui: ReactNode) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <TooltipProvider>
        <ToastProvider>
          <BailleurData>{ui}</BailleurData>
        </ToastProvider>
      </TooltipProvider>
    </QueryClientProvider>,
  );
}

const DEMO_TEXTS = ["Marc Chevalier", "Gestion Les Tilleuls", "SCI Les Tilleuls", "Fuite"];

beforeEach(() => {
  env.mode = "api";
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("interventions de l'espace bailleur en mode api", () => {
  it("lit les interventions de l'organisation individuelle, sans donnée de démonstration", async () => {
    const calls = stubApi({ [org("/interventions")]: emptyPage });

    const view = renderInSpace(<InterventionsPage />);

    expect(await screen.findByText(/Aucune intervention/)).toBeTruthy();
    expect(screen.queryByText("Interventions indisponibles pour ce compte")).toBeNull();
    expect(calls).toContain(org("/interventions"));
    for (const text of DEMO_TEXTS) expect(document.body.textContent).not.toContain(text);
    await expectNoA11yViolations(view.container);
  });

  it("sert le formulaire de déclaration sur l'API", async () => {
    const calls = stubApi({ [org("/units")]: emptyPage });

    renderInSpace(<NouvelleInterventionPage />);

    expect(await screen.findByRole("heading", { level: 1, name: /intervention/i })).toBeTruthy();
    expect(screen.queryByText("Interventions indisponibles pour ce compte")).toBeNull();
    expect(calls.some((call) => call.startsWith(org("/units")))).toBe(true);
  });

  it("traduit un détail introuvable", async () => {
    const base = stubApi();
    expect(base).toEqual([]);
    const known = globalThis.fetch;
    vi.stubGlobal(
      "fetch",
      vi.fn<typeof fetch>((input, init) => {
        const url = new URL(typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url);
        if (url.pathname !== org(`/interventions/${INTERVENTION}`)) return known(input, init);
        const problem = { type: "about:blank", title: "Intervention introuvable", status: 404, code: "maintenance_intervention_not_found" };
        return Promise.resolve(new Response(JSON.stringify(problem), { status: 404, headers: { "Content-Type": "application/problem+json" } }));
      }),
    );

    renderInSpace(<InterventionDetailApiScreen id={INTERVENTION} />);

    expect(await screen.findByText("Cette intervention n’existe pas ou n’appartient pas à votre organisation.")).toBeTruthy();
    for (const text of DEMO_TEXTS) expect(document.body.textContent).not.toContain(text);
  });

  it("sert les prestataires de l'organisation", async () => {
    const calls = stubApi({ [org("/suppliers")]: emptyPage });

    renderInSpace(<PrestatairesPage />);

    expect(await screen.findByRole("heading", { level: 1, name: /Prestataires/ })).toBeTruthy();
    expect(calls).toContain(org("/suppliers"));
  });
});

describe("interventions de l'espace bailleur en mode démo", () => {
  it("garde la liste de démonstration, sans appel réseau", async () => {
    env.mode = "demo";
    const calls = stubApi();

    renderInSpace(<InterventionsPage />);

    expect(await screen.findAllByRole("heading", { level: 1 })).not.toHaveLength(0);
    expect(calls).toEqual([]);
  });
});
