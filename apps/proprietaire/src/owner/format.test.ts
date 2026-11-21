import { describe, expect, it } from "vitest";
import {
  agencyAndMandant,
  formatBasisPoints,
  formatDateTime,
  formatFloor,
  formatMoney,
  formatMonth,
  formatQuantity,
  formatRatePcm,
  formatSurface,
  unitTypeLabel,
} from "./format";

describe("formats de l'espace propriétaire", () => {
  it("écrit les euros avec deux décimales seulement quand elles existent", () => {
    expect(formatMoney({ amount: 120000, currency: "EUR" })).toBe("1 200 €");
    expect(formatMoney({ amount: 120050, currency: "EUR" })).toBe("1 200,50 €");
    expect(formatMoney({ amount: -4500, currency: "EUR" })).toBe("-45 €");
  });

  it("écrit le franc CFA sans décimales", () => {
    expect(formatMoney({ amount: 230000, currency: "XOF" })).toBe("230 000 F CFA");
    expect(formatMoney({ amount: 0, currency: "XOF" })).toBe("0 F CFA");
  });

  it("formate dates, mois, surfaces, étages, taux et quantités", () => {
    expect(formatDateTime("2026-11-19T14:05:00+00:00")).toBe("19/11/2026 à 14 h 05");
    expect(formatMonth("2026-11")).toBe("Novembre 2026");
    expect(formatSurface(6450)).toBe("64,5 m²");
    expect(formatSurface(null)).toBe("Non renseigné");
    expect(formatFloor(0)).toBe("Rez-de-chaussée");
    expect(formatFloor(1)).toBe("1er étage");
    expect(formatFloor(-1)).toBe("Sous-sol 1");
    expect(formatBasisPoints(1000)).toBe("10 %".replace(" ", " "));
    expect(formatRatePcm(9975)).toBe("9,975 %");
    expect(formatQuantity(2500)).toBe("2,5");
  });

  it("nomme les types de lot connus et humanise les autres", () => {
    expect(unitTypeLabel("commercial_premises")).toBe("Local commercial");
    expect(unitTypeLabel("loft_atelier")).toBe("Loft atelier");
  });

  it("présente le mandant avec son agence, sans jamais les additionner", () => {
    expect(agencyAndMandant("Agence du Lac", "Famille Dossou")).toBe("Famille Dossou · Agence du Lac");
    expect(agencyAndMandant(null, null)).toBe("Non renseigné · Non renseigné");
  });
});
