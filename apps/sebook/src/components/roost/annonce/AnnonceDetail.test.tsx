import { screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MARKETPLACE, renderApp, stubApi } from "../../../../test/api";
import { expectNoA11yViolations } from "../../../../test/axe";
import { navigateTo } from "@/lib/navigate";
import { AVAILABILITY, DETAIL, DETAIL_LONG, FAVORITES_EMPTY, FAVORITES_PAGE, REF, REF_2, problem } from "@/marketplace/responses.fixtures";
import { listingDetailSchema } from "@/marketplace/schemas";
import AnnonceDetail from "../AnnonceDetail";

const L = `${MARKETPLACE}/listings/${REF}`;
const FAVORITES = `${MARKETPLACE}/favorites`;
const none = { checkIn: "", checkOut: "", guests: null };
const stay = listingDetailSchema.parse(DETAIL);
const long = listingDetailSchema.parse(DETAIL_LONG);

function routes(extra: Parameters<typeof stubApi>[0] = {}) {
  return stubApi({ [`GET ${L}/availability`]: { body: AVAILABILITY }, [`GET ${FAVORITES}`]: { body: FAVORITES_EMPTY }, ...extra });
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2027-03-05T10:00:00Z"));
  vi.mocked(navigateTo).mockClear();
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe("Fiche annonce : contenu", () => {
  it("affiche uniquement les données de l’API", async () => {
    routes();
    const { container } = renderApp(<AnnonceDetail detail={stay} initial={none} />);

    expect(screen.getByRole("heading", { level: 1, name: "Studio lumineux, Presqu’île" })).toBeTruthy();
    expect(screen.getByRole("heading", { level: 2, name: "Studio · Presqu’île, Lyon" })).toBeTruthy();
    expect(screen.getByText("2 voyageurs · 1 pièce · 28 m²")).toBeTruthy();
    expect(screen.getByText("Hébergé par Agence Rhône Immo")).toBeTruthy();
    expect(screen.getByText("Studio de 28 m² au 3e étage avec ascenseur.")).toBeTruthy();
    expect(screen.getByRole("heading", { name: "Ce que propose ce logement" })).toBeTruthy();
    expect(screen.getByText("Wi-Fi")).toBeTruthy();
    expect(screen.getByText("Cuisine équipée")).toBeTruthy();
    const characteristics = within(screen.getByRole("heading", { name: "Caractéristiques" }).parentElement ?? container);
    expect(characteristics.getByText(new RegExp(REF))).toBeTruthy();
    expect(characteristics.getByText(/300 €/)).toBeTruthy();
    expect(characteristics.getByText(/2 nuits/)).toBeTruthy();
    expect(await screen.findByRole("heading", { name: "Disponibilité" })).toBeTruthy();
    await expectNoA11yViolations(container);
  });

  it("ne montre aucune section sans équivalent dans l’API", () => {
    routes();
    const { container } = renderApp(<AnnonceDetail detail={stay} initial={none} />);
    for (const absent of [/avis/i, /Nouveau/, /Superh/, /Coup de c/, /Où vous serez/, /Faites connaissance/, /Règlement/, /Arrivée à partir/, /Sécurité/, /Perle rare/, /Voir toutes les photos/, /Bébés/, /Animaux$/]) {
      expect(screen.queryByText(absent)).toBeNull();
    }
    expect(container.querySelector("iframe, img")).toBeNull();
    expect(container.querySelector(".r-annonce-gallery")?.getAttribute("aria-hidden")).toBe("true");
  });

  it("replie la description au premier paragraphe et la déplie à la demande", async () => {
    routes();
    const { user } = renderApp(<AnnonceDetail detail={stay} initial={none} />);
    expect(screen.queryByText("Linge fourni.")).toBeNull();
    await user.click(screen.getByRole("button", { name: "Afficher plus" }));
    expect(screen.getByText("Linge fourni.")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Afficher moins" }).getAttribute("aria-expanded")).toBe("true");
  });

  it("explique la politique d’annulation réelle de l’annonce", () => {
    routes();
    renderApp(<AnnonceDetail detail={stay} initial={none} />);
    const section = within(screen.getByRole("region", { name: "À savoir" }));
    expect(section.getByText("Modérée")).toBeTruthy();
    expect(section.getByText("Remboursement intégral jusqu’à 5 jours avant l’arrivée.")).toBeTruthy();
  });

  it("propose un fil d’Ariane vers la recherche du même type", () => {
    routes();
    renderApp(<AnnonceDetail detail={stay} initial={none} />);
    const nav = within(screen.getByRole("navigation", { name: "Fil d’Ariane" }));
    expect(nav.getByRole("link", { name: "Accueil" }).getAttribute("href")).toBe("/");
    expect(nav.getByRole("link", { name: "Séjours" }).getAttribute("href")).toBe("/destinations");
    expect(nav.getByText("Lyon")).toBeTruthy();
  });

  it("ouvre tous les équipements dans une fenêtre quand il y en a plus de dix", async () => {
    routes();
    const ids = ["wifi", "kitchen", "washer", "dishwasher", "air_conditioning", "heating", "parking", "elevator", "balcony", "terrace", "garden", "pool"];
    const many = listingDetailSchema.parse({ ...DETAIL, amenities: ids });
    const { user } = renderApp(<AnnonceDetail detail={many} initial={none} />);
    expect(screen.queryByText("Piscine")).toBeNull();
    await user.click(screen.getByRole("button", { name: "Voir les 12 équipements" }));
    const dialog = screen.getByRole("dialog", { name: "Ce que propose ce logement" });
    expect(within(dialog).getByText("Piscine")).toBeTruthy();
    expect(within(dialog).getAllByRole("listitem")).toHaveLength(12);
    await user.keyboard("{Escape}");
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(document.activeElement).toBe(screen.getByRole("button", { name: "Voir les 12 équipements" }));
  });

  it("ne propose pas la fenêtre des équipements quand tout tient dans la liste", () => {
    routes();
    renderApp(<AnnonceDetail detail={stay} initial={none} />);
    expect(screen.queryByRole("button", { name: /Voir les/ })).toBeNull();
  });
});

describe("Fiche annonce : longue durée", () => {
  it("n’affiche ni calendrier, ni annulation, ni séjour minimum, et ouvre la demande de visite", async () => {
    const api = stubApi({ [`GET ${FAVORITES}`]: { body: FAVORITES_EMPTY } });
    const { user, container } = renderApp(<AnnonceDetail detail={long} initial={none} />);
    expect(screen.getByRole("heading", { level: 1, name: "T2 rénové, Croix-Rousse" })).toBeTruthy();
    expect(screen.getByRole("heading", { level: 2, name: "Appartement · Presqu’île, Lyon" })).toBeTruthy();
    expect(screen.getByText("3 voyageurs · 2 pièces · 46,5 m²")).toBeTruthy();
    expect(screen.queryByText("À savoir")).toBeNull();
    expect(screen.queryByText("Disponibilité")).toBeNull();
    expect(screen.queryByText("Hébergé par")).toBeNull();
    expect(screen.getByRole("link", { name: "Longue durée" }).getAttribute("href")).toBe("/destinations?portee=longue-duree");
    expect(api.calls.filter((call) => call.path.includes(REF_2))).toHaveLength(0);

    await user.click(screen.getByRole("button", { name: "Demander une visite" }));
    expect(await screen.findByRole("dialog", { name: "Demander une visite" })).toBeTruthy();
    expect(screen.getByText("Votre demande est transmise à l’hôte.")).toBeTruthy();
    await expectNoA11yViolations(container);
  });
});

describe("Fiche annonce : calendrier de disponibilité", () => {
  it("affiche deux mois, grise les nuits occupées et borne la navigation à 365 jours", async () => {
    routes();
    const { user } = renderApp(<AnnonceDetail detail={stay} initial={none} />);
    expect(await screen.findByRole("button", { name: "10 mars 2027 (Indisponible)" })).toBeTruthy();
    expect(screen.getByText("mars 2027")).toBeTruthy();
    expect(screen.getByText("avril 2027")).toBeTruthy();
    expect(screen.getByRole("button", { name: "10 mars 2027 (Indisponible)" }).hasAttribute("disabled")).toBe(true);
    expect(screen.getByRole("button", { name: "14 mars 2027" }).hasAttribute("disabled")).toBe(false);
    expect(screen.getByRole("button", { name: "4 mars 2027" }).hasAttribute("disabled")).toBe(true);
    expect(screen.getByRole("button", { name: "Mois précédent" }).hasAttribute("disabled")).toBe(true);

    for (let step = 0; step < 11; step += 1) await user.click(screen.getByRole("button", { name: "Mois suivant" }));
    expect(screen.getByText("mars 2028")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Mois suivant" }).hasAttribute("disabled")).toBe(true);
    expect(screen.getByRole("button", { name: "4 mars 2028" }).hasAttribute("disabled")).toBe(false);
    expect(screen.getByRole("button", { name: "5 mars 2028" }).hasAttribute("disabled")).toBe(true);
  });

  it("met à jour le titre avec les nuits choisies et le séjour minimum s’applique", async () => {
    routes();
    const { user } = renderApp(<AnnonceDetail detail={stay} initial={none} />);
    await user.click(await screen.findByRole("button", { name: "20 mars 2027" }));
    await user.click(screen.getByRole("button", { name: "21 mars 2027" }));
    expect(screen.queryByRole("heading", { name: "1 nuit à Lyon" })).toBeNull();
    await user.click(screen.getByRole("button", { name: "23 mars 2027" }));
    expect(screen.getByRole("heading", { name: "3 nuits à Lyon" })).toBeTruthy();
    expect(screen.getByText("20 mars – 23 mars")).toBeTruthy();
  });

  it("signale les disponibilités injoignables au lieu de les ignorer", async () => {
    routes({ [`GET ${L}/availability`]: { status: 500, body: problem(500, "server_error", "Erreur") } });
    renderApp(<AnnonceDetail detail={stay} initial={none} />);
    expect(await screen.findByText(/disponibilités n’ont pas pu être chargées/)).toBeTruthy();
  });
});

describe("Fiche annonce : favori et partage", () => {
  it("enregistre en favori un utilisateur connecté", async () => {
    let saved = false;
    const api = routes({
      [`GET ${FAVORITES}`]: () => ({ body: saved ? FAVORITES_PAGE : FAVORITES_EMPTY }),
      [`PUT ${FAVORITES}/${REF}`]: () => {
        saved = true;
        return { status: 204 };
      },
    });
    const { user } = renderApp(<AnnonceDetail detail={stay} initial={none} />);
    await waitFor(() => {
      expect(api.count("GET", FAVORITES)).toBe(1);
    });
    await user.click(screen.getByRole("button", { name: "Ajouter aux favoris" }));
    expect(await screen.findByRole("button", { name: "Retirer des favoris" })).toBeTruthy();
    expect(api.count("PUT", `${FAVORITES}/${REF}`)).toBe(1);
    expect(screen.getByRole("button", { name: "Retirer des favoris" }).getAttribute("aria-pressed")).toBe("true");
    expect(vi.mocked(navigateTo)).not.toHaveBeenCalled();
  });

  it("redirige un visiteur non connecté vers la connexion", async () => {
    const api = routes({ "GET /api/v1/me": { status: 401, body: problem(401, "unauthenticated", "Unauthenticated.") } });
    const { user } = renderApp(<AnnonceDetail detail={stay} initial={none} />);
    await waitFor(() => {
      expect(api.count("GET", "/api/v1/me")).toBe(1);
    });
    await user.click(screen.getByRole("button", { name: "Ajouter aux favoris" }));
    await waitFor(() => {
      expect(vi.mocked(navigateTo)).toHaveBeenCalledTimes(1);
    });
    expect(String(vi.mocked(navigateTo).mock.calls[0]?.[0])).toMatch(/^http:\/\/auth\.test\/connexion\?return_to=/);
    expect(api.count("PUT", `${FAVORITES}/${REF}`)).toBe(0);
  });

  it("copie le lien de la fiche et le confirme", async () => {
    routes();
    const { user } = renderApp(<AnnonceDetail detail={stay} initial={none} />);
    await user.click(screen.getByRole("button", { name: "Partager" }));
    expect(await screen.findByRole("button", { name: "Lien copié" })).toBeTruthy();
    expect(await navigator.clipboard.readText()).toBe(`${window.location.origin}/listings/${REF}`);
    expect(screen.getAllByRole("status").some((region) => region.textContent === "Lien copié")).toBe(true);
  });
});
