import { ToastProvider, TooltipProvider } from "@eguardimmo/ui";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, within } from "@testing-library/react";
import { readdirSync } from "node:fs";
import { join, relative, sep } from "node:path";
import type { ReactNode } from "react";
import { classifyRoute, unavailableFamilyOf } from "@eguardimmo/gestion";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { BailleurData } from "@/app/(espace)/BailleurData";
import ConformitePage from "@/app/(espace)/conformite/page";
import PieceConformitePage from "@/app/(espace)/conformite/[id]/page";
import DocumentsPage from "@/app/(espace)/documents/page";
import { CERTIFICATE, conformiteRoutes, documentsUrl, stubApi } from "./testing";
import { PieceConformiteScreen } from "./screens";

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
  usePathname: () => "/conformite",
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

beforeEach(() => {
  env.mode = "api";
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("écrans Conformité et Documents de l'espace bailleur en mode api", () => {
  it("liste les pièces lues sur l'API de l'organisation", async () => {
    const calls = stubApi(conformiteRoutes);

    renderInSpace(<ConformitePage />);

    const table = await screen.findByRole("table");
    expect(within(table).getByText("DPE-2026-001")).toBeTruthy();
    expect(calls).toContain(documentsUrl("/certificates"));
    expect(document.body.textContent).not.toContain("Marc Chevalier");
  });

  it("propose l'ajout d'une pièce au titulaire", async () => {
    stubApi(conformiteRoutes);

    renderInSpace(<ConformitePage />);

    await screen.findByRole("table");
    expect(screen.getByRole("button", { name: /Ajouter/ })).toBeTruthy();
  });

  it("affiche le détail d'une pièce", async () => {
    const calls = stubApi(conformiteRoutes);

    renderInSpace(<PieceConformiteScreen id={CERTIFICATE} />);

    expect(await screen.findByRole("heading", { level: 1, name: /Diagnostic de performance énergétique/ })).toBeTruthy();
    expect(calls).toContain(documentsUrl(`/certificates/${CERTIFICATE}`));
  });

  it("sert les justificatifs sur /documents", async () => {
    const calls = stubApi(conformiteRoutes);

    renderInSpace(<DocumentsPage />);

    expect(await screen.findByRole("heading", { level: 1, name: "Documents" })).toBeTruthy();
    expect(calls).toContain(documentsUrl("/certificates"));
  });

  it("signale l'échec du chargement au lieu d'afficher des données de démonstration", async () => {
    stubApi({ ...conformiteRoutes, [documentsUrl("/certificates")]: undefined });

    renderInSpace(<ConformitePage />);

    expect((await screen.findAllByText(/chargement impossible|Route non prévue/i)).length).toBeGreaterThan(0);
    expect(screen.queryByRole("table")).toBeNull();
  });
});

describe("écrans Conformité de l'espace bailleur en mode démo", () => {
  it.each([
    ["conformité", ConformitePage],
    ["détail", () => PieceConformitePage({ params: Promise.resolve({ id: CERTIFICATE }), searchParams: Promise.resolve({}) })],
  ])("%s : la page est introuvable, sans appel réseau", (_label, Page) => {
    env.mode = "demo";
    const calls = stubApi(conformiteRoutes);

    expect(() => renderInSpace(<Page />)).toThrow("NEXT_NOT_FOUND");
    expect(calls).toEqual([]);
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
  return routes.map((route) => `/${route.split(sep).map((segment) => (segment.startsWith("[") ? "x" : segment)).join("/")}`);
}

describe("routes Conformité de l'espace bailleur", () => {
  it("livre la liste et le détail, servis en mode api", () => {
    const routes = pageRoutes(join(process.cwd(), "src", "app", "(espace)", "conformite"));

    expect(routes.map((route) => `/conformite${route === "/" ? "" : route}`).sort()).toEqual(["/conformite", "/conformite/x"]);
    for (const path of ["/conformite", "/conformite/x", "/documents"]) {
      expect(classifyRoute(path), path).toBe("reelle");
      expect(unavailableFamilyOf(path), path).toBeNull();
    }
  });

  it("laisse l'ajout isolé de Documents « Bientôt disponible »", () => {
    for (const path of ["/documents/nouveau", "/documents/ajout"]) {
      expect(unavailableFamilyOf(path), path).toBe("documents");
    }
  });
});
