import { screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { renderApp, stubApi } from "../../../test/api";
import { expectNoA11yViolations } from "../../../test/axe";
import { nav } from "../../../test/navigation";
import { SUMMARY, SUMMARY_LONG } from "@/marketplace/responses.fixtures";
import { toListing } from "@/marketplace/roost";
import { listingSummarySchema } from "@/marketplace/schemas";
import { EMPTY_SEARCH, searchFromParams } from "@/marketplace/search";
import RoostDestination from "./RoostDestination";

vi.mock("./Header", () => ({ default: () => <header aria-label="En-tête" /> }));
vi.mock("./Footer", () => ({ default: () => <footer aria-label="Pied de page" /> }));

const listings = [SUMMARY, SUMMARY_LONG].map((item) => toListing(listingSummarySchema.parse(item)));
const hrefOf = () => {
  const url = new URL(nav.push.mock.calls.at(-1)?.[0] ?? "", "http://sebook.test");
  return { path: url.pathname, params: Object.fromEntries(url.searchParams) };
};

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("Page destinations Roost", () => {
  it("affiche les résultats avec les dates du séjour reportées sur les liens", async () => {
    stubApi();
    const search = searchFromParams({ place: "lyon", lieu: "<b>Faux</b>", arrivee: "2027-03-20", depart: "2027-03-22", voyageurs: "2" });
    const { container } = renderApp(<RoostDestination search={search} listings={listings} nextCursor={null} status="ready" placeName="Lyon" />, { pathname: "/destinations" });
    expect(screen.getByRole("heading", { level: 1, name: "Logements à réserver à Lyon" })).toBeTruthy();
    expect(container.textContent).not.toContain("Faux");
    const link = screen.getByRole("link", { name: /Studio lumineux/ });
    expect(link.getAttribute("href")).toBe(`/listings/${SUMMARY.ref}?arrivee=2027-03-20&depart=2027-03-22&voyageurs=2`);
    expect(screen.queryByRole("link", { name: "Page suivante" })).toBeNull();
    await expectNoA11yViolations(container);
  });

  it("pagination par curseur : page suivante et retour à la première page", () => {
    stubApi();
    const second = searchFromParams({ apres: "eyJpZCI6MTJ9" });
    renderApp(<RoostDestination search={second} listings={listings} nextCursor="abcDEF123" status="ready" placeName={null} />, { pathname: "/destinations" });
    expect(screen.getByRole("link", { name: "Page suivante" }).getAttribute("href")).toBe("/destinations?apres=abcDEF123");
    expect(screen.getByRole("link", { name: "Première page" }).getAttribute("href")).toBe("/destinations");
  });

  it("l’onglet longue durée garde le lieu et repart de la première page", () => {
    stubApi();
    const search = searchFromParams({ place: "lyon", apres: "eyJpZCI6MTJ9" });
    renderApp(<RoostDestination search={search} listings={listings} nextCursor={null} status="ready" placeName={null} />, { pathname: "/destinations" });
    const tabs = screen.getByRole("navigation", { name: "Type de location" });
    expect(within(tabs).getByRole("link", { name: "Longue durée" }).getAttribute("href")).toBe("/destinations?portee=longue-duree&place=lyon");
    expect(within(tabs).getByRole("link", { name: "Courte durée" }).getAttribute("aria-current")).toBe("page");
  });

  it("une catégorie de la barre devient le paramètre categorie, « Tout » le retire", async () => {
    stubApi();
    const { user } = renderApp(<RoostDestination search={EMPTY_SEARCH} listings={listings} nextCursor={null} status="ready" placeName={null} />, { pathname: "/destinations" });
    await user.click(screen.getByRole("button", { name: "Maisons" }));
    expect(hrefOf()).toEqual({ path: "/destinations", params: { categorie: "house" } });
    expect(screen.getByRole("button", { name: "Tout" }).getAttribute("aria-pressed")).toBe("true");
  });

  it("le panneau de filtres valide les prix puis écrit l’URL", async () => {
    stubApi();
    const { user } = renderApp(<RoostDestination search={EMPTY_SEARCH} listings={listings} nextCursor={null} status="ready" placeName={null} />, { pathname: "/destinations" });
    await user.click(screen.getByRole("button", { name: /Filtres/ }));
    const dialog = await screen.findByRole("dialog", { name: "Filtres" });
    await user.type(within(dialog).getByLabelText("Minimum"), "90");
    await user.type(within(dialog).getByLabelText("Prix maximum"), "50");
    await user.click(within(dialog).getByRole("button", { name: "Afficher les logements" }));
    expect(within(dialog).getByRole("alert").textContent).toContain("dépasse");
    expect(nav.push).not.toHaveBeenCalled();

    await user.clear(within(dialog).getByLabelText("Prix maximum"));
    await user.type(within(dialog).getByLabelText("Prix maximum"), "200");
    await user.click(within(dialog).getByRole("button", { name: "4" }));
    await user.click(within(dialog).getByRole("button", { name: "Wi-Fi" }));
    await user.click(within(dialog).getByRole("button", { name: "Prix croissant" }));
    await user.click(within(dialog).getByRole("button", { name: "Afficher les logements" }));
    expect(hrefOf()).toEqual({ path: "/destinations", params: { voyageurs: "4", prix_min: "90", prix_max: "200", equipements: "wifi", tri: "price_asc" } });
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("affiche le nombre de filtres actifs sur le bouton", () => {
    stubApi();
    renderApp(<RoostDestination search={searchFromParams({ voyageurs: "2", equipements: "wifi,kitchen" })} listings={listings} nextCursor={null} status="ready" placeName={null} />, { pathname: "/destinations" });
    expect(screen.getByRole("button", { name: /Filtres/ }).textContent).toContain("3");
  });

  it("sans nom de lieu fourni par l’API, le titre reste générique même si l’URL porte un texte", () => {
    stubApi();
    const { container } = renderApp(<RoostDestination search={searchFromParams({ place: "lyon", lieu: "Texte libre" })} listings={listings} nextCursor={null} status="ready" placeName={null} />, { pathname: "/destinations" });
    expect(screen.getByRole("heading", { level: 1 }).textContent).toBe("Logements à réserver");
    expect(container.textContent).not.toContain("Texte libre");
  });

  it("aucun résultat : message et lien vers toutes les annonces du même type", () => {
    stubApi();
    renderApp(<RoostDestination search={searchFromParams({ portee: "longue-duree", place: "lyon" })} listings={[]} nextCursor={null} status="ready" placeName={null} />, { pathname: "/destinations" });
    expect(screen.getByText(/Aucun logement ne correspond/)).toBeTruthy();
    expect(screen.getByRole("link", { name: "Voir toutes les annonces" }).getAttribute("href")).toBe("/destinations?portee=longue-duree");
  });

  it("recherche indisponible : alerte, jamais « aucun résultat »", () => {
    stubApi();
    renderApp(<RoostDestination search={EMPTY_SEARCH} listings={[]} nextCursor={null} status="unavailable" placeName={null} />, { pathname: "/destinations" });
    expect(screen.getByRole("alert").textContent).toContain("indisponible");
    expect(screen.queryByText(/Aucun logement ne correspond/)).toBeNull();
  });
});
