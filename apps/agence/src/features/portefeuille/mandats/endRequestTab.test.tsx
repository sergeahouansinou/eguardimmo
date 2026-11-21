import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { expectNoA11yViolations } from "../../../../test/axe";
import { resetNavigation } from "../../../../test/navigation";
import { createApiPortefeuilleSource } from "../api/apiPortefeuille";
import { createApiMandatesSource } from "../api/mandatesSource";
import { ID, ORG, mandantRow, mandateSummary, mockApi, orgPath, page } from "../api/testing";
import { renderPortefeuille } from "../testing";
import { MandatsPage } from "./MandatsPage";

vi.mock("next/navigation", async () => (await import("../../../../test/navigation")).navigationMock());

const NOW = new Date(2026, 10, 16, 10, 0, 0);

function renderList(summaries: Record<string, unknown>[]) {
  const api = mockApi({
    [`GET ${orgPath("/mandates")}`]: (call) => ({ body: page(call.search.get("archived") === "1" ? [] : summaries) }),
    [`GET ${orgPath("/mandates/mandants")}`]: { body: { data: [mandantRow()] } },
  });
  const mandates = createApiMandatesSource({ client: api.client, organizationId: ORG });
  const source = createApiPortefeuilleSource({ mandates, agencyName: "Agence Soleil", canWrite: true, now: () => NOW });
  return { ...api, ...renderPortefeuille(<MandatsPage />, source) };
}

const WITH_REQUEST = mandateSummary({ id: ID.other, reference: "M-2026-0002", has_end_request: true });

beforeEach(() => {
  resetNavigation();
});

describe("onglet des demandes de fin de mandat", () => {
  it("compte et liste les mandats qui portent une demande en attente", async () => {
    const user = userEvent.setup();
    const { container } = renderList([mandateSummary(), WITH_REQUEST]);

    const tab = await screen.findByRole("tab", { name: /Demandes de fin de mandat/ });
    expect(within(tab).getByText("1")).toBeTruthy();
    await user.click(tab);

    const table = screen.getByRole("table", { name: "Liste des mandats" });
    expect(within(table).getByText("M-2026-0002")).toBeTruthy();
    expect(within(table).queryByText("M-2026-0001")).toBeNull();
    expect(within(table).getByText("Fin demandée")).toBeTruthy();
    expect(within(table).getByRole("link", { name: "Ouvrir le mandat M-2026-0002" }).getAttribute("href")).toContain(ID.other);
    await expectNoA11yViolations(container);
  });

  it("signale la demande par un badge dans la liste courante, sans retirer le mandat", async () => {
    renderList([mandateSummary(), WITH_REQUEST]);

    const table = await screen.findByRole("table", { name: "Liste des mandats" });

    expect(within(table).getAllByText("Fin demandée")).toHaveLength(1);
    expect(within(table).getByText("M-2026-0001")).toBeTruthy();
    expect(within(table).getByText("M-2026-0002")).toBeTruthy();
  });

  it("affiche un compteur à zéro et une liste vide sans demande", async () => {
    const user = userEvent.setup();
    renderList([mandateSummary()]);

    const tab = await screen.findByRole("tab", { name: /Demandes de fin de mandat/ });
    expect(within(tab).getByText("0")).toBeTruthy();
    await user.click(tab);

    expect(await screen.findByText("Aucun mandat ne correspond")).toBeTruthy();
  });
});
