import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { expectNoA11yViolations } from "../../../../test/axe";
import { resetNavigation } from "../../../../test/navigation";
import { parsePortefeuille } from "../source";
import { failingSource, renderPortefeuille } from "../testing";
import { AccueilPage } from "./AccueilPage";

vi.mock("next/navigation", async () => (await import("../../../../test/navigation")).navigationMock());

beforeEach(() => {
  resetNavigation();
});

describe("accueil", () => {
  it("résume le mois avec des montants dérivés des fixtures", async () => {
    const { container } = renderPortefeuille(<AccueilPage />);
    expect(await screen.findByRole("heading", { level: 1, name: "Bonjour Sophie" })).toBeTruthy();
    expect(screen.getByText("Loyers encaissés, novembre")).toBeTruthy();
    expect(screen.getByText("11 940 €")).toBeTruthy();
    expect(screen.getByText("835,80 €")).toBeTruthy();
    expect(screen.getByText("1 260 €")).toBeTruthy();
    await expectNoA11yViolations(container);
  });

  it("liste les mandats à renouveler et en renouvelle un après confirmation", async () => {
    const user = userEvent.setup();
    const { source } = renderPortefeuille(<AccueilPage />);
    await user.click(await screen.findByRole("button", { name: "Renouveler le mandat M-2023-0071" }));
    const dialog = await screen.findByRole("dialog");
    await user.click(within(dialog).getByRole("button", { name: "Renouveler le mandat" }));
    await waitFor(async () => {
      expect(parsePortefeuille(await source.load()).mandats.find((item) => item.id === "m-2023-0071")?.endIso).toBe("2029-12-31");
    });
    await waitFor(() => { expect(screen.queryByRole("button", { name: "Renouveler le mandat M-2023-0071" })).toBeNull(); });
    expect(screen.getByRole("button", { name: "Renouveler le mandat M-2024-0033" })).toBeTruthy();
  });

  it("signale l'erreur de chargement", async () => {
    renderPortefeuille(<AccueilPage />, failingSource());
    expect(await screen.findByText(/n'a pas pu être chargé/)).toBeTruthy();
  });
});
