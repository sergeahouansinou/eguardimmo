import { screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { renderScreen } from "../../../test/render";
import { ChargesScreen } from "../loyers/ChargesScreen";

describe("régularisation des charges en démonstration", () => {
  it("garde le rendu de démonstration après le passage au modèle d’affichage commun", async () => {
    renderScreen(<ChargesScreen />);

    expect(await screen.findByRole("heading", { level: 1, name: "Régularisation des charges 2025" })).toBeTruthy();
    expect(screen.getByText("Remboursée")).toBeTruthy();
    expect(screen.getByText("Provisions de 80 € par mois comparées aux charges réelles de l'immeuble.")).toBeTruthy();
    expect(screen.getByText("Solde en votre faveur")).toBeTruthy();
    expect(screen.getByText("Remboursé le 12/03/2026")).toBeTruthy();
    expect(screen.getByText("Inchangée depuis 2023")).toBeTruthy();

    const table = within(screen.getByRole("table", { name: "Charges réelles de 2025" }));
    expect(table.getByRole("row", { name: /Chauffage collectif/ }).textContent).toContain("Tantièmes, 64,2 m²");
    expect(table.getByRole("row", { name: /Chauffage collectif/ }).textContent).toContain("402,50 €");
    expect(table.queryByRole("columnheader", { name: "Base du poste" })).toBeNull();
    expect(table.getByRole("row", { name: /Charges réelles 2025/ }).textContent).toContain("938,00 €");

    const calculation = within(screen.getByRole("region", { name: "Calcul du solde" }));
    expect(calculation.getByText("Solde remboursé").nextElementSibling?.textContent).toBe("22,00 €");
    expect(within(screen.getByRole("region", { name: "Remboursement" })).getByText("Virement •••• 4417")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Télécharger le décompte" })).toBeTruthy();
  });
});
