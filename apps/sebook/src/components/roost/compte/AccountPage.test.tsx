import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MARKETPLACE, renderApp, stubApi } from "../../../../test/api";
import { expectNoA11yViolations } from "../../../../test/axe";
import { navigateTo } from "@/lib/navigate";
import { BOOKINGS_PAGE, BOOKING_CANCELLED, BOOKING_CONFIRMED, BOOKING_ID, BOOKING_PENDING, ME_UNVERIFIED, problem } from "@/marketplace/responses.fixtures";
import AccountPage from "./AccountPage";

vi.mock("../Header", () => ({ default: () => <header aria-label="En-tête" /> }));
vi.mock("../Footer", () => ({ default: () => <footer aria-label="Pied de page" /> }));

const BOOKINGS = `${MARKETPLACE}/bookings`;
const page = (data: unknown[], next: string | null = null) => ({ body: { data, meta: { has_more: next !== null, next_cursor: next } } });

function cardOf(reference: string): HTMLElement {
  const card = screen.getByText(reference).closest("article");
  if (card === null) throw new Error(`Carte introuvable pour ${reference}`);
  return card;
}

function setNow(iso: string) {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date(iso));
}

beforeEach(() => {
  setNow("2026-12-20T10:00:00Z");
  vi.mocked(navigateTo).mockClear();
});

afterEach(() => {
  vi.useRealTimers();
});

describe("Compte voyageur : réservations", () => {
  it("affiche chaque statut sans jamais présenter un paiement à finaliser comme confirmé", async () => {
    stubApi({ [`GET ${BOOKINGS}`]: { body: BOOKINGS_PAGE } });
    const { container } = renderApp(<AccountPage />, { pathname: "/compte" });
    await screen.findByText("SB-2027-000187");
    const pending = cardOf("SB-2027-000187");
    expect(within(pending).getByText("Paiement à finaliser")).toBeTruthy();
    expect(within(pending).getByText("Réservation non confirmée : paiement à finaliser.")).toBeTruthy();
    expect(within(pending).queryByText("Confirmée")).toBeNull();
    expect(within(cardOf("SB-2027-000188")).getByText("Confirmée")).toBeTruthy();
    const cancelled = cardOf("SB-2026-000041");
    expect(within(cancelled).getByText("Annulée")).toBeTruthy();
    expect(within(cancelled).getByText("Montant remboursable selon les conditions : 153 €")).toBeTruthy();
    const completed = cardOf("SB-2026-000040");
    expect(within(completed).getByText("Terminée")).toBeTruthy();
    expect(within(completed).queryByRole("button", { name: /Annuler/ })).toBeNull();
    expect(within(cancelled).queryByRole("button", { name: /Annuler/ })).toBeNull();
    expect(within(pending).getByText("20 mars 2027 → 22 mars 2027 · 2 voyageurs · Agence Rhône Immo")).toBeTruthy();
    expect(within(pending).getByRole("link", { name: BOOKING_PENDING.listing.title }).getAttribute("href")).toBe(`/listings/${BOOKING_PENDING.listing.ref}`);
    await expectNoA11yViolations(container);
  });

  it("délai de paiement dépassé : ne promet plus les dates", async () => {
    setNow("2027-01-10T10:00:00Z");
    stubApi({ [`GET ${BOOKINGS}`]: page([BOOKING_PENDING]) });
    renderApp(<AccountPage />, { pathname: "/compte" });
    await screen.findByText("SB-2027-000187");
    const card = cardOf("SB-2027-000187");
    expect(within(card).getByText("Le délai de paiement est dépassé : les dates ont pu être libérées.")).toBeTruthy();
    expect(within(card).queryByText("Réservation non confirmée : paiement à finaliser.")).toBeNull();
  });

  it("séjour déjà commencé : pas de bouton d’annulation", async () => {
    setNow("2027-03-21T10:00:00Z");
    stubApi({ [`GET ${BOOKINGS}`]: page([BOOKING_CONFIRMED]) });
    renderApp(<AccountPage />, { pathname: "/compte" });
    await screen.findByText("SB-2027-000188");
    expect(screen.queryByRole("button", { name: /Annuler/ })).toBeNull();
  });

  it("annulation confirmée : POST cancel, toast avec montant remboursable, liste rechargée", async () => {
    let cancelled = false;
    const api = stubApi({
      [`GET ${BOOKINGS}`]: () => page(cancelled ? [BOOKING_CANCELLED] : [BOOKING_CONFIRMED]),
      [`POST ${BOOKINGS}/${BOOKING_CONFIRMED.id}/cancel`]: () => {
        cancelled = true;
        return { body: { data: BOOKING_CANCELLED } };
      },
    });
    const { user, container } = renderApp(<AccountPage />, { pathname: "/compte" });
    await user.click(await screen.findByRole("button", { name: "Annuler la réservation SB-2027-000188" }));
    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).getByRole("heading", { name: "Annuler cette réservation ?" })).toBeTruthy();
    expect(within(dialog).getByText(/Remboursement intégral jusqu’à 5 jours avant l’arrivée\. Le montant remboursable est calculé par le serveur/)).toBeTruthy();
    expect(document.activeElement).toBe(within(dialog).getByRole("button", { name: "Conserver" }));
    expect(api.count("POST", `${BOOKINGS}/${BOOKING_CONFIRMED.id}/cancel`)).toBe(0);
    await expectNoA11yViolations(container);
    await user.click(within(dialog).getByRole("button", { name: "Annuler la réservation" }));
    expect(await screen.findByText("Réservation annulée")).toBeTruthy();
    expect(screen.getByText("Montant remboursable selon les conditions : 153 €.")).toBeTruthy();
    expect(api.count("POST", `${BOOKINGS}/${BOOKING_CONFIRMED.id}/cancel`)).toBe(1);
    await waitFor(() => {
      expect(screen.queryByRole("dialog")).toBeNull();
      expect(within(cardOf("SB-2026-000041")).getByText("Annulée")).toBeTruthy();
    });
  });

  it("« Conserver » et Échap ferment la fenêtre sans rien envoyer", async () => {
    const api = stubApi({ [`GET ${BOOKINGS}`]: page([BOOKING_PENDING]) });
    const { user } = renderApp(<AccountPage />, { pathname: "/compte" });
    const opener = await screen.findByRole("button", { name: "Annuler la réservation SB-2027-000187" });
    await user.click(opener);
    await user.click(within(await screen.findByRole("dialog")).getByRole("button", { name: "Conserver" }));
    await waitFor(() => {
      expect(screen.queryByRole("dialog")).toBeNull();
    });
    expect(document.activeElement).toBe(opener);
    await user.click(opener);
    await screen.findByRole("dialog");
    await user.keyboard("{Escape}");
    await waitFor(() => {
      expect(screen.queryByRole("dialog")).toBeNull();
    });
    expect(api.calls.some((call) => call.method === "POST")).toBe(false);
  });

  it("le focus reste dans la fenêtre d’annulation (Tab cyclique)", async () => {
    stubApi({ [`GET ${BOOKINGS}`]: page([BOOKING_PENDING]) });
    const { user } = renderApp(<AccountPage />, { pathname: "/compte" });
    await user.click(await screen.findByRole("button", { name: "Annuler la réservation SB-2027-000187" }));
    const dialog = await screen.findByRole("dialog");
    await user.tab();
    expect(document.activeElement).toBe(within(dialog).getByRole("button", { name: "Annuler la réservation" }));
    await user.tab();
    expect(document.activeElement).toBe(within(dialog).getByRole("button", { name: "Conserver" }));
    await user.tab({ shift: true });
    expect(document.activeElement).toBe(within(dialog).getByRole("button", { name: "Annuler la réservation" }));
  });

  it("annulation refusée (404) : toast d’erreur et liste rechargée", async () => {
    const api = stubApi({
      [`GET ${BOOKINGS}`]: page([BOOKING_CONFIRMED]),
      [`POST ${BOOKINGS}/${BOOKING_CONFIRMED.id}/cancel`]: { status: 404, body: problem(404, "not_found", "Réservation introuvable.") },
    });
    const { user } = renderApp(<AccountPage />, { pathname: "/compte" });
    await user.click(await screen.findByRole("button", { name: "Annuler la réservation SB-2027-000188" }));
    await user.click(within(await screen.findByRole("dialog")).getByRole("button", { name: "Annuler la réservation" }));
    expect(await screen.findByText("Annulation impossible")).toBeTruthy();
    await waitFor(() => {
      expect(api.count("GET", BOOKINGS)).toBe(2);
    });
  });

  it("annulation avec session expirée (401) : redirection vers la connexion", async () => {
    stubApi({
      [`GET ${BOOKINGS}`]: page([BOOKING_CONFIRMED]),
      [`POST ${BOOKINGS}/${BOOKING_CONFIRMED.id}/cancel`]: { status: 401, body: problem(401, "unauthenticated", "Non connecté.") },
    });
    const { user } = renderApp(<AccountPage />, { pathname: "/compte" });
    await user.click(await screen.findByRole("button", { name: "Annuler la réservation SB-2027-000188" }));
    await user.click(within(await screen.findByRole("dialog")).getByRole("button", { name: "Annuler la réservation" }));
    await waitFor(() => {
      expect(navigateTo).toHaveBeenCalled();
    });
    expect(String(vi.mocked(navigateTo).mock.calls.at(-1)?.[0])).toContain("http://auth.test/connexion?return_to=");
  });

  it("aucune réservation : état vide avec lien vers la recherche", async () => {
    stubApi({ [`GET ${BOOKINGS}`]: page([]) });
    renderApp(<AccountPage />, { pathname: "/compte" });
    expect(await screen.findByText("Aucune réservation")).toBeTruthy();
    expect(screen.getByRole("link", { name: "Chercher un logement" }).getAttribute("href")).toBe("/");
  });

  it("erreur serveur : message et bouton Réessayer qui relance la requête", async () => {
    let fail = true;
    const api = stubApi({
      [`GET ${BOOKINGS}`]: () => (fail ? { status: 500, body: problem(500, "server_error", "Erreur.") } : page([BOOKING_CONFIRMED])),
    });
    const { user, container } = renderApp(<AccountPage />, { pathname: "/compte" });
    expect(await screen.findByText("Réservations indisponibles")).toBeTruthy();
    await expectNoA11yViolations(container);
    fail = false;
    await user.click(screen.getByRole("button", { name: "Réessayer" }));
    expect(await screen.findByText("SB-2027-000188")).toBeTruthy();
    expect(api.count("GET", BOOKINGS)).toBe(2);
  });

  it("pagination : « Voir plus » demande la page suivante avec le curseur", async () => {
    const api = stubApi({
      [`GET ${BOOKINGS}`]: (call) => (call.query.get("cursor") === "abc" ? page([BOOKING_CANCELLED]) : page([BOOKING_CONFIRMED], "abc")),
    });
    const { user } = renderApp(<AccountPage />, { pathname: "/compte" });
    await user.click(await screen.findByRole("button", { name: "Voir plus de réservations" }));
    expect(await screen.findByText("SB-2026-000041")).toBeTruthy();
    expect(screen.getByText("SB-2027-000188")).toBeTruthy();
    expect(api.last("GET", BOOKINGS)?.query.get("cursor")).toBe("abc");
    expect(screen.queryByRole("button", { name: "Voir plus de réservations" })).toBeNull();
  });

  it("annonce supprimée : « Annonce indisponible » sans lien", async () => {
    stubApi({ [`GET ${BOOKINGS}`]: page([{ ...BOOKING_CONFIRMED, listing: null }]) });
    renderApp(<AccountPage />, { pathname: "/compte" });
    await screen.findByText("SB-2027-000188");
    const card = cardOf("SB-2027-000188");
    expect(within(card).getByText("Annonce indisponible")).toBeTruthy();
    expect(within(card).queryByRole("link")).toBeNull();
  });

  it("l’identifiant interne de réservation n’apparaît pas dans l’écran", async () => {
    stubApi({ [`GET ${BOOKINGS}`]: { body: BOOKINGS_PAGE } });
    const { container } = renderApp(<AccountPage />, { pathname: "/compte" });
    await screen.findByText("SB-2027-000187");
    expect(container.innerHTML).not.toContain(BOOKING_ID);
  });
});

describe("Compte voyageur : session", () => {
  it("visiteur non connecté : invite à se connecter, sans appeler les réservations", async () => {
    const api = stubApi({ "GET /api/v1/me": { status: 401, body: problem(401, "unauthenticated", "Non connecté.") } });
    renderApp(<AccountPage />, { pathname: "/compte" });
    const button = await screen.findByRole("button", { name: "Se connecter" });
    await userEvent.setup().click(button);
    expect(String(vi.mocked(navigateTo).mock.calls.at(-1)?.[0])).toContain("http://auth.test/connexion?return_to=");
    expect(api.count("GET", BOOKINGS)).toBe(0);
  });

  it("e-mail non vérifié : lien de vérification, pas de réservations chargées", async () => {
    const api = stubApi({ "GET /api/v1/me": { body: ME_UNVERIFIED } });
    renderApp(<AccountPage />, { pathname: "/compte" });
    const link = await screen.findByRole("link", { name: "Confirmer mon adresse e-mail" });
    expect(link.getAttribute("href")).toContain("http://auth.test/verification-email?return_to=");
    expect(api.count("GET", BOOKINGS)).toBe(0);
  });

  it("erreur de session non 401 : message et nouvel essai", async () => {
    stubApi({ "GET /api/v1/me": { status: 500, body: problem(500, "server_error", "Erreur.") } });
    renderApp(<AccountPage />, { pathname: "/compte" });
    expect(await screen.findByText("Impossible d’ouvrir votre compte", {}, { timeout: 6000 })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Réessayer" })).toBeTruthy();
  }, 10_000);
});
