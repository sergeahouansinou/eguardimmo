import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { expectNoA11yViolations } from "../../../test/axe";
import { resetNavigation } from "../../../test/navigation";
import { renderScreen } from "../../../test/render";
import { createDemoSource } from "../source";
import { InterventionDetailPage } from "./InterventionDetailPage";
import { InterventionsPage } from "./InterventionsPage";

vi.mock("next/navigation", async () => (await import("../../../test/navigation")).navigationMock());

beforeEach(() => {
  resetNavigation();
});

function rowSubjects(): string[] {
  return screen.getAllByRole("rowheader").map((cell) => cell.textContent);
}

describe("liste des interventions", () => {
  it("affiche les statistiques, les onglets et met les urgences en tête", async () => {
    const { container } = renderScreen(<InterventionsPage />);
    expect(await screen.findByRole("rowheader", { name: "Fuite sous l'évier" })).toBeTruthy();
    expect(rowSubjects()).toEqual(["Fuite sous l'évier", "Chauffe-eau à remplacer", "Interphone du hall en panne"]);
    expect(screen.getByText("Interventions ouvertes")).toBeTruthy();
    expect(screen.getByText("1 urgente")).toBeTruthy();
    expect(screen.getByText("Plomberie, Studio 4 · 380 €")).toBeTruthy();
    expect(screen.getByText("Terminées en octobre")).toBeTruthy();
    expect(screen.getByText("délai moyen de 4 jours")).toBeTruthy();
    expect(screen.getByRole("tab", { name: /Ouvertes/ }).textContent).toContain("3");
    expect(screen.getByRole("tab", { name: /Terminées/ }).textContent).toContain("8");
    expect(screen.getByText("1 à 3 sur 3")).toBeTruthy();
    await expectNoA11yViolations(container);
  });

  it("ouvre une intervention et la création", async () => {
    renderScreen(<InterventionsPage />);
    expect(await screen.findByRole("link", { name: "Ouvrir l'intervention Fuite sous l'évier" })).toBeTruthy();
    expect(screen.getByRole("link", { name: "Ouvrir l'intervention Fuite sous l'évier" }).getAttribute("href")).toBe("/interventions/fuite-sous-l-evier");
    expect(screen.getByRole("link", { name: "Nouvelle intervention" }).getAttribute("href")).toBe("/interventions/nouvelle");
  });

  it("change d'onglet, recherche, filtre et affiche l'état vide", async () => {
    renderScreen(<InterventionsPage />);
    await screen.findByRole("rowheader", { name: "Fuite sous l'évier" });
    await userEvent.click(screen.getByRole("tab", { name: /Terminées/ }));
    expect(screen.getAllByRole("rowheader")).toHaveLength(8);
    await userEvent.click(screen.getByRole("tab", { name: "Archivées" }));
    expect(screen.getAllByRole("rowheader")).toHaveLength(2);
    await userEvent.click(screen.getByRole("tab", { name: /Ouvertes/ }));
    await userEvent.type(screen.getByRole("searchbox", { name: "Rechercher une intervention" }), "interphone");
    expect(rowSubjects()).toEqual(["Interphone du hall en panne"]);
    await userEvent.clear(screen.getByRole("searchbox", { name: "Rechercher une intervention" }));
    await userEvent.click(screen.getByRole("combobox", { name: /Priorité/ }));
    await userEvent.click(await screen.findByRole("option", { name: "Basse" }));
    expect(rowSubjects()).toEqual(["Interphone du hall en panne"]);
    await userEvent.click(screen.getByRole("combobox", { name: /Intervenant/ }));
    await userEvent.click(await screen.findByRole("option", { name: "Plomberie Sanvi" }));
    expect(screen.getByText("Aucune intervention")).toBeTruthy();
    expect(screen.getByText("Modifiez la recherche ou les filtres.")).toBeTruthy();
  });

  it("affiche le chargement puis l'erreur de la source", async () => {
    const source = createDemoSource();
    source.interventions.list = () => Promise.reject(new Error("panne"));
    renderScreen(<InterventionsPage />, source);
    expect(screen.getByRole("status", { name: /Chargement/ })).toBeTruthy();
    expect(await screen.findByText("Les interventions n'a pas pu être chargé")).toBeTruthy();
  });
});

describe("fiche d'intervention", () => {
  it("affiche chiffres, suivi, informations et actions de la fuite", async () => {
    const { container } = renderScreen(<InterventionDetailPage id="fuite-sous-l-evier" />);
    expect(await screen.findByRole("heading", { level: 1, name: "Fuite sous l'évier, Studio 4" })).toBeTruthy();
    expect(screen.getByText("Signalée par Anaïs Roux le 11/11/2026 · mandant Marc Chevalier")).toBeTruthy();
    expect(screen.getByText("dans 3 jours")).toBeTruthy();
    expect(screen.getByText("380 € TTC")).toBeTruthy();
    expect(screen.getByText("Plomberie Sanvi, le 13/11")).toBeTruthy();
    expect(screen.getByText("accord du mandant requis")).toBeTruthy();
    expect(screen.getByRole("link", { name: "Soumettre le devis" }).getAttribute("href")).toBe("/devis?devis=devis-plomberie-studio-4");
    expect(screen.getByRole("link", { name: "Écrire au locataire" }).getAttribute("href")).toBe("/messages/nouveau");
    expect(screen.getByRole("link", { name: "Appeler" }).getAttribute("href")).toBe("tel:0100000038");
    const timeline = screen.getByRole("list", { name: "Suivi de l'intervention" });
    const titles = within(timeline)
      .getAllByRole("listitem")
      .map((item) => item.querySelector("b")?.textContent);
    expect(titles).toEqual(["Devis reçu, 380 € TTC", "Plombier assigné", "Photo reçue du locataire", "Intervention ouverte", "Accord du mandant"]);
    expect(within(timeline).getByText("À venir")).toBeTruthy();
    await expectNoA11yViolations(container);
  });

  it("clôture l'intervention après confirmation", async () => {
    renderScreen(<InterventionDetailPage id="chauffe-eau-a-remplacer" />);
    await screen.findByRole("heading", { level: 1, name: "Chauffe-eau à remplacer, Apt 7" });
    await userEvent.click(screen.getByRole("button", { name: "Actions sur l'intervention" }));
    await userEvent.click(await screen.findByRole("menuitem", { name: "Clôturer l'intervention" }));
    expect(await screen.findByRole("dialog", { name: "Clôturer l'intervention ?" })).toBeTruthy();
    await userEvent.click(screen.getByRole("button", { name: "Clôturer" }));
    expect(await screen.findByText("État mis à jour")).toBeTruthy();
    expect(await screen.findByText("Terminée")).toBeTruthy();
    expect(screen.getByText("Intervention terminée")).toBeTruthy();
    expect(screen.getByText("intervention clôturée")).toBeTruthy();
  });

  it("démarre l'intervention sans confirmation et change la priorité", async () => {
    renderScreen(<InterventionDetailPage id="chauffe-eau-a-remplacer" />);
    await screen.findByRole("heading", { level: 1, name: "Chauffe-eau à remplacer, Apt 7" });
    await userEvent.click(screen.getByRole("button", { name: "Actions sur l'intervention" }));
    await userEvent.click(await screen.findByRole("menuitem", { name: "Démarrer l'intervention" }));
    expect(await screen.findByText("Intervention démarrée")).toBeTruthy();
    await userEvent.click(screen.getByRole("button", { name: "Actions sur l'intervention" }));
    await userEvent.click(await screen.findByRole("menuitem", { name: "Changer la priorité" }));
    await userEvent.click(await screen.findByRole("radio", { name: "Urgente" }));
    await userEvent.click(screen.getByRole("button", { name: "Enregistrer la priorité" }));
    expect(await screen.findByText("Priorité modifiée")).toBeTruthy();
    expect(await screen.findByText("Priorité modifiée : Urgente")).toBeTruthy();
  });

  it("refuse une transition interdite côté serveur", async () => {
    const source = createDemoSource();
    await expect(source.interventions.changeStatus({ id: "chauffe-eau-a-remplacer", status: "archivee" })).rejects.toMatchObject({ code: "transition" });
    await expect(source.interventions.changeStatus({ id: "inconnue", status: "terminee" })).rejects.toMatchObject({ code: "not_found" });
  });

  it("affiche l'état introuvable pour un identifiant inconnu", async () => {
    const { container } = renderScreen(<InterventionDetailPage id="inconnue" />);
    expect(await screen.findByRole("heading", { name: "Intervention introuvable" })).toBeTruthy();
    expect(screen.getByRole("link", { name: "Retour aux interventions" }).getAttribute("href")).toBe("/interventions");
    await expectNoA11yViolations(container);
  });
});
