import { ToastProvider, TooltipProvider } from "@eguardimmo/ui";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { expectNoA11yViolations } from "../../../test/axe";
import { BailleurData } from "@/app/(espace)/BailleurData";
import EncaissementNouveauPage from "@/app/(espace)/finances/encaissements/nouveau/page";
import { LoyerDetailScreen } from "./screens";
import { INSTALLMENT, ORG, rentUrl, stubApi } from "./testing";

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
  usePathname: () => "/finances/encaissements/nouveau",
  notFound: () => {
    throw new Error("NEXT_NOT_FOUND");
  },
}));

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

const DEMO_TEXTS = ["Marc Chevalier", "Gestion Les Tilleuls", "SCI Les Tilleuls"];

beforeEach(() => {
  env.mode = "api";
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("encaissements et impayés de l'espace bailleur en mode api", () => {
  it("sert la saisie d'un paiement de loyer sur l'API de l'organisation", async () => {
    const calls = stubApi();

    const view = renderInSpace(<EncaissementNouveauPage />);

    expect(await screen.findByRole("heading", { level: 1, name: "Enregistrer un paiement" })).toBeTruthy();
    expect(calls).toContain(`/api/v1/org/${ORG}/leases`);
    for (const text of DEMO_TEXTS) expect(document.body.textContent).not.toContain(text);
    await expectNoA11yViolations(view.container);
  });

  it("sert le détail d'un impayé depuis l'échéance de l'API", async () => {
    const calls = stubApi();

    renderInSpace(<LoyerDetailScreen id={INSTALLMENT} />);

    expect(await screen.findByRole("heading", { level: 1, name: "Échéance de Novembre 2026" })).toBeTruthy();
    expect(calls).toContain(rentUrl(`/installments/${INSTALLMENT}`));
  });

  it("traduit l'échéance introuvable sans afficher de donnée de démonstration", async () => {
    const calls = stubApi();
    const base = globalThis.fetch;
    vi.stubGlobal(
      "fetch",
      vi.fn<typeof fetch>((input, init) => {
        const url = new URL(typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url);
        if (url.pathname !== rentUrl(`/installments/${INSTALLMENT}`)) return base(input, init);
        calls.push(url.pathname);
        const problem = { type: "about:blank", title: "Échéance introuvable", status: 404, code: "rent_installment_not_found" };
        return Promise.resolve(new Response(JSON.stringify(problem), { status: 404, headers: { "Content-Type": "application/problem+json" } }));
      }),
    );

    renderInSpace(<LoyerDetailScreen id={INSTALLMENT} />);

    expect(await screen.findByRole("heading", { level: 1, name: "Échéance introuvable" })).toBeTruthy();
    expect(screen.getByText("Cette échéance n’existe pas")).toBeTruthy();
    for (const text of DEMO_TEXTS) expect(document.body.textContent).not.toContain(text);
  });
});

describe("encaissements de l'espace bailleur en mode démo", () => {
  it("garde la saisie de démonstration, sans appel réseau", async () => {
    env.mode = "demo";
    const calls = stubApi();

    renderInSpace(<EncaissementNouveauPage />);

    expect(await screen.findAllByRole("heading", { level: 1 })).not.toHaveLength(0);
    expect(calls).toEqual([]);
  });
});
