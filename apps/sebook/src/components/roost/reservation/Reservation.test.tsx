import { screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MARKETPLACE, renderApp, stubApi } from "../../../../test/api";
import { expectNoA11yViolations } from "../../../../test/axe";
import { navigateTo } from "@/lib/navigate";
import { BOOKING_CONFIRMED, BOOKING_PENDING, DETAIL, DETAIL_LONG, ME_UNVERIFIED, QUOTE, REF, REF_2, problem } from "@/marketplace/responses.fixtures";
import Reservation from "../Reservation";

const L = `${MARKETPLACE}/listings/${REF}`;
const BOOKINGS = `${MARKETPLACE}/bookings`;
const SEARCH = "?arrivee=2027-03-20&depart=2027-03-22&voyageurs=2";

function routes(extra: Parameters<typeof stubApi>[0] = {}) {
  return stubApi({ [`GET ${L}`]: { body: { data: DETAIL } }, [`POST ${L}/quote`]: { body: QUOTE }, ...extra });
}

async function ready(user: ReturnType<typeof renderApp>["user"]) {
  await user.click(await screen.findByRole("checkbox", { name: /conditions de la réservation/ }));
  await waitFor(() => {
    expect(screen.getByRole("button", { name: "Réserver" }).hasAttribute("disabled")).toBe(false);
  });
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2027-01-10T10:00:00Z"));
  vi.mocked(navigateTo).mockClear();
});

afterEach(() => {
  vi.useRealTimers();
});

describe("Réservation : chemin nominal", () => {
  it("enregistre la réservation « Paiement à finaliser », jamais « confirmée »", async () => {
    const api = routes({ [`POST ${BOOKINGS}`]: { status: 201, body: { data: BOOKING_PENDING } } });
    const { user, container } = renderApp(<Reservation publicRef={REF} />, { pathname: `/listings/${REF}/reserve`, search: SEARCH });

    expect(await screen.findByRole("heading", { name: "Demande de réservation" })).toBeTruthy();
    expect(screen.getAllByText(DETAIL.title).length).toBeGreaterThan(0);
    expect(screen.getByText("20 mars 2027")).toBeTruthy();
    expect(await screen.findByText("153 €")).toBeTruthy();
    expect(screen.getByText("148 €")).toBeTruthy();
    expect(screen.getByText("5 €")).toBeTruthy();
    expect(screen.getByText(/Annulation modérée/)).toBeTruthy();
    expect(screen.getByRole("button", { name: "Réserver" }).hasAttribute("disabled")).toBe(true);
    expect(api.last("POST", `${L}/quote`)?.json).toEqual({ check_in: "2027-03-20", check_out: "2027-03-22", guests: 2 });
    await expectNoA11yViolations(container);

    await ready(user);
    await user.click(screen.getByRole("button", { name: "Réserver" }));

    expect(await screen.findByRole("heading", { name: "Paiement à finaliser" })).toBeTruthy();
    expect(screen.getByText(/n’est pas confirmée tant que le paiement n’est pas finalisé/)).toBeTruthy();
    expect(screen.queryByText(/Réservation confirmée/)).toBeNull();
    expect(screen.getByText("SB-2027-000187")).toBeTruthy();
    expect(screen.getByText(/Dates retenues jusqu’au 1 janvier 2027/)).toBeTruthy();
    expect(screen.getByRole("link", { name: "Voir mes réservations" }).getAttribute("href")).toBe("/compte");
    expect(screen.getByRole("link", { name: "Revenir au logement" }).getAttribute("href")).toBe(`/listings/${REF}`);
    const call = api.last("POST", BOOKINGS);
    expect(call?.json).toEqual({ listing_ref: REF, check_in: "2027-03-20", check_out: "2027-03-22", guests: 2 });
    expect(call?.headers["idempotency-key"]).toMatch(/^[0-9a-f-]{36}$/);
    await expectNoA11yViolations(container);
  });

  it("n’annonce « confirmée » que si l’API renvoie le statut confirmed", async () => {
    routes({ [`POST ${BOOKINGS}`]: { status: 201, body: { data: BOOKING_CONFIRMED } } });
    const { user } = renderApp(<Reservation publicRef={REF} />, { search: SEARCH });
    await ready(user);
    await user.click(screen.getByRole("button", { name: "Réserver" }));
    expect(await screen.findByRole("heading", { name: "Réservation confirmée" })).toBeTruthy();
  });

  it("accepte les anciens paramètres ci / co / adults / children", async () => {
    const api = routes();
    renderApp(<Reservation publicRef={REF} />, { search: "?ci=2027-03-20&co=2027-03-22&adults=1&children=1&infants=0" });
    await screen.findByText("153 €");
    expect(api.last("POST", `${L}/quote`)?.json).toEqual({ check_in: "2027-03-20", check_out: "2027-03-22", guests: 2 });
  });
});

describe("Réservation : erreurs et gardes", () => {
  it("409 dates_unavailable : propose de modifier les dates et conserve la clé d’idempotence au réessai", async () => {
    const api = routes({ [`POST ${BOOKINGS}`]: { status: 409, body: problem(409, "dates_unavailable", "Indisponible.") } });
    const { user } = renderApp(<Reservation publicRef={REF} />, { search: SEARCH });
    await ready(user);
    await user.click(screen.getByRole("button", { name: "Réserver" }));
    expect(await screen.findByText("Dates indisponibles")).toBeTruthy();
    expect(screen.getByRole("link", { name: "Modifier mes dates" }).getAttribute("href")).toBe(`/listings/${REF}`);
    expect(screen.queryByRole("heading", { name: "Paiement à finaliser" })).toBeNull();
    await user.click(screen.getByRole("button", { name: "Réserver" }));
    await waitFor(() => {
      expect(api.count("POST", BOOKINGS)).toBe(2);
    });
    const keys = api.calls.filter((call) => call.method === "POST" && call.path === BOOKINGS).map((call) => call.headers["idempotency-key"]);
    expect(keys[0]).toBe(keys[1]);
  });

  it("401 pendant la réservation : redirection vers la connexion", async () => {
    routes({ [`POST ${BOOKINGS}`]: { status: 401, body: problem(401, "unauthenticated", "Non connecté.") } });
    const { user } = renderApp(<Reservation publicRef={REF} />, { search: SEARCH });
    await ready(user);
    await user.click(screen.getByRole("button", { name: "Réserver" }));
    await waitFor(() => {
      expect(navigateTo).toHaveBeenCalled();
    });
    expect(String(vi.mocked(navigateTo).mock.calls[0]?.[0])).toContain("http://auth.test/connexion?return_to=");
  });

  it("visiteur non connecté : le clic sur Réserver redirige vers la connexion sans appeler l’API de réservation", async () => {
    const api = routes({ "GET /api/v1/me": { status: 401, body: problem(401, "unauthenticated", "Non connecté.") } });
    const { user } = renderApp(<Reservation publicRef={REF} />, { search: SEARCH });
    await ready(user);
    await user.click(screen.getByRole("button", { name: "Réserver" }));
    expect(String(vi.mocked(navigateTo).mock.calls[0]?.[0])).toContain("http://auth.test/connexion?return_to=");
    expect(api.count("POST", BOOKINGS)).toBe(0);
  });

  it("403 email_unverified : lien de vérification de l’adresse e-mail", async () => {
    routes({ [`POST ${BOOKINGS}`]: { status: 403, body: problem(403, "email_unverified", "Adresse non vérifiée.") } });
    const { user } = renderApp(<Reservation publicRef={REF} />, { search: SEARCH });
    await ready(user);
    await user.click(screen.getByRole("button", { name: "Réserver" }));
    const link = await screen.findByRole("link", { name: "Confirmer mon adresse e-mail" });
    expect(link.getAttribute("href")).toContain("http://auth.test/verification-email?return_to=");
    expect(screen.getByRole("button", { name: "Réserver" }).hasAttribute("disabled")).toBe(true);
  });

  it("e-mail déjà connu comme non vérifié : lien affiché et réservation bloquée", async () => {
    routes({ "GET /api/v1/me": { body: ME_UNVERIFIED } });
    const { user } = renderApp(<Reservation publicRef={REF} />, { search: SEARCH });
    expect(await screen.findByRole("link", { name: "Confirmer mon adresse e-mail" })).toBeTruthy();
    await user.click(screen.getByRole("checkbox", { name: /conditions de la réservation/ }));
    expect(screen.getByRole("button", { name: "Réserver" }).hasAttribute("disabled")).toBe(true);
  });

  it("devis indisponible (available false) : bloque la réservation", async () => {
    const api = routes({ [`POST ${L}/quote`]: { body: { data: { ...QUOTE.data, available: false } } } });
    const { user } = renderApp(<Reservation publicRef={REF} />, { search: SEARCH });
    expect(await screen.findByText("Dates indisponibles")).toBeTruthy();
    await user.click(screen.getByRole("checkbox", { name: /conditions de la réservation/ }));
    expect(screen.getByRole("button", { name: "Réserver" }).hasAttribute("disabled")).toBe(true);
    expect(api.count("POST", BOOKINGS)).toBe(0);
  });

  it("erreur du devis : prix indisponible et réservation bloquée", async () => {
    routes({ [`POST ${L}/quote`]: { status: 422, body: problem(422, "validation_failed", "Séjour minimum non respecté.") } });
    const { user } = renderApp(<Reservation publicRef={REF} />, { search: SEARCH });
    expect(await screen.findByText("Prix indisponible")).toBeTruthy();
    await user.click(screen.getByRole("checkbox", { name: /conditions de la réservation/ }));
    expect(screen.getByRole("button", { name: "Réserver" }).hasAttribute("disabled")).toBe(true);
  });

  it("arrivée dans le passé : message explicite, aucun devis demandé", async () => {
    const api = routes();
    renderApp(<Reservation publicRef={REF} />, { search: "?arrivee=2027-01-05&depart=2027-01-08&voyageurs=2" });
    expect(await screen.findByText("L’arrivée ne peut pas être dans le passé.")).toBeTruthy();
    expect(api.count("POST", `${L}/quote`)).toBe(0);
  });

  it("séjour sous le minimum de nuits : message explicite, aucun devis demandé", async () => {
    const api = routes();
    renderApp(<Reservation publicRef={REF} />, { search: "?arrivee=2027-03-20&depart=2027-03-21&voyageurs=2" });
    expect(await screen.findByText("Le séjour minimum pour ce logement est de 2 nuits.")).toBeTruthy();
    expect(api.count("POST", `${L}/quote`)).toBe(0);
  });

  it("trop de voyageurs pour la capacité : message explicite", async () => {
    routes();
    renderApp(<Reservation publicRef={REF} />, { search: "?arrivee=2027-03-20&depart=2027-03-22&voyageurs=5" });
    expect(await screen.findByText("Ce logement accueille de 1 à 2 voyageurs.")).toBeTruthy();
  });
});

describe("Réservation : états de la page", () => {
  it("dates invalides, longue durée, annonce introuvable, erreur serveur", async () => {
    routes();
    const first = renderApp(<Reservation publicRef={REF} />, { search: "?arrivee=2027-03-22&depart=2027-03-20&voyageurs=2" });
    expect(await screen.findByText("Choisissez vos dates")).toBeTruthy();
    first.unmount();

    stubApi({ [`GET ${MARKETPLACE}/listings/${REF_2}`]: { body: { data: DETAIL_LONG } } });
    const second = renderApp(<Reservation publicRef={REF_2} />, { search: SEARCH });
    expect(await screen.findByText("Réservation en ligne indisponible")).toBeTruthy();
    second.unmount();

    stubApi({ [`GET ${L}`]: { status: 404, body: problem(404, "not_found", "x") } });
    const third = renderApp(<Reservation publicRef={REF} />, { search: SEARCH });
    expect(await screen.findByText("Annonce introuvable")).toBeTruthy();
    third.unmount();

    const api = stubApi({ [`GET ${L}`]: { status: 500, body: problem(500, "server_error", "x") } });
    const { user } = renderApp(<Reservation publicRef={REF} />, { search: SEARCH });
    expect(await screen.findByText("Annonce indisponible")).toBeTruthy();
    await user.click(screen.getByRole("button", { name: "Réessayer" }));
    await waitFor(() => {
      expect(api.count("GET", L)).toBe(2);
    });
  });

  it("n’affiche ni champ message pour l’hôte, ni moyen de paiement, ni note", async () => {
    routes();
    const { container } = renderApp(<Reservation publicRef={REF} />, { search: SEARCH });
    await screen.findByText("153 €");
    expect(container.querySelector("textarea")).toBeNull();
    expect(screen.queryByText(/carte|code promo|assurance|avis/i)).toBeNull();
  });
});
