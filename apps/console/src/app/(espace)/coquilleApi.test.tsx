import { ConsoleSupportBoardPage } from "@eguardimmo/messagerie";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { activityListResponse, meResponse } from "@/console/api/fixtures";
import { Providers } from "../providers";
import { EspaceShell } from "./EspaceShell";

const state = vi.hoisted((): { mode: "demo" | "api"; pathname: string } => ({ mode: "api", pathname: "/support" }));

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

const replace = vi.hoisted(() => vi.fn<(href: string) => void>());

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace, back: vi.fn(), prefetch: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
  usePathname: () => state.pathname,
}));

const FORBIDDEN = ["Inès Garnier", "Résidences du Parc", "Paul Lemoine", "INC-2026-031", "Messagerie dégradée", "Théo Marchand"];
const ACCOUNT = "Compte, espace de travail Équipe opérateur";

const stats = { data: { open: 4, open_high: 1, waiting: 1, resolved_30d: 7, first_response_minutes: 135, first_response_overdue: 2 } };
const tickets = { data: [], links: {}, meta: { total: 0, current_page: 1, last_page: 1, per_page: 20 }, counts: { open: 0, waiting: 0, resolved: 0, all: 0 } };

function stubApi(extra: Record<string, { status: number; body: unknown }> = {}) {
  const calls: { path: string; origin: string; init: RequestInit }[] = [];
  const routes: Record<string, { status: number; body: unknown }> = {
    "/api/v1/console/me": { status: 200, body: meResponse },
    "/api/v1/console/support/stats": { status: 200, body: stats },
    "/api/v1/console/support/tickets": { status: 200, body: tickets },
    "/api/v1/console/support/staff": { status: 200, body: { data: [] } },
    "/api/v1/console/activity": { status: 200, body: activityListResponse },
    ...extra,
  };
  const fetchMock = vi.fn<typeof fetch>((input, init) => {
    const url = new URL(typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url);
    calls.push({ path: url.pathname, origin: url.origin, init: init ?? {} });
    const known = routes[url.pathname];
    const body = known?.body ?? { type: "about:blank", title: "Route non prévue", status: 500, code: "server_error" };
    return Promise.resolve(new Response(JSON.stringify(body), { status: known?.status ?? 500, headers: { "Content-Type": "application/json" } }));
  });
  vi.stubGlobal("fetch", fetchMock);
  return calls;
}

function renderEspace(children: React.ReactNode = <p>Contenu réel</p>) {
  return render(
    <Providers>
      <EspaceShell>{children}</EspaceShell>
    </Providers>,
  );
}

beforeEach(() => {
  state.mode = "api";
  state.pathname = "/support";
  replace.mockClear();
  window.localStorage.clear();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("coquille de la console en mode api", () => {
  it("affiche l'opérateur du serveur, sans aucune donnée de démonstration", async () => {
    stubApi();

    renderEspace();

    await userEvent.click(await screen.findByRole("button", { name: ACCOUNT }));
    const menu = await screen.findByRole("menu", { name: "Menu du compte" });
    expect(within(menu).getByText("Awa Diallo")).toBeTruthy();
    expect(within(menu).getByText("awa.diallo@eguardimmo.test")).toBeTruthy();
    expect(within(menu).getByText("Opérateur")).toBeTruthy();
    expect(screen.getByText("Contenu réel")).toBeTruthy();
    for (const text of FORBIDDEN) expect(document.body.textContent).not.toContain(text);
  });

  it("n'affiche que le compteur de tickets ouverts réel, sans compteur inventé", async () => {
    stubApi();

    renderEspace();

    const side = await screen.findByRole("navigation", { name: "Navigation principale" });
    expect(await within(side).findByRole("link", { name: /Support\s*4$/ })).toBeTruthy();
    for (const label of ["Modules", "Conformité RGPD", "Organisations", "Comptes et profils"]) {
      expect(within(side).queryByRole("link", { name: new RegExp(`${label}\\s*\\d`) }), label).toBeNull();
    }
  });

  it("n'a aucune notification et le dit", async () => {
    stubApi();

    renderEspace();

    await screen.findByRole("button", { name: ACCOUNT });
    await userEvent.click(screen.getByRole("button", { name: "Notifications" }));
    const panel = await screen.findByRole("dialog", { name: "Notifications" });
    expect(within(panel).getByText("Aucune notification.")).toBeTruthy();
    expect(within(panel).getByRole("button", { name: "Tout marquer comme lu" }).hasAttribute("disabled")).toBe(true);
    for (const text of FORBIDDEN) expect(document.body.textContent).not.toContain(text);
  });

  it("ne fait passer aucun appel ailleurs que par l'origine de la console, sans jeton", async () => {
    const calls = stubApi();

    renderEspace(<ConsoleSupportBoardPage />);

    await screen.findByRole("button", { name: ACCOUNT });
    await waitFor(() => { expect(calls.some((call) => call.path === "/api/v1/console/support/tickets")).toBe(true); });
    for (const call of calls) {
      expect(call.origin).toBe(window.location.origin);
      expect(call.path.startsWith("/api/v1/console/")).toBe(true);
      expect(new Headers(call.init.headers).get("authorization")).toBeNull();
    }
  });

  it("remplace une famille sans source par « Bientôt disponible » sans exécuter l'écran de démonstration", async () => {
    const calls = stubApi();
    state.pathname = "/modules";

    renderEspace();

    expect(await screen.findByText("Bientôt disponible")).toBeTruthy();
    expect(screen.getByRole("heading", { level: 1, name: "Modules" })).toBeTruthy();
    expect(screen.queryByText("Contenu réel")).toBeNull();
    for (const text of FORBIDDEN) expect(document.body.textContent).not.toContain(text);
    expect(calls.every((call) => ["/api/v1/console/me", "/api/v1/console/support/stats"].includes(call.path))).toBe(true);
  });

  it("signale l'échec du chargement du compte au lieu d'afficher un compte de démonstration", async () => {
    stubApi({ "/api/v1/console/me": { status: 500, body: { type: "about:blank", title: "Erreur", status: 500, code: "server_error" } } });

    renderEspace();

    expect(await screen.findByText("Le compte n’a pas pu être chargé", {}, { timeout: 4000 })).toBeTruthy();
    for (const text of FORBIDDEN) expect(document.body.textContent).not.toContain(text);
  });

  it("renvoie vers la connexion quand le relais répond 401", async () => {
    stubApi({ "/api/v1/console/me": { status: 401, body: { type: "/problems/unauthenticated", title: "Non authentifié", status: 401, code: "unauthenticated" } } });

    renderEspace();

    await waitFor(() => { expect(replace).toHaveBeenCalledWith("/connexion"); });
  });

  it("garde la coquille de démonstration inchangée en mode démo", async () => {
    state.mode = "demo";
    state.pathname = "/";
    const calls = stubApi();

    renderEspace();

    expect(await screen.findByRole("button", { name: "Compte, espace de travail Équipe opérateur" })).toBeTruthy();
    await userEvent.click(screen.getByRole("button", { name: "Compte, espace de travail Équipe opérateur" }));
    const menu = await screen.findByRole("menu", { name: "Menu du compte" });
    expect(within(menu).getByText("Administrateur")).toBeTruthy();
    expect(within(menu).getByText("Lucas Bernard")).toBeTruthy();
    expect(screen.queryByText("Bientôt disponible")).toBeNull();
    expect(calls).toEqual([]);
  });
});
