import { screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { MARKETPLACE, renderApp, stubApi } from "../../../../test/api";
import { expectNoA11yViolations } from "../../../../test/axe";
import { navigateTo } from "@/lib/navigate";
import { FAVORITES_EMPTY, FAVORITES_PAGE, SUMMARY, problem } from "@/marketplace/responses.fixtures";
import FavoritesView from "./FavoritesView";

vi.mock("../Header", () => ({ default: () => <header aria-label="En-tête" /> }));
vi.mock("../Footer", () => ({ default: () => <footer aria-label="Pied de page" /> }));
vi.mock("@/components/roost/ListingCard", () => ({
  default: ({ listing }: { listing: { id: string; title: string } }) => <a href={`/listings/${listing.id}`}>{listing.title}</a>,
}));

const FAVORITES = `${MARKETPLACE}/favorites`;

beforeEach(() => {
  vi.mocked(navigateTo).mockClear();
});

describe("Page favoris", () => {
  it("liste les annonces favorites sous forme de cartes", async () => {
    stubApi({ [`GET ${FAVORITES}`]: { body: FAVORITES_PAGE } });
    const { container } = renderApp(<FavoritesView />, { pathname: "/favorites" });
    expect(await screen.findByRole("heading", { name: "Mes favoris" })).toBeTruthy();
    expect((await screen.findByRole("link", { name: SUMMARY.title })).getAttribute("href")).toBe(`/listings/${SUMMARY.ref}`);
    await expectNoA11yViolations(container);
  });

  it("aucun favori : message dédié", async () => {
    stubApi({ [`GET ${FAVORITES}`]: { body: FAVORITES_EMPTY } });
    renderApp(<FavoritesView />, { pathname: "/favorites" });
    expect(await screen.findByText("Aucun favori pour le moment.")).toBeTruthy();
  });

  it("chargement : zone annoncée comme occupée tant que la liste n’est pas arrivée", async () => {
    stubApi({ [`GET ${FAVORITES}`]: () => ({ body: FAVORITES_PAGE }) });
    renderApp(<FavoritesView />, { pathname: "/favorites" });
    expect(screen.getByRole("status", { name: /Chargement/ }).getAttribute("aria-busy")).toBe("true");
    await screen.findByRole("link", { name: SUMMARY.title });
  });

  it("erreur serveur : message et nouvel essai qui recharge la liste", async () => {
    let fail = true;
    const api = stubApi({ [`GET ${FAVORITES}`]: () => (fail ? { status: 500, body: problem(500, "server_error", "Erreur.") } : { body: FAVORITES_PAGE }) });
    const { user, container } = renderApp(<FavoritesView />, { pathname: "/favorites" });
    expect(await screen.findByText("Favoris indisponibles")).toBeTruthy();
    expect(screen.queryByText("Aucun favori pour le moment.")).toBeNull();
    await expectNoA11yViolations(container);
    fail = false;
    await user.click(screen.getByRole("button", { name: "Réessayer" }));
    expect(await screen.findByRole("link", { name: SUMMARY.title })).toBeTruthy();
    expect(api.count("GET", FAVORITES)).toBe(2);
  });

  it("visiteur non connecté : invite à se connecter et ne charge pas les favoris", async () => {
    const api = stubApi({ "GET /api/v1/me": { status: 401, body: problem(401, "unauthenticated", "Non connecté.") } });
    const { user } = renderApp(<FavoritesView />, { pathname: "/favorites" });
    expect(await screen.findByText("Connectez-vous pour retrouver vos annonces sauvegardées.")).toBeTruthy();
    await user.click(screen.getByRole("button", { name: "Se connecter" }));
    await waitFor(() => {
      expect(navigateTo).toHaveBeenCalled();
    });
    expect(String(vi.mocked(navigateTo).mock.calls[0]?.[0])).toContain("http://auth.test/connexion?return_to=");
    expect(api.count("GET", FAVORITES)).toBe(0);
  });
});
