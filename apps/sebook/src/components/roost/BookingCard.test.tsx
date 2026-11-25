import { screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MARKETPLACE, renderApp, stubApi } from "../../../test/api";
import { expectNoA11yViolations } from "../../../test/axe";
import { AVAILABILITY, DETAIL, DETAIL_LONG, QUOTE, REF, REF_2 } from "@/marketplace/responses.fixtures";
import { listingDetailSchema } from "@/marketplace/schemas";
import AnnonceDetail from "./AnnonceDetail";

const L = `${MARKETPLACE}/listings/${REF}`;
const stay = listingDetailSchema.parse(DETAIL);
const none = { checkIn: "", checkOut: "", guests: null };
const march = { checkIn: "2027-03-20", checkOut: "2027-03-22", guests: 2 };

function routes(extra: Parameters<typeof stubApi>[0] = {}) {
  return stubApi({ [`GET ${L}/availability`]: { body: AVAILABILITY }, [`POST ${L}/quote`]: { body: QUOTE }, ...extra });
}

const card = () => screen.getByRole("region", { name: "Tarif et réservation" });

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2027-03-05T10:00:00Z"));
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe("Carte de réservation : séjour", () => {
  it("affiche le devis du serveur et mène à la réservation avec le séjour choisi", async () => {
    const api = routes();
    const { container } = renderApp(<AnnonceDetail detail={stay} initial={march} />);
    const reserved = within(card());

    expect(await reserved.findByText("153 €")).toBeTruthy();
    expect(reserved.getByText("74 € × 2 nuits")).toBeTruthy();
    expect(reserved.getByText("148 €")).toBeTruthy();
    expect(reserved.getByText("Frais de service")).toBeTruthy();
    expect(reserved.getByText("5 €")).toBeTruthy();
    expect(reserved.getByText("74 €")).toBeTruthy();
    expect(reserved.getByText(/par nuit|nuit$/)).toBeTruthy();
    expect(api.last("POST", `${L}/quote`)?.json).toEqual({ check_in: "2027-03-20", check_out: "2027-03-22", guests: 2 });
    expect(api.last("GET", `${L}/availability`)?.query.get("from")).toBe("2027-03-05");
    expect(api.last("GET", `${L}/availability`)?.query.get("to")).toBe("2028-03-04");
    expect(reserved.getByRole("link", { name: "Réserver" }).getAttribute("href")).toBe(`/listings/${REF}/reserve?arrivee=2027-03-20&depart=2027-03-22&voyageurs=2`);
    await expectNoA11yViolations(container);
  });

  it("n’offre pas la réservation tant que le devis n’est pas arrivé", async () => {
    routes({ [`POST ${L}/quote`]: () => ({ body: QUOTE }) });
    renderApp(<AnnonceDetail detail={stay} initial={march} />);
    expect(within(card()).queryByRole("link", { name: "Réserver" })).toBeNull();
    expect(await within(card()).findByRole("link", { name: "Réserver" })).toBeTruthy();
  });

  it("devis available:false : message d’indisponibilité, pas de total, réservation impossible", async () => {
    routes({ [`POST ${L}/quote`]: { body: { data: { ...QUOTE.data, available: false } } } });
    renderApp(<AnnonceDetail detail={stay} initial={march} />);
    const reserved = within(card());
    expect(await reserved.findByText("Ces dates ne sont pas disponibles. Choisissez d’autres dates.")).toBeTruthy();
    expect(reserved.queryByText("Total")).toBeNull();
    expect(reserved.queryByRole("link", { name: "Réserver" })).toBeNull();
    expect(reserved.getByRole("button", { name: "Réserver" }).hasAttribute("disabled")).toBe(true);
  });

  it("bloque la réservation sur des dates occupées, sans appeler le devis", async () => {
    const api = routes({ [`GET ${L}/availability`]: { body: { data: [{ check_in: "2027-03-19", check_out: "2027-03-25" }] } } });
    renderApp(<AnnonceDetail detail={stay} initial={march} />);
    expect(await within(card()).findByText("Ces dates ne sont pas disponibles. Choisissez d’autres dates.")).toBeTruthy();
    expect(within(card()).getByRole("button", { name: "Réserver" }).hasAttribute("disabled")).toBe(true);
    expect(api.count("POST", `${L}/quote`)).toBe(0);
  });

  it("refuse un séjour sous le minimum de nuits", async () => {
    const api = routes();
    renderApp(<AnnonceDetail detail={stay} initial={{ ...march, checkOut: "2027-03-21" }} />);
    expect(await within(card()).findByText("Le séjour minimum pour ce logement est de 2 nuits.")).toBeTruthy();
    expect(within(card()).getByRole("button", { name: "Sélectionnez au moins 2 nuits pour continuer" }).hasAttribute("disabled")).toBe(true);
    expect(api.count("POST", `${L}/quote`)).toBe(0);
  });

  it("signale une arrivée dans le passé sans appeler le devis", async () => {
    const api = routes();
    renderApp(<AnnonceDetail detail={stay} initial={{ checkIn: "2027-02-10", checkOut: "2027-02-12", guests: 1 }} />);
    expect(await within(card()).findByText("L’arrivée ne peut pas être dans le passé.")).toBeTruthy();
    expect(api.count("POST", `${L}/quote`)).toBe(0);
  });

  it("sans dates : invite à choisir les dates et ne demande aucun devis", async () => {
    const api = routes();
    renderApp(<AnnonceDetail detail={stay} initial={none} />);
    const reserved = within(card());
    expect(reserved.getByRole("button", { name: "Vérifier les disponibilités" }).hasAttribute("disabled")).toBe(true);
    expect(reserved.getByText("Sélectionnez vos dates pour voir le total")).toBeTruthy();
    await waitFor(() => {
      expect(api.count("GET", `${L}/availability`)).toBe(1);
    });
    expect(api.count("POST", `${L}/quote`)).toBe(0);
  });

  it("choisit les dates dans le calendrier : jours occupés grisés, devis puis lien de réservation", async () => {
    const api = routes();
    const { user } = renderApp(<AnnonceDetail detail={stay} initial={none} />);

    await user.click(within(card()).getByRole("button", { name: /ARRIVÉE/ }));
    const popover = within(screen.getByRole("group", { name: "Choisir vos dates" }));
    expect(popover.getByRole("button", { name: "12 mars 2027 (Indisponible)" }).hasAttribute("disabled")).toBe(true);
    expect(popover.getByRole("button", { name: "9 mars 2027" }).hasAttribute("disabled")).toBe(false);
    expect(popover.getByRole("button", { name: "4 mars 2027" }).hasAttribute("disabled")).toBe(true);

    await user.click(popover.getByRole("button", { name: "20 mars 2027" }));
    await user.click(popover.getByRole("button", { name: "22 mars 2027" }));

    expect(await within(card()).findByRole("link", { name: "Réserver" })).toBeTruthy();
    expect(within(card()).getByRole("link", { name: "Réserver" }).getAttribute("href")).toBe(`/listings/${REF}/reserve?arrivee=2027-03-20&depart=2027-03-22&voyageurs=1`);
    expect(api.last("POST", `${L}/quote`)?.json).toEqual({ check_in: "2027-03-20", check_out: "2027-03-22", guests: 1 });
  });

  it("empêche un séjour qui traverse une nuit occupée", async () => {
    routes();
    const { user } = renderApp(<AnnonceDetail detail={stay} initial={none} />);
    await user.click(within(card()).getByRole("button", { name: /ARRIVÉE/ }));
    const popover = within(screen.getByRole("group", { name: "Choisir vos dates" }));
    await user.click(popover.getByRole("button", { name: "8 mars 2027" }));
    await user.click(popover.getByRole("button", { name: "16 mars 2027" }));
    expect(popover.getByRole("button", { name: "16 mars 2027" }).getAttribute("aria-pressed")).toBe("true");
    expect(popover.getByRole("button", { name: "8 mars 2027" }).getAttribute("aria-pressed")).toBe("false");
    expect(within(card()).queryByRole("link", { name: "Réserver" })).toBeNull();
  });

  it("plafonne les voyageurs à la capacité de l’annonce", async () => {
    const api = routes();
    const { user } = renderApp(<AnnonceDetail detail={stay} initial={{ ...march, guests: 1 }} />);
    await user.click(within(card()).getByRole("button", { name: /VOYAGEURS/ }));
    await user.click(screen.getByRole("button", { name: "Ajouter un voyageur" }));
    expect(screen.getByRole("button", { name: "Ajouter un voyageur" }).hasAttribute("disabled")).toBe(true);
    expect(screen.getByText("Ce logement accueille au maximum 2 voyageurs")).toBeTruthy();
    expect(within(card()).getByRole("button", { name: /VOYAGEURS/ }).textContent).toContain("2 voyageurs");
    await waitFor(() => {
      expect(api.last("POST", `${L}/quote`)?.json).toEqual({ check_in: "2027-03-20", check_out: "2027-03-22", guests: 2 });
    });
    await user.click(screen.getByRole("button", { name: "Retirer un voyageur" }));
    await user.click(screen.getByRole("button", { name: "Retirer un voyageur" }));
    expect(screen.getByRole("button", { name: "Retirer un voyageur" }).hasAttribute("disabled")).toBe(true);
  });

  it("ramène le nombre de voyageurs de l’adresse dans la capacité", () => {
    routes();
    renderApp(<AnnonceDetail detail={stay} initial={{ ...march, guests: 9 }} />);
    expect(within(card()).getByRole("button", { name: /VOYAGEURS/ }).textContent).toContain("2 voyageurs");
  });

  it("affiche une erreur claire si le devis échoue", async () => {
    routes({ [`POST ${L}/quote`]: { status: 422, body: { type: "x", title: "Dates invalides", status: 422, code: "invalid", detail: "Dates invalides" } } });
    renderApp(<AnnonceDetail detail={stay} initial={march} />);
    expect(await within(card()).findByRole("alert")).toBeTruthy();
    expect(within(card()).queryByRole("link", { name: "Réserver" })).toBeNull();
  });
});

describe("Carte de réservation : longue durée", () => {
  it("ne propose aucune réservation en ligne, seulement la demande de visite", async () => {
    const api = stubApi();
    const { container } = renderApp(<AnnonceDetail detail={listingDetailSchema.parse(DETAIL_LONG)} initial={march} />);
    const reserved = within(card());
    expect(reserved.getByText("850 €")).toBeTruthy();
    expect(reserved.getByText(/mois/)).toBeTruthy();
    expect(reserved.getByText("Cette location longue durée ne se réserve pas en ligne. Demandez une visite à l’hôte.")).toBeTruthy();
    expect(reserved.queryByRole("button", { name: /ARRIVÉE/ })).toBeNull();
    expect(reserved.queryByRole("link", { name: "Réserver" })).toBeNull();
    expect(reserved.getByRole("button", { name: "Demander une visite" })).toBeTruthy();
    expect(screen.queryByText("Disponibilité")).toBeNull();
    expect(api.calls.filter((call) => call.path.includes(REF_2))).toHaveLength(0);
    await expectNoA11yViolations(container);
  });
});
