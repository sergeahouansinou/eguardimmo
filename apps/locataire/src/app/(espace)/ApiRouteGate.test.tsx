import { render, screen, within } from "@testing-library/react";
import { createElement } from "react";
import type { ComponentType } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { pageFiles } from "../../../test/pages";
import { unavailableFamilyOf } from "@/espace/capabilities";
import { familyCopy } from "@/espace/unavailableCopy";
import { ApiRouteGate } from "./ApiRouteGate";

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
const served = pages.filter((page) => unavailableFamilyOf(page.route) === null);

let fetchMock: ReturnType<typeof vi.fn<typeof fetch>>;

beforeEach(() => {
  fetchMock = vi.fn<typeof fetch>(() => Promise.reject(new Error("Aucun appel réseau attendu")));
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("routes du locataire sans source API en mode api", () => {
  it("compte les pages gatées et les pages servies", () => {
    expect(gated.length).toBe(2);
    expect(served.length).toBe(37);
  });

  it.each(gated.map((page) => [page.route, page.file] as const))("%s : affiche « Bientôt disponible » sans exécuter la page ni appeler le réseau", async (route, file) => {
    state.mode = "api";
    state.pathname = route;
    const element = await pageElement(file);

    render(<ApiRouteGate>{element}</ApiRouteGate>);

    const family = unavailableFamilyOf(route);
    const alertTitle = (family === null ? undefined : familyCopy[family]?.alertTitle) ?? "Bientôt disponible";
    expect(screen.getByText(alertTitle)).toBeTruthy();
    expect(screen.getByRole("navigation", { name: "Sections disponibles" })).toBeTruthy();
    expect(screen.getByRole("link", { name: "Retour à l’accueil" }).getAttribute("href")).toBe("/");
    expect(screen.queryByRole("table")).toBeNull();
    for (const text of DEMO_TEXTS) expect(document.body.textContent).not.toContain(text);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it.each(served.map((page) => page.route))("%s : laisse passer l'écran réel", (route) => {
    state.mode = "api";
    state.pathname = route;

    render(
      <ApiRouteGate>
        <p>Écran réel</p>
      </ApiRouteGate>,
    );

    expect(screen.getByText("Écran réel")).toBeTruthy();
    expect(screen.queryByText("Bientôt disponible")).toBeNull();
  });

  it("explique que le prélèvement automatique n'est pas relié et renvoie vers le paiement réel", () => {
    state.mode = "api";
    state.pathname = "/loyers/prelevement";

    render(
      <ApiRouteGate>
        <p>Écran de démonstration</p>
      </ApiRouteGate>,
    );

    expect(screen.getByRole("heading", { level: 1, name: "Prélèvement automatique" })).toBeTruthy();
    expect(screen.getByText("Bientôt disponible")).toBeTruthy();
    expect(screen.getByText(/mandat SEPA se signe chez le prestataire de paiement/)).toBeTruthy();
    const nav = screen.getByRole("navigation", { name: "Sections disponibles" });
    expect(within(nav).getByRole("link", { name: "Payer mon loyer" }).getAttribute("href")).toBe("/loyers/payer");
    expect(within(nav).getByRole("link", { name: "Mes paiements" }).getAttribute("href")).toBe("/loyers/paiements");
    expect(screen.queryByText("Écran de démonstration")).toBeNull();
  });

  it("annonce que la page de paiement simulée est réservée à la démonstration, sans promettre une ouverture", () => {
    state.mode = "api";
    state.pathname = "/loyers/payer/simulation/inconnu";

    render(
      <ApiRouteGate>
        <p>Écran de démonstration</p>
      </ApiRouteGate>,
    );

    expect(screen.getByRole("heading", { level: 1, name: "Page de paiement simulée" })).toBeTruthy();
    expect(screen.getByText("Réservée à la démonstration")).toBeTruthy();
    expect(screen.queryByText("Bientôt disponible")).toBeNull();
    expect(screen.getByRole("link", { name: "Payer mon loyer" }).getAttribute("href")).toBe("/loyers/payer");
    expect(screen.queryByText("Écran de démonstration")).toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe("mode démo inchangé", () => {
  it.each(pages.map((page) => page.route))("%s : ne gate rien", (route) => {
    state.mode = "demo";
    state.pathname = route;

    render(
      <ApiRouteGate>
        <p>Écran de démonstration</p>
      </ApiRouteGate>,
    );

    expect(screen.getByText("Écran de démonstration")).toBeTruthy();
    expect(screen.queryByText("Bientôt disponible")).toBeNull();
  });
});
