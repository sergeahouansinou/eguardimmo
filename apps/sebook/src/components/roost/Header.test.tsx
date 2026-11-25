import { screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderApp, stubApi } from "../../../test/api";
import { expectNoA11yViolations } from "../../../test/axe";
import { navigateTo } from "@/lib/navigate";
import { problem } from "@/marketplace/responses.fixtures";
import Header from "./Header";

const ANONYMOUS = { "GET /api/v1/me": { status: 401, body: problem(401, "unauthenticated", "Non connecté.") } };

beforeEach(() => {
  localStorage.clear();
  vi.mocked(navigateTo).mockClear();
});

describe("En-tête Roost", () => {
  it("visiteur : inscription et connexion renvoient vers apps/auth avec la page de retour", async () => {
    stubApi(ANONYMOUS);
    const { user, container } = renderApp(<Header />, { pathname: "/destinations" });
    await user.click(screen.getByRole("button", { name: "Menu utilisateur" }));
    const menu = screen.getByRole("menu");
    expect(within(menu).getByRole("menuitem", { name: "Inscription" })).toBeTruthy();
    expect(within(menu).queryByRole("menuitem", { name: "Déconnexion" })).toBeNull();
    await expectNoA11yViolations(container);

    await user.click(within(menu).getByRole("menuitem", { name: "Connexion" }));
    const target = new URL(vi.mocked(navigateTo).mock.calls[0]?.[0] ?? "");
    expect(target.origin).toBe("http://auth.test");
    expect(target.pathname).toBe("/connexion");
    expect(target.searchParams.get("return_to")).toContain("http");
  });

  it("visiteur : « Devenir hôte » mène à l’inscription professionnelle d’apps/auth", () => {
    stubApi(ANONYMOUS);
    renderApp(<Header />);
    expect(screen.getByRole("link", { name: "Devenir hôte" }).getAttribute("href")).toBe("http://auth.test/inscription");
  });

  it("connecté : affiche le nom, les pages du compte et déconnecte côté serveur", async () => {
    const api = stubApi({ "POST /auth/logout": { status: 204 } });
    const { user } = renderApp(<Header />);
    await user.click(await screen.findByRole("button", { name: "Menu utilisateur" }));
    await screen.findByText("Camille Durand");
    expect(screen.getByRole("menuitem", { name: "Mes réservations" }).getAttribute("href")).toBe("/compte");
    expect(screen.getByRole("menuitem", { name: "Mes favoris" }).getAttribute("href")).toBe("/favorites");
    await user.click(screen.getByRole("menuitem", { name: "Déconnexion" }));
    await waitFor(() => { expect(api.count("POST", "/auth/logout")).toBe(1); });
  });

  it("après déconnexion, l’en-tête repasse en visiteur sans recharger la page", async () => {
    const api = stubApi();
    api.on("POST", "/auth/logout", () => {
      api.on("GET", "/api/v1/me", ANONYMOUS["GET /api/v1/me"]);
      return { status: 204 };
    });
    const { user } = renderApp(<Header />);
    await user.click(await screen.findByRole("button", { name: "Menu utilisateur" }));
    expect(screen.getByRole("button", { name: "Menu utilisateur" }).textContent).toContain("C");
    await user.click(screen.getByRole("menuitem", { name: "Déconnexion" }));
    await waitFor(() => { expect(api.count("POST", "/auth/logout")).toBe(1); });
    await waitFor(() => { expect(screen.getByRole("button", { name: "Menu utilisateur" }).textContent).not.toContain("C"); });
  });

  it("l’onglet Logements est actif sur la recherche, l’onglet longue durée mène au bon filtre", () => {
    stubApi(ANONYMOUS);
    renderApp(<Header />, { pathname: "/destinations" });
    const nav = screen.getByRole("navigation", { name: "Navigation principale" });
    expect(within(nav).getByRole("link", { name: /Logements/ }).getAttribute("aria-current")).toBe("page");
    expect(within(nav).getByRole("link", { name: /Longue durée/ }).getAttribute("href")).toBe("/destinations?portee=longue-duree");
  });

  it("le menu de langue change la langue et se ferme avec Échap", async () => {
    stubApi(ANONYMOUS);
    const { user } = renderApp(<Header />);
    await user.click(screen.getByRole("button", { name: /Langue|Language/i }));
    await user.click(screen.getByRole("button", { name: "English (US)" }));
    expect(screen.getByRole("navigation", { name: "Main navigation" })).toBeTruthy();
    await user.keyboard("{Escape}");
    expect(screen.queryByRole("button", { name: "Français" })).toBeNull();
  });
});
