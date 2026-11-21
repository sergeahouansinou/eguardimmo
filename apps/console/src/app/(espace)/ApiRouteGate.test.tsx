import { render, screen } from "@testing-library/react";
import { createElement } from "react";
import type { ComponentType } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { pageFiles } from "../../../test/pages";
import { unavailableFamilyOf } from "@/espace/capabilities";
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

const DEMO_TEXTS = ["Inès Garnier", "Résidences du Parc", "Paul Lemoine", "INC-2026-031", "Messagerie dégradée"];

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

describe("routes de la console sans source API en mode api", () => {
  it("compte les pages gatées et les pages servies", () => {
    expect(gated.length).toBe(10);
    expect(served.length).toBeGreaterThanOrEqual(20);
  });

  it.each(gated.map((page) => [page.route, page.file] as const))("%s : affiche « Bientôt disponible » sans exécuter la page ni appeler le réseau", async (route, file) => {
    state.mode = "api";
    state.pathname = route;
    const element = await pageElement(file);

    render(<ApiRouteGate>{element}</ApiRouteGate>);

    expect(screen.getByText("Bientôt disponible")).toBeTruthy();
    expect(screen.getByRole("navigation", { name: "Sections disponibles" })).toBeTruthy();
    expect(screen.queryByRole("link", { name: "Retour à la vue d’ensemble" }) !== null).toBe(route !== "/");
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

  it("explique pourquoi une fonction écartée par l'ADR n'existe pas", () => {
    state.mode = "api";
    state.pathname = "/sauvegardes/restauration";

    render(
      <ApiRouteGate>
        <p>Écran réel</p>
      </ApiRouteGate>,
    );

    expect(screen.getByRole("heading", { level: 1, name: "Restauration" })).toBeTruthy();
    expect(screen.getByText(/jamais depuis l’application/)).toBeTruthy();
    expect(screen.queryByText("Écran réel")).toBeNull();
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
