import { screen, waitFor, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  LEASE_ENDED_ID,
  LEASE_ID,
  LEASE_LOIRE_ID,
  ORG_LOIRE,
  detail,
  leasePage,
  problem,
  summary,
} from "@/tenant/responses.fixtures";
import { expectNoA11yViolations } from "../../../test/axe";
import { renderApi, stubApi } from "../../../test/api";
import { LeaseDetailScreen } from "./LeaseDetailScreen";
import { LeasesScreen } from "./LeasesScreen";

const DEMO_TEXTS = ["Koffi Adjovi", "Les Tilleuls", "Cabinet Delmas", "Sophie Delmas", "Apt A1"];

const ended = summary({
  id: LEASE_ENDED_ID,
  reference: "BAIL-2024-009",
  phase: "ended",
  status: "terminated",
  starts_on: "2024-07-01",
  end_date: "2026-06-30",
  access: { until: "2027-06-30", in_grace: true },
});
const loire = summary({
  id: LEASE_LOIRE_ID,
  reference: "BAIL-2025-042",
  organization: ORG_LOIRE,
  main_unit: null,
  end_date: null,
  access: { until: null, in_grace: false },
});

function nth<T>(items: readonly T[], index: number): T {
  const item = items[index];
  if (item === undefined) throw new Error(`Élément ${String(index)} absent`);
  return item;
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("mes baux", () => {
  it("liste les baux de plusieurs organisations avec leur état", async () => {
    const api = stubApi({ "GET /api/v1/tenant/leases": { body: leasePage([summary(), loire, ended]) } });

    const { container } = renderApi(<LeasesScreen />);

    const list = await screen.findByRole("list", { name: "Mes baux" });
    const cards = within(list).getAllByRole("listitem");
    expect(cards).toHaveLength(3);
    expect(within(nth(cards, 0)).getByRole("heading", { name: "BAIL-2026-001" })).toBeTruthy();
    expect(within(nth(cards, 0)).getByText("Agence du Port")).toBeTruthy();
    expect(within(nth(cards, 0)).getByText("En cours")).toBeTruthy();
    expect(within(nth(cards, 0)).getByText("Appartement A12 · 12 quai du Port, 44000 Nantes")).toBeTruthy();
    expect(within(nth(cards, 0)).getByText("Du 01/01/2026 au 31/12/2028")).toBeTruthy();
    expect(within(nth(cards, 0)).getByRole("link", { name: "Voir le bail BAIL-2026-001" }).getAttribute("href")).toBe(`/bail/${LEASE_ID}`);
    expect(within(nth(cards, 1)).getByText("Immo Loire")).toBeTruthy();
    expect(within(nth(cards, 1)).getByText("Depuis le 01/01/2026, sans date de fin")).toBeTruthy();
    expect(within(nth(cards, 1)).getByText("Non disponible")).toBeTruthy();
    expect(api.calls.filter((call) => call.path === "/api/v1/tenant/leases")).toHaveLength(1);
    for (const text of DEMO_TEXTS) expect(document.body.textContent).not.toContain(text);
    await expectNoA11yViolations(container);
  });

  it("signale la période de grâce d’un bail terminé", async () => {
    stubApi({ "GET /api/v1/tenant/leases": { body: leasePage([ended]) } });

    renderApi(<LeasesScreen />);

    const card = within(await screen.findByRole("list", { name: "Mes baux" })).getByRole("listitem");
    expect(within(card).getByText("Terminé")).toBeTruthy();
    expect(within(card).getByText("Accès jusqu’au 30/06/2027")).toBeTruthy();
  });

  it("n’affiche pas de badge de grâce pour un bail en cours", async () => {
    stubApi({ "GET /api/v1/tenant/leases": { body: leasePage([summary()]) } });

    renderApi(<LeasesScreen />);

    await screen.findByRole("list", { name: "Mes baux" });
    expect(screen.queryByText(/Accès jusqu’au/)).toBeNull();
  });

  it("explique l’absence de baux sans inventer de données", async () => {
    stubApi({ "GET /api/v1/tenant/leases": { body: leasePage([]) } });

    renderApi(<LeasesScreen />);

    expect(await screen.findByText("Aucun bail à afficher")).toBeTruthy();
    expect(screen.queryByRole("list", { name: "Mes baux" })).toBeNull();
    expect(screen.getByRole("link", { name: "Voir mes accès" }).getAttribute("href")).toBe("/acces");
  });

  it("charge la page suivante avec le curseur du serveur", async () => {
    const api = stubApi({
      "GET /api/v1/tenant/leases": (call) => ({ body: call.query.cursor === "page-2" ? leasePage([loire]) : leasePage([summary()], "page-2") }),
    });

    const { user } = renderApi(<LeasesScreen />);
    await screen.findByText("BAIL-2026-001");
    await user.click(screen.getByRole("button", { name: "Afficher plus de baux" }));

    expect(await screen.findByText("BAIL-2025-042")).toBeTruthy();
    expect(screen.getByText("BAIL-2026-001")).toBeTruthy();
    expect(api.calls.filter((call) => call.path === "/api/v1/tenant/leases").map((call) => call.query.cursor)).toEqual([undefined, "page-2"]);
    expect(screen.queryByRole("button", { name: "Afficher plus de baux" })).toBeNull();
  });

  it("garde les baux chargés quand la page suivante échoue", async () => {
    stubApi({
      "GET /api/v1/tenant/leases": (call) =>
        call.query.cursor === "page-2" ? { status: 429, headers: { "Retry-After": "30" }, body: problem(429, "http_429", "Too Many Attempts.") } : { body: leasePage([summary()], "page-2") },
    });

    const { user } = renderApi(<LeasesScreen />);
    await screen.findByText("BAIL-2026-001");
    await user.click(screen.getByRole("button", { name: "Afficher plus de baux" }));

    expect(await screen.findByText("Les baux suivants n’ont pas pu être chargés")).toBeTruthy();
    expect(screen.getByText(/Patientez 30 s/)).toBeTruthy();
    expect(screen.getByText("BAIL-2026-001")).toBeTruthy();
  });

  it.each([
    [403, "space_forbidden", /pas ou plus d’accès à l’espace locataire/],
    [403, "email_unverified", /Confirmez votre adresse e-mail/],
    [429, "http_429", /Trop de demandes/],
  ])("explique une erreur %s %s", async (status, code, message) => {
    stubApi({ "GET /api/v1/tenant/leases": { status, body: problem(status, code, "Détail serveur.") } });

    renderApi(<LeasesScreen />);

    expect(await screen.findByText("Vos baux n’ont pas pu être chargés")).toBeTruthy();
    expect(screen.getByText(message)).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Réessayer" }) !== null).toBe(code === "http_429");
  });

  it("renvoie vers la connexion quand la session expire", async () => {
    stubApi({ "GET /api/v1/tenant/leases": { status: 401, body: problem(401, "unauthenticated", "Non authentifié.") } });

    renderApi(<LeasesScreen />);

    expect(await screen.findByRole("link", { name: "Se connecter" })).toBeTruthy();
  });

  it("relance la lecture après une panne", async () => {
    let attempts = 0;
    stubApi({
      "GET /api/v1/tenant/leases": () => {
        attempts += 1;
        return attempts === 1 ? { status: 503, body: problem(503, "service_unavailable", "Service indisponible.") } : { body: leasePage([summary()]) };
      },
    });

    const { user } = renderApi(<LeasesScreen />);
    await user.click(await screen.findByRole("button", { name: "Réessayer" }));

    expect(await screen.findByText("BAIL-2026-001")).toBeTruthy();
  });
});

describe("détail d’un bail", () => {
  it("lit le bail demandé et montre lot, conditions courantes et parties", async () => {
    const api = stubApi({ [`GET /api/v1/tenant/leases/${LEASE_ID}`]: { body: detail() } });

    const { container } = renderApi(<LeaseDetailScreen id={LEASE_ID} />);

    expect(await screen.findByRole("heading", { level: 1, name: "Bail BAIL-2026-001" })).toBeTruthy();
    expect(api.count("GET", `/api/v1/tenant/leases/${LEASE_ID}`)).toBe(1);
    expect(within(screen.getByRole("region", { name: "Loyer" })).getByText("650 €")).toBeTruthy();
    expect(within(screen.getByRole("region", { name: "Charges" })).getByText("80 €")).toBeTruthy();
    expect(within(screen.getByRole("region", { name: "Dépôt de garantie" })).getByText("Non disponible")).toBeTruthy();
    expect(within(screen.getByRole("region", { name: "Fin du bail" })).getByText("31/12/2028")).toBeTruthy();

    const conditions = screen.getByRole("region", { name: "Conditions du bail" });
    expect(within(conditions).getByText("Logement vide (loi du 6 juillet 1989)")).toBeTruthy();
    expect(within(conditions).getByText("36 mois")).toBeTruthy();
    expect(within(conditions).getByText("Paiement mensuel, exigible le 5, à échoir (payable d’avance)")).toBeTruthy();
    expect(within(conditions).getByText("Virement")).toBeTruthy();
    expect(within(conditions).getByText("15/12/2025")).toBeTruthy();
    expect(within(conditions).getByText("Prochaine révision").nextElementSibling?.textContent).toBe("Non disponible");

    const table = screen.getByRole("table", { name: "Conditions financières" });
    const rows = within(table).getAllByRole("row");
    expect(within(nth(rows, 1)).getByText("Loyer")).toBeTruthy();
    expect(within(nth(rows, 1)).getByText("650 €")).toBeTruthy();
    expect(within(nth(rows, 2)).getByText("Provision sur charges")).toBeTruthy();
    expect(within(nth(rows, 2)).getByText("80 €")).toBeTruthy();
    expect(screen.getByRole("region", { name: "Conditions financières au 16/11/2026" })).toBeTruthy();

    const parties = screen.getByRole("region", { name: "Parties au bail" });
    expect(within(parties).getByText("Awa Koné (vous)")).toBeTruthy();
    expect(within(parties).getByText("Moussa Diallo")).toBeTruthy();
    expect(within(parties).getByText(/Garant · depuis le 01\/01\/2026/)).toBeTruthy();
    expect(within(parties).getAllByText(/Locataire · solidaire/)).toHaveLength(2);

    const logement = screen.getByRole("region", { name: "Logement" });
    expect(within(logement).getByText("Appartement A12 (principal)")).toBeTruthy();
    expect(within(logement).getByText("2e étage")).toBeTruthy();
    expect(within(logement).getByText("42,5 m²")).toBeTruthy();
    expect(screen.queryByText(/Accès jusqu’au/)).toBeNull();
    expect(screen.queryByText(/Congé reçu/)).toBeNull();
    for (const text of DEMO_TEXTS) expect(document.body.textContent).not.toContain(text);
    await expectNoA11yViolations(container);
  });

  it("renvoie vers les loyers, quittances et paiements du bail", async () => {
    stubApi({ [`GET /api/v1/tenant/leases/${LEASE_ID}`]: { body: detail() } });

    renderApi(<LeaseDetailScreen id={LEASE_ID} />);

    expect((await screen.findByRole("link", { name: "Voir les loyers" })).getAttribute("href")).toBe(`/loyers?bail=${LEASE_ID}`);
    expect(screen.getByRole("link", { name: "Voir les quittances" }).getAttribute("href")).toBe(`/loyers/quittances?bail=${LEASE_ID}`);
    expect(screen.getByRole("link", { name: "Voir les paiements" }).getAttribute("href")).toBe(`/loyers/paiements?bail=${LEASE_ID}`);
  });

  it("affiche « Non disponible » pour chaque champ sans valeur", async () => {
    stubApi({
      [`GET /api/v1/tenant/leases/${LEASE_ID}`]: {
        body: detail({
          main_unit: null,
          end_date: null,
          payment_method: null,
          signed_on: null,
          terms: [],
          units: [{ unit: null, is_main: true, valid_from: "2026-01-01", end_date: null }],
        }),
      },
    });

    renderApi(<LeaseDetailScreen id={LEASE_ID} />);

    await screen.findByRole("heading", { level: 1 });
    for (const label of ["Loyer", "Charges", "Dépôt de garantie"]) {
      expect(within(screen.getByRole("region", { name: label })).getByText("Non disponible")).toBeTruthy();
    }
    expect(within(screen.getByRole("region", { name: "Fin du bail" })).getByText("Sans date de fin")).toBeTruthy();
    const conditions = screen.getByRole("region", { name: "Conditions du bail" });
    expect(within(conditions).getByText("Paiement").nextElementSibling?.textContent).toBe("Non disponible");
    expect(within(conditions).getByText("Signé le").nextElementSibling?.textContent).toBe("Non disponible");
    expect(within(conditions).getByText("Loyer indexé").nextElementSibling?.textContent).toBe("Non disponible");
    expect(screen.getByText("Aucune condition financière n’est en vigueur à cette date.")).toBeTruthy();
    const logement = screen.getByRole("region", { name: "Logement" });
    expect(within(logement).getByText("Lot").nextElementSibling?.textContent).toBe("Non disponible");
    expect(within(logement).getByText("Surface").nextElementSibling?.textContent).toBe("Non disponible");
  });

  it("annonce le préavis et la période de grâce", async () => {
    stubApi({
      [`GET /api/v1/tenant/leases/${LEASE_ENDED_ID}`]: {
        body: detail({
          id: LEASE_ENDED_ID,
          reference: "BAIL-2024-009",
          phase: "ended",
          status: "terminated",
          access: { until: "2027-06-30", in_grace: true },
          notice: { received_on: "2026-03-01", given_by: "landlord", departure_on: "2026-06-30" },
        }),
      },
    });

    renderApi(<LeaseDetailScreen id={LEASE_ENDED_ID} />);

    expect(await screen.findByText("Bail terminé : accès en lecture seule")).toBeTruthy();
    expect(screen.getByText("Vous gardez l’accès à ce bail jusqu’au 30/06/2027.")).toBeTruthy();
    expect(screen.getByText("Congé reçu le 01/03/2026")).toBeTruthy();
    expect(screen.getByText(/Donné par le bailleur\. Départ prévu le 30\/06\/2026\./)).toBeTruthy();
    expect(screen.getByText("Accès jusqu’au 30/06/2027")).toBeTruthy();
  });

  it("répond par un état introuvable quand le bail n’appartient pas au locataire", async () => {
    stubApi({ [`GET /api/v1/tenant/leases/${LEASE_ID}`]: { status: 404, body: problem(404, "lease_not_found", "Ce bail n’existe pas dans votre organisation.") } });

    renderApi(<LeaseDetailScreen id={LEASE_ID} />);

    expect(await screen.findByText("Bail introuvable")).toBeTruthy();
    expect(screen.getByRole("link", { name: "Retour à mes baux" }).getAttribute("href")).toBe("/bail");
  });

  it("signale une réponse inattendue plutôt que d’afficher des valeurs inventées", async () => {
    stubApi({ [`GET /api/v1/tenant/leases/${LEASE_ID}`]: { body: { data: { id: LEASE_ID } } } });

    renderApi(<LeaseDetailScreen id={LEASE_ID} />);

    expect(await screen.findByText("Ce bail n’a pas pu être chargé")).toBeTruthy();
    await waitFor(() => { expect(screen.getByText(/réponse inattendue|répondu de façon inattendue/i)).toBeTruthy(); });
    expect(screen.queryByRole("button", { name: "Réessayer" })).toBeTruthy();
  });
});
