import { render, screen } from "@testing-library/react";
import { createElement } from "react";
import type { ComponentType } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { API_SERVED_ROUTES, pageFiles } from "../../test/pages";
import { ApiRouteGate } from "./ApiRouteGate";
import { unavailableFamilyOf } from "./capabilities";

const state = vi.hoisted((): { pathname: string } => ({ pathname: "/confie" }));

vi.mock("@/lib/env", () => ({ dataSource: "api" }));

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
  notFound: () => {
    throw new Error("notFound");
  },
}));

type PageComponent = ComponentType<{ params: Promise<{ id: string }> }>;

function isPage(value: unknown): value is PageComponent {
  return typeof value === "function";
}

async function pageElement(file: string) {
  const loaded: unknown = await import(/* @vite-ignore */ file);
  if (typeof loaded !== "object" || loaded === null || !("default" in loaded) || !isPage(loaded.default)) throw new Error(`${file} n'exporte aucune page`);
  return createElement(loaded.default, { params: Promise.resolve({ id: "inconnu" }) });
}

const DEMO_TEXTS = ["Koffi Adjovi", "Gestion Les Tilleuls", "Apt A1", "Mutuelle Horizon", "2026-11-13"];

const pages = pageFiles();
const gated = pages.filter((page) => unavailableFamilyOf(page.route) !== null);

let fetchMock: ReturnType<typeof vi.fn<typeof fetch>>;

beforeEach(() => {
  fetchMock = vi.fn<typeof fetch>(() => Promise.reject(new Error("Aucun appel réseau attendu")));
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("routes de l'espace propriétaire sans source API en mode api", () => {
  it("compte les pages gatées et les pages servies", () => {
    expect(gated.length).toBe(pages.length - API_SERVED_ROUTES.length);
  });

  it.each(gated.map((page) => [page.route, page.file] as const))("%s : affiche « Bientôt disponible » sans exécuter la page ni appeler le réseau", async (route, file) => {
    state.pathname = route;
    const element = await pageElement(file);

    render(<ApiRouteGate>{element}</ApiRouteGate>);

    expect(screen.getByText("Bientôt disponible")).toBeTruthy();
    expect(screen.getByRole("navigation", { name: "Sections disponibles" })).toBeTruthy();
    expect(screen.getByRole("link", { name: "Retour à l’accueil" }).getAttribute("href")).toBe("/confie");
    for (const text of DEMO_TEXTS) expect(document.body.textContent).not.toContain(text);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it.each(["/confie", "/confie/aide", "/confie/agence", "/confie/agence/mandat", "/confie/agence/mandat/fin", "/confie/compte-de-paiement", "/confie/notifications", "/confie/notifications/toutes"])("%s : laisse passer l'écran réel", (route) => {
    state.pathname = route;

    render(
      <ApiRouteGate>
        <p>Écran réel</p>
      </ApiRouteGate>,
    );

    expect(screen.getByText("Écran réel")).toBeTruthy();
    expect(screen.queryByText("Bientôt disponible")).toBeNull();
  });

  it("intitule la page gatée d'après sa famille", () => {
    state.pathname = "/confie/messages/12/extra";

    render(
      <ApiRouteGate>
        <p>Écran de démonstration</p>
      </ApiRouteGate>,
    );

    expect(screen.getByRole("heading", { level: 1, name: "Messages" })).toBeTruthy();
    expect(screen.queryByText("Écran de démonstration")).toBeNull();
  });
});
