import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { expectNoA11yViolations } from "../../../../test/axe";
import { resetNavigation } from "../../../../test/navigation";
import { parsePortefeuille } from "../source";
import { failingSource, renderPortefeuille } from "../testing";
import { LocataireDetailPage } from "./LocataireDetailPage";
import { LocatairesPage } from "./LocatairesPage";

vi.mock("next/navigation", async () => (await import("../../../../test/navigation")).navigationMock());

beforeEach(() => {
  resetNavigation();
});

describe("liste des locataires", () => {
  it("affiche les locataires en cours et alerte sur les retards", async () => {
    const { container } = renderPortefeuille(<LocatairesPage />);
    expect(await screen.findByRole("heading", { level: 1, name: "Locataires" })).toBeTruthy();
    const table = screen.getByRole("table", { name: "Liste des locataires" });
    expect(within(table).getByText("Anaïs Roux")).toBeTruthy();
    expect(within(table).queryByText("Pauline Lefort")).toBeNull();
    expect(screen.getByText(/3 locataires en retard de paiement, 1 260 € au total/)).toBeTruthy();
    await expectNoA11yViolations(container);
  });

  it("filtre les impayés d'après l'adresse (?situation=impaye)", async () => {
    resetNavigation("situation=impaye");
    renderPortefeuille(<LocatairesPage />);
    const table = await screen.findByRole("table", { name: "Liste des locataires" });
    expect(within(table).getByText("Anaïs Roux")).toBeTruthy();
    expect(within(table).queryByText("Thomas Girard")).toBeNull();
  });

  it("liste les locataires archivés dans leur onglet", async () => {
    const user = userEvent.setup();
    renderPortefeuille(<LocatairesPage />);
    await user.click(await screen.findByRole("tab", { name: /Archivés/ }));
    const table = screen.getByRole("table", { name: "Liste des locataires" });
    expect(within(table).getByText("Pauline Lefort")).toBeTruthy();
    expect(within(table).queryByText("Anaïs Roux")).toBeNull();
  });

  it("signale l'absence de résultat", async () => {
    const user = userEvent.setup();
    renderPortefeuille(<LocatairesPage />);
    await user.type(await screen.findByRole("searchbox", { name: "Rechercher un locataire" }), "zzzz");
    expect(screen.getByText(/Aucun locataire/)).toBeTruthy();
  });

  it("signale l'erreur de chargement", async () => {
    renderPortefeuille(<LocatairesPage />, failingSource());
    expect(await screen.findByText(/n'a pas pu être chargé/)).toBeTruthy();
  });
});

describe("fiche locataire", () => {
  it("présente le solde, le loyer et la ponctualité", async () => {
    const { container } = renderPortefeuille(<LocataireDetailPage id="anais-roux" />);
    expect(await screen.findByRole("heading", { level: 1, name: /Anaïs Roux/ })).toBeTruthy();
    expect(screen.getByText("−450,00 €")).toBeTruthy();
    expect(screen.getByText("450 € par mois")).toBeTruthy();
    expect(screen.getByText("88 %")).toBeTruthy();
    expect(screen.getByRole("link", { name: "Enregistrer un paiement" })).toBeTruthy();
    await expectNoA11yViolations(container);
  });

  it("n'offre pas de relance à un locataire à jour", async () => {
    renderPortefeuille(<LocataireDetailPage id="thomas-girard" />);
    await screen.findByRole("heading", { level: 1, name: /Thomas Girard/ });
    expect(screen.queryByRole("link", { name: "Relancer" })).toBeNull();
  });

  it("affiche les onglets Paiements et Messages", async () => {
    const user = userEvent.setup();
    renderPortefeuille(<LocataireDetailPage id="anais-roux" />);
    await user.click(await screen.findByRole("tab", { name: /Paiements/ }));
    expect(within(screen.getByRole("tabpanel")).getByRole("table", { name: "Paiements du locataire" })).toBeTruthy();
    await user.click(screen.getByRole("tab", { name: /Messages/ }));
    expect(within(screen.getByRole("tabpanel")).getByText("Je règle le 15/11")).toBeTruthy();
  });

  it("signale un locataire introuvable", async () => {
    renderPortefeuille(<LocataireDetailPage id="inconnu" />);
    expect(await screen.findByRole("heading", { level: 1, name: "Locataire introuvable" })).toBeTruthy();
  });

  it("modifie l'e-mail et refuse une saisie invalide", async () => {
    const user = userEvent.setup();
    const { source } = renderPortefeuille(<LocataireDetailPage id="anais-roux" />);
    await user.click(await screen.findByRole("button", { name: "Modifier" }));
    const dialog = await screen.findByRole("dialog");
    const email = within(dialog).getByRole("textbox", { name: "E-mail" });
    await user.clear(email);
    await user.type(email, "pas-un-email");
    await user.click(within(dialog).getByRole("button", { name: "Enregistrer" }));
    expect(await within(dialog).findByText(/adresse e-mail valide/)).toBeTruthy();
    await user.clear(email);
    await user.type(email, "anais.nouvelle@example.com");
    await user.click(within(dialog).getByRole("button", { name: "Enregistrer" }));
    await waitFor(async () => {
      expect(parsePortefeuille(await source.load()).locataires.find((item) => item.id === "anais-roux")?.email).toBe("anais.nouvelle@example.com");
    });
    expect(await screen.findByText("anais.nouvelle@example.com")).toBeTruthy();
  });
});
