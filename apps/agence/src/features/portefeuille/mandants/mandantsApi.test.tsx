import { screen, within } from "@testing-library/react";
import type { ReactElement } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { resetNavigation } from "../../../../test/navigation";
import { createApiPortefeuilleSource } from "../api/apiPortefeuille";
import { createApiMandatesSource } from "../api/mandatesSource";
import { ID, ORG, mandantRow, mandateSummary, mockApi, orgPath, page } from "../api/testing";
import { renderPortefeuille } from "../testing";
import { MandantDetailPage } from "./MandantDetailPage";
import { MandantsPage } from "./MandantsPage";

vi.mock("next/navigation", async () => (await import("../../../../test/navigation")).navigationMock());

const NOW = new Date(2026, 10, 16, 10, 0, 0);
const DEMO_TEXTS = ["Sophie Delmas", "Cabinet Delmas", "Marc Chevalier", "Anaïs Roux", "Apt 12", "marc.chevalier@example.com"];

function renderApi(ui: ReactElement, canWrite = true) {
  const api = mockApi({
    [`GET ${orgPath("/mandates")}`]: (call) => ({ body: page(call.search.get("archived") === "1" ? [] : [mandateSummary()]) }),
    [`GET ${orgPath("/mandates/mandants")}`]: { body: { data: [mandantRow(), mandantRow({ party_id: ID.company, display_name: "SCI Horizon", mandate_count: 0, running_mandate_count: 0 })] } },
  });
  const source = createApiPortefeuilleSource({ mandates: createApiMandatesSource({ client: api.client, organizationId: ORG }), agencyName: "Agence Soleil", canWrite, now: () => NOW });
  return { ...api, ...renderPortefeuille(ui, source) };
}

beforeEach(() => {
  resetNavigation();
});

describe("mandants en mode api", () => {
  it("liste les mandants du serveur avec leurs lots sous mandat", async () => {
    renderApi(<MandantsPage />);

    const table = await screen.findByRole("table", { name: "Liste des mandants" });

    expect(within(table).getByText("Claire Vasseur")).toBeTruthy();
    expect(within(table).getByText("SCI Horizon")).toBeTruthy();
    expect(within(table).getByText("M-2026-0001")).toBeTruthy();
    for (const text of DEMO_TEXTS) expect(document.body.textContent).not.toContain(text);
  });

  it("n'invente aucun chiffre financier ni création de mandant", async () => {
    renderApi(<MandantsPage />);

    await screen.findByRole("table", { name: "Liste des mandants" });

    expect(screen.queryByRole("columnheader", { name: "Loyers appelés" })).toBeNull();
    expect(screen.queryByRole("columnheader", { name: "À reverser" })).toBeNull();
    expect(screen.queryByRole("link", { name: /Nouveau mandant/ })).toBeNull();
    expect(screen.queryByRole("button", { name: /Reversement en attente/ })).toBeNull();
    expect(screen.getByText("Non disponible")).toBeTruthy();
  });

  it("ouvre une fiche sans coordonnées ni reversement inventés", async () => {
    renderApi(<MandantDetailPage id={ID.mandant} />);

    expect(await screen.findByRole("heading", { level: 1, name: "Claire Vasseur" })).toBeTruthy();

    expect(screen.getAllByText(/Non disponible/).length).toBeGreaterThan(1);
    expect(screen.queryByRole("button", { name: "Modifier" })).toBeNull();
    expect(screen.queryByRole("link", { name: /Préparer le reversement/ })).toBeNull();
    expect(screen.getByRole("table", { name: "Biens sous mandat du mandant" })).toBeTruthy();
    expect(document.body.textContent).not.toContain("IBAN •");
    for (const text of DEMO_TEXTS) expect(document.body.textContent).not.toContain(text);
  });

  it("signale un mandant inconnu du serveur", async () => {
    renderApi(<MandantDetailPage id={ID.other} />);

    expect(await screen.findByRole("heading", { level: 1, name: "Mandant introuvable" })).toBeTruthy();
  });
});
