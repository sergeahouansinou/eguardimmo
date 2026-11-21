import { screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { renderApi, stubApi } from "../../../test/api";
import { expectNoA11yViolations } from "../../../test/axe";
import { setLocation } from "../../../test/navigation";
import { UNIT_ID } from "../properties/fixtures";
import { problem } from "../responses.fixtures";
import { one, page } from "../shared/fixtures";
import { LEASE, LEASE_DETAIL, LEASE_ID, SECOND_LEASE } from "./fixtures";
import { LeaseScreen } from "./LeaseScreen";
import { LeasesScreen } from "./LeasesScreen";

vi.mock("next/navigation", async () => (await import("../../../test/navigation")).navigationMock);
vi.mock("next/link", async () => (await import("../../../test/navigation")).linkMock);

const LIST = "GET /api/v1/owner/leases";

beforeEach(() => {
  setLocation("/confie/baux");
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("liste des baux en mode api", () => {
  it("affiche le nom, la situation et la période sans coordonnées du locataire", async () => {
    stubApi({ [LIST]: { body: page([LEASE, SECOND_LEASE]) } });
    const { container } = renderApi(<LeasesScreen />);

    const table = await screen.findByRole("table", { name: "Baux de vos lots confiés" });
    expect(within(table).getByRole("link", { name: "BL-2026-0042" }).getAttribute("href")).toBe(`/confie/baux/${LEASE_ID}`);
    expect(within(table).getByRole("link", { name: "A1 · Résidence Les Filaos" }).getAttribute("href")).toBe(`/confie/biens/${UNIT_ID}`);
    expect(within(table).getByText("Awa Diallo")).toBeTruthy();
    expect(within(table).getByText("En cours")).toBeTruthy();
    expect(within(table).getByText("Terminé")).toBeTruthy();
    expect(within(table).getByText("Sans référence")).toBeTruthy();
    expect(within(table).getByText("Locataire anonymisé")).toBeTruthy();
    expect(within(table).getByText("Du 01/03/2025 au 28/02/2026")).toBeTruthy();
    expect(document.body.textContent).not.toMatch(/@|\+\d{2}/);
    await expectNoA11yViolations(container);
  });

  it("affiche un état vide", async () => {
    stubApi({ [LIST]: { body: page([]) } });
    renderApi(<LeasesScreen />);

    expect(await screen.findByText("Aucun bail")).toBeTruthy();
  });

  it("signale un accès refusé", async () => {
    stubApi({ [LIST]: problem(403, "space_forbidden") });
    renderApi(<LeasesScreen />);

    expect(await screen.findByText("Vos baux n’ont pas pu être chargés")).toBeTruthy();
    expect(screen.getByText("Votre compte n’a pas ou plus d’accès à un espace propriétaire.")).toBeTruthy();
  });
});

describe("détail d'un bail en mode api", () => {
  it("décrit le bail, le préavis, les locataires et les montants du serveur", async () => {
    stubApi({ [`GET /api/v1/owner/leases/${LEASE_ID}`]: { body: one(LEASE_DETAIL) } });
    const { container } = renderApi(<LeaseScreen id={LEASE_ID} />);

    expect(await screen.findByRole("heading", { level: 1, name: "Bail BL-2026-0042" })).toBeTruthy();
    const lease = screen.getByRole("region", { name: "Bail" });
    expect(within(lease).getByText("Mensuelle")).toBeTruthy();
    expect(within(lease).getByText("À échoir (payé d’avance)")).toBeTruthy();
    expect(within(lease).getByText("Le 5 du mois")).toBeTruthy();
    const notice = screen.getByRole("region", { name: "Préavis" });
    expect(within(notice).getByText("le locataire")).toBeTruthy();
    expect(within(notice).getByText("01/12/2026")).toBeTruthy();
    const terms = screen.getByRole("region", { name: "Loyer et charges au 19/11/2026" });
    expect(within(terms).getByText("650 €")).toBeTruthy();
    expect(within(terms).getByText("50 €")).toBeTruthy();
    expect(within(terms).getByText("10 %")).toBeTruthy();
    expect(within(screen.getByRole("region", { name: "Locataires" })).getByText("Awa Diallo")).toBeTruthy();
    await expectNoA11yViolations(container);
  });

  it("signale un bail introuvable", async () => {
    stubApi({ [`GET /api/v1/owner/leases/${LEASE_ID}`]: problem(404, "owner_lease_not_found") });
    renderApi(<LeaseScreen id={LEASE_ID} />);

    expect(await screen.findByText("Ce bail n’existe pas ou n’est plus accessible depuis votre espace.")).toBeTruthy();
    expect(screen.getByRole("link", { name: "Retour aux baux" }).getAttribute("href")).toBe("/confie/baux");
  });
});
