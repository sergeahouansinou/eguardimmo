import { screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { MARKETPLACE, renderApp, stubApi } from "../../../test/api";
import { expectNoA11yViolations } from "../../../test/axe";
import { navigateTo } from "@/lib/navigate";
import { FAVORITES_EMPTY, SUMMARY, SUMMARY_LONG, problem } from "@/marketplace/responses.fixtures";
import { toListing } from "@/marketplace/roost";
import { listingSummarySchema } from "@/marketplace/schemas";
import RoostHome from "./RoostHome";

vi.mock("./Header", () => ({ default: () => <header aria-label="En-tête" /> }));
vi.mock("./Footer", () => ({ default: () => <footer aria-label="Pied de page" /> }));

const short = [toListing(listingSummarySchema.parse(SUMMARY))];
const long = [toListing(listingSummarySchema.parse(SUMMARY_LONG))];
const FAVORITES = `${MARKETPLACE}/favorites`;

afterEach(() => {
  vi.unstubAllGlobals();
  vi.mocked(navigateTo).mockClear();
});

describe("Accueil Roost", () => {
  it("présente les séjours et la longue durée dans des carrousels qui mènent aux annonces", async () => {
    stubApi({ [`GET ${FAVORITES}`]: { body: FAVORITES_EMPTY } });
    const { container } = renderApp(<RoostHome short={short} long={long} status="ready" />);

    const shortRow = screen.getByRole("region", { name: "Courte durée" });
    const longRow = screen.getByRole("region", { name: "Longue durée" });
    const studio = within(shortRow).getByRole("link", { name: /Studio lumineux/ });
    expect(studio.getAttribute("href")).toBe(`/listings/${SUMMARY.ref}`);
    expect(within(studio).getByText("Presqu’île, Lyon")).toBeTruthy();
    expect(within(studio).getByText(/74\s€/)).toBeTruthy();
    expect(within(studio).getByText(/nuit/)).toBeTruthy();
    expect(within(longRow).getByRole("link", { name: /T2 rénové/ }).getAttribute("href")).toBe(`/listings/${SUMMARY_LONG.ref}`);
    expect(within(longRow).getByText(/mois/)).toBeTruthy();
    expect(screen.getByRole("link", { name: "Afficher plus" }).getAttribute("href")).toBe("/destinations");
    await expectNoA11yViolations(container);
  });

  it("filtre les carrousels par catégorie et masque les catégories sans annonce", async () => {
    stubApi({ [`GET ${FAVORITES}`]: { body: FAVORITES_EMPTY } });
    const { user } = renderApp(<RoostHome short={short} long={long} status="ready" />);

    expect(screen.queryByRole("button", { name: "Maisons" })).toBeNull();
    await user.click(screen.getByRole("button", { name: "Appartements" }));
    expect(screen.queryByRole("region", { name: "Courte durée" })).toBeNull();
    expect(screen.getByRole("region", { name: "Longue durée" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Appartements" }).getAttribute("aria-pressed")).toBe("true");
  });

  it("indique l’indisponibilité du catalogue plutôt qu’une absence d’annonces", () => {
    stubApi();
    renderApp(<RoostHome short={[]} long={[]} status="unavailable" />);
    expect(screen.getByRole("alert").textContent).toContain("indisponibles");
    expect(screen.queryByText("Aucune annonce disponible pour le moment.")).toBeNull();
  });

  it("catalogue vide : message d’absence distinct", () => {
    stubApi();
    renderApp(<RoostHome short={[]} long={[]} status="ready" />);
    expect(screen.queryByRole("alert")).toBeNull();
    expect(screen.getByText("Aucune annonce disponible pour le moment.")).toBeTruthy();
  });

  it("visiteur : le cœur d’une carte mène à la connexion centralisée, sans appel favori", async () => {
    const api = stubApi({ "GET /api/v1/me": { status: 401, body: problem(401, "unauthenticated", "Non connecté.") } });
    const { user } = renderApp(<RoostHome short={short} long={[]} status="ready" />);
    await user.click(await screen.findByRole("button", { name: "Ajouter aux favoris" }));
    expect(vi.mocked(navigateTo).mock.calls[0]?.[0]).toContain("http://auth.test/connexion");
    expect(api.calls.some((call) => call.path === FAVORITES)).toBe(false);
  });

  it("connecté : le cœur ajoute l’annonce aux favoris côté serveur", async () => {
    const api = stubApi({ [`GET ${FAVORITES}`]: { body: FAVORITES_EMPTY }, [`PUT ${FAVORITES}/${SUMMARY.ref}`]: { status: 204 } });
    const { user } = renderApp(<RoostHome short={short} long={[]} status="ready" />);
    await user.click(await screen.findByRole("button", { name: "Ajouter aux favoris" }));
    await vi.waitFor(() => { expect(api.count("PUT", `${FAVORITES}/${SUMMARY.ref}`)).toBe(1); });
  });
});
