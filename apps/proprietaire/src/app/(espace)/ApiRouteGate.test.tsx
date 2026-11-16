import { GestionDataModeProvider } from "@eguardimmo/gestion";
import { ToastProvider, TooltipProvider } from "@eguardimmo/ui";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import { readdirSync } from "node:fs";
import { join, relative, sep } from "node:path";
import type { ComponentType } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { classifyRoute } from "@eguardimmo/gestion";
import { FinancesScreen, BilanScreen } from "@/features/finances/screens";
import {
  AbonnementScreen,
  CompteScreen,
  ExportScreen,
  JournalScreen,
  ReglagesDocumentsScreen,
  ReglagesMenuScreen,
  ReglagesNotificationsScreen,
  ReglagesScreen,
} from "@/features/outils/screensCompte";
import { AnalytiqueVueScreen, RapportsScreen } from "@/features/outils/screensOutils";
import {
  AgendaScreen,
  ContactsScreen,
  DocumentsScreen,
  InterventionsScreen,
  TachesScreen,
} from "@/features/outils/screensSuivi";
import { DemoGestionSource } from "@/lib/DemoGestionSource";
import { ApiRouteGate } from "./ApiRouteGate";
import { BureauScreen } from "./BureauScreen";

const state = vi.hoisted((): { mode: "demo" | "api"; pathname: string } => ({ mode: "api", pathname: "/" }));

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
  usePathname: () => state.pathname,
}));

const GATED: readonly (readonly [family: string, path: string, Screen: ComponentType])[] = [
  ["bureau", "/", BureauScreen],
  ["finances", "/finances", FinancesScreen],
  ["finances (bilan)", "/finances/bilan", BilanScreen],
  ["analytique", "/analytique", AnalytiqueVueScreen],
  ["rapports", "/rapports", RapportsScreen],
  ["agenda", "/agenda", AgendaScreen],
  ["tâches", "/taches", TachesScreen],
  ["interventions", "/interventions", InterventionsScreen],
  ["contacts", "/contacts", ContactsScreen],
  ["journal", "/journal", JournalScreen],
  ["documents", "/documents", DocumentsScreen],
  ["compte", "/compte", CompteScreen],
  ["compte (abonnement)", "/compte/abonnement", AbonnementScreen],
  ["compte (export)", "/compte/export", ExportScreen],
  ["réglages", "/reglages", ReglagesScreen],
  ["réglages (documents)", "/reglages/documents", ReglagesDocumentsScreen],
  ["réglages (menu)", "/reglages/menu", ReglagesMenuScreen],
  ["réglages (notifications)", "/reglages/notifications", ReglagesNotificationsScreen],
];

function renderRoute(path: string, Screen: ComponentType, mode: "demo" | "api") {
  state.pathname = path;
  state.mode = mode;
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <GestionDataModeProvider mode={mode}>
        <TooltipProvider>
          <ToastProvider>
            <DemoGestionSource>
              <ApiRouteGate>
                <Screen />
              </ApiRouteGate>
            </DemoGestionSource>
          </ToastProvider>
        </TooltipProvider>
      </GestionDataModeProvider>
    </QueryClientProvider>,
  );
}

let fetchMock: ReturnType<typeof vi.fn<typeof fetch>>;

beforeEach(() => {
  fetchMock = vi.fn<typeof fetch>(() => Promise.reject(new Error("Aucun appel réseau attendu")));
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("routes sans source API en mode api", () => {
  it.each(GATED)("%s : affiche « Bientôt disponible » sans appel réseau ni donnée de démonstration", (_family, path, Screen) => {
    renderRoute(path, Screen, "api");

    expect(screen.getByText("Bientôt disponible")).toBeTruthy();
    expect(screen.getByRole("navigation", { name: "Sections disponibles" })).toBeTruthy();
    expect(screen.queryByRole("link", { name: "Retour à l’accueil" }) !== null).toBe(path !== "/");
    expect(screen.queryByRole("table")).toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe("mode démo inchangé", () => {
  it.each(GATED)("%s : affiche l'écran de démonstration", async (_family, path, Screen) => {
    renderRoute(path, Screen, "demo");

    await screen.findAllByRole("heading", { level: 1 });
    expect(screen.queryByText("Bientôt disponible")).toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

function pageRoutes(directory: string): string[] {
  const routes: string[] = [];
  const walk = (current: string) => {
    for (const entry of readdirSync(current, { withFileTypes: true })) {
      if (entry.isDirectory()) walk(join(current, entry.name));
      else if (entry.name === "page.tsx") routes.push(relative(directory, current));
    }
  };
  walk(directory);
  return routes.map((route) => {
    const segments = route.split(sep).filter((segment) => !(segment.startsWith("(") && segment.endsWith(")")));
    return `/${segments.map((segment) => (segment.startsWith("[") ? "x" : segment)).join("/")}`;
  });
}

describe("classement des routes de l'espace bailleur", () => {
  it("classe chaque page de (espace) dans une famille gatée ou parmi les écrans réels", () => {
    const routes = pageRoutes(join(process.cwd(), "src", "app", "(espace)"));

    expect(routes.length).toBeGreaterThan(100);
    expect(routes.filter((route) => classifyRoute(route) === null)).toEqual([]);
  });
});
