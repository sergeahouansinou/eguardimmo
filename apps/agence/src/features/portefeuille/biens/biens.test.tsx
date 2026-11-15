import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { expectNoA11yViolations } from "../../../../test/axe";
import { resetNavigation } from "../../../../test/navigation";
import { parsePortefeuille } from "../source";
import { failingSource, renderPortefeuille } from "../testing";
import { BienDetailPage } from "./BienDetailPage";
import { BiensPage } from "./BiensPage";

vi.mock("next/navigation", async () => (await import("../../../../test/navigation")).navigationMock());

beforeEach(() => {
  resetNavigation();
});

describe("liste des biens", () => {
  it("affiche les 14 lots sous mandat", async () => {
    const { container } = renderPortefeuille(<BiensPage />);
    expect(await screen.findByRole("heading", { level: 1, name: "Biens sous mandat" })).toBeTruthy();
    const table = screen.getByRole("table", { name: "Liste des biens sous mandat" });
    expect(within(table).getByText("Apt 12")).toBeTruthy();
    expect(within(table).getByText("Maison Les Pins")).toBeTruthy();
    await expectNoA11yViolations(container);
  });

  it("filtre les impayés", async () => {
    const user = userEvent.setup();
    renderPortefeuille(<BiensPage />);
    await user.click(await screen.findByRole("tab", { name: /Impayés/ }));
    const table = screen.getByRole("table", { name: "Liste des biens sous mandat" });
    expect(within(table).getByText("Studio 4")).toBeTruthy();
    expect(within(table).queryByText("Apt 12")).toBeNull();
  });

  it("recherche et signale l'absence de résultat", async () => {
    const user = userEvent.setup();
    renderPortefeuille(<BiensPage />);
    await user.type(await screen.findByRole("searchbox", { name: "Rechercher un lot" }), "zzzz");
    expect(screen.getByText(/Aucun/)).toBeTruthy();
  });

  it("signale l'erreur de chargement", async () => {
    renderPortefeuille(<BiensPage />, failingSource());
    expect(await screen.findByText(/n'a pas pu être chargé/)).toBeTruthy();
  });
});

describe("fiche bien", () => {
  it("présente le lot, son occupation et son mandant", async () => {
    const { container } = renderPortefeuille(<BienDetailPage id="studio-4" />);
    expect(await screen.findByRole("heading", { level: 1, name: /Studio 4/ })).toBeTruthy();
    expect(screen.getAllByText(/Anaïs Roux/).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Marc Chevalier/).length).toBeGreaterThan(0);
    await expectNoA11yViolations(container);
  });

  it("signale un bien introuvable", async () => {
    renderPortefeuille(<BienDetailPage id="inconnu" />);
    expect(await screen.findByRole("heading", { level: 1, name: "Bien introuvable" })).toBeTruthy();
  });

  it("modifie les caractéristiques dans les données", async () => {
    const user = userEvent.setup();
    const { source } = renderPortefeuille(<BienDetailPage id="apt-12" />);
    await user.click((await screen.findAllByRole("button", { name: "Modifier" }))[0] ?? document.body);
    const dialog = await screen.findByRole("dialog");
    const syndic = within(dialog).getByRole("textbox", { name: "Syndic" });
    await user.clear(syndic);
    await user.type(syndic, "Cabinet Neuf");
    await user.click(within(dialog).getByRole("button", { name: "Enregistrer" }));
    await waitFor(async () => {
      expect(parsePortefeuille(await source.load()).biens.find((item) => item.id === "apt-12")?.syndic).toBe("Cabinet Neuf");
    });
    expect((await screen.findAllByText(/Cabinet Neuf/)).length).toBeGreaterThan(0);
  });
});
