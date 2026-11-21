import { ToastProvider, TooltipProvider } from "@eguardimmo/ui";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, within } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { BailleurData } from "@/app/(espace)/BailleurData";
import EcheancesPage from "@/app/(espace)/finances/loyers/page";
import PaiementsPage from "@/app/(espace)/finances/loyers/paiements/page";
import PaiementNouveauPage from "@/app/(espace)/finances/loyers/paiements/nouveau/page";
import QuittancesPage from "@/app/(espace)/finances/loyers/quittances/page";
import {
  LoyerDetailScreen,
  LoyerQuittanceDetailScreen,
  LoyersScreen,
} from "./screens";
import { INSTALLMENT, ORG, RECEIPT, rentUrl, stubApi } from "./testing";

const env = vi.hoisted((): { mode: "demo" | "api" } => ({ mode: "api" }));
const push = vi.hoisted(() => vi.fn<(href: string) => void>());

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
  useRouter: () => ({ push, replace: vi.fn(), back: vi.fn(), prefetch: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
  usePathname: () => "/finances/loyers",
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
  push.mockReset();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("écrans Loyers de l'espace bailleur en mode api", () => {
  it("liste les échéances lues sur l'API de l'organisation individuelle", async () => {
    const calls = stubApi();

    renderInSpace(<EcheancesPage />);

    const table = await screen.findByRole("table", { name: "Échéances de loyer" });
    expect(within(table).getByText("BL-2026-42865")).toBeTruthy();
    expect(calls).toContain(rentUrl("/installments"));
    for (const text of DEMO_TEXTS) expect(document.body.textContent).not.toContain(text);
  });

  it("propose au titulaire d'enregistrer un paiement", async () => {
    stubApi();

    renderInSpace(<EcheancesPage />);

    await screen.findByRole("table", { name: "Échéances de loyer" });
    const link = screen.getAllByRole("link").find((item) => item.getAttribute("href")?.startsWith("/finances/loyers/paiements/nouveau"));
    expect(link).toBeTruthy();
  });

  it("liste les paiements", async () => {
    const calls = stubApi();

    renderInSpace(<PaiementsPage />);

    const table = await screen.findByRole("table", { name: "Paiements de loyer" });
    expect(within(table).getByText("VIR-123")).toBeTruthy();
    expect(calls).toContain(rentUrl("/payments"));
  });

  it("affiche le formulaire de paiement en chargeant les baux de l'organisation", async () => {
    const calls = stubApi();

    renderInSpace(<PaiementNouveauPage />);

    expect(await screen.findByRole("heading", { level: 1, name: "Enregistrer un paiement" })).toBeTruthy();
    expect(calls).toContain(`/api/v1/org/${ORG}/leases`);
  });

  it("liste les quittances", async () => {
    const calls = stubApi();

    renderInSpace(<QuittancesPage />);

    const table = await screen.findByRole("table", { name: "Quittances de loyer" });
    expect(within(table).getByText("QT-2026-0001")).toBeTruthy();
    expect(calls).toContain(rentUrl("/receipts"));
  });

  it("affiche le détail d'une échéance", async () => {
    const calls = stubApi();

    renderInSpace(<LoyerDetailScreen id={INSTALLMENT} />);

    expect(await screen.findByRole("heading", { level: 1, name: "Échéance de Novembre 2026" })).toBeTruthy();
    expect(calls).toContain(rentUrl(`/installments/${INSTALLMENT}`));
  });

  it("affiche le détail d'une quittance", async () => {
    const calls = stubApi();

    renderInSpace(<LoyerQuittanceDetailScreen id={RECEIPT} />);

    expect(await screen.findByRole("heading", { level: 1, name: "Quittance QT-2026-0001" })).toBeTruthy();
    expect(calls).toContain(rentUrl(`/receipts/${RECEIPT}`));
  });

  it("signale l'échec du chargement au lieu d'afficher des données de démonstration", async () => {
    stubApi({ [rentUrl("/installments")]: undefined });

    renderInSpace(<LoyersScreen />);

    expect(await screen.findByText(/Route non prévue|n’ont pas pu être chargées/)).toBeTruthy();
    expect(screen.queryByRole("table")).toBeNull();
  });
});

describe("écrans Loyers de l'espace bailleur en mode démo", () => {
  it.each([
    ["échéances", EcheancesPage],
    ["paiements", PaiementsPage],
    ["nouveau paiement", PaiementNouveauPage],
    ["quittances", QuittancesPage],
  ])("%s : la page est introuvable, sans appel réseau", (_label, Page) => {
    env.mode = "demo";
    const calls = stubApi();

    expect(() => renderInSpace(<Page />)).toThrow("NEXT_NOT_FOUND");
    expect(calls).toEqual([]);
  });
});
