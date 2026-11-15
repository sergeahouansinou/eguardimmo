import { describe, expect, it } from "vitest";
import { initialConformite } from "./fixtures";
import { alertDaysLabel, computeStats, pieceStatus, piecesToRenew, recommendedFilingStart, remainingLabel, renewalThreshold } from "./logic";

const data = initialConformite();
const byId = (id: string) => {
  const piece = data.pieces.find((candidate) => candidate.id === id);
  if (!piece) throw new Error(`Pièce absente : ${id}`);
  return piece;
};

describe("conformité : calculs", () => {
  it("calcule le reste en mois au-delà de 180 jours et en jours en dessous", () => {
    expect(data.pieces.map((piece) => remainingLabel(piece, "2026-11-13"))).toEqual(["19 mois", "13 mois", "48 jours", "79 jours", "48 jours"]);
  });

  it("calcule l’état depuis l’échéance, le seuil d’alerte et le caractère renouvelable", () => {
    const threshold = renewalThreshold(data.reminders);
    expect(threshold).toBe(90);
    expect(data.pieces.map((piece) => pieceStatus(piece, threshold, "2026-11-13").label)).toEqual([
      "Valide",
      "Valide",
      "À renouveler",
      "Conforme",
      "Validée",
    ]);
    expect(pieceStatus(byId("assurance-rcp"), threshold, "2027-01-02")).toMatchObject({ level: "expired", label: "Échue", tone: "danger" });
    expect(remainingLabel(byId("assurance-rcp"), "2027-01-02")).toBe("Échue depuis 2 jours");
  });

  it("calcule les statistiques", () => {
    const stats = computeStats(data.pieces, 90, "2026-11-13");
    expect(stats).toMatchObject({ total: 5, withoutFile: 0, valid: 4 });
    expect(stats.toRenew.map((piece) => piece.id)).toEqual(["assurance-rcp"]);
    expect(stats.next?.expiresOn).toBe("2026-12-31");
  });

  it("propose de renouveler l’assurance depuis la carte professionnelle", () => {
    const carte = byId("carte-professionnelle");
    expect(piecesToRenew(carte, data.pieces, 90, "2026-11-13").map((piece) => piece.id)).toEqual(["assurance-rcp"]);
  });

  it("place le dépôt conseillé trois mois avant, en fin de mois pour une échéance de fin de mois", () => {
    expect(recommendedFilingStart("2028-06-30")).toBe("2028-03-31");
    expect(recommendedFilingStart("2026-12-31")).toBe("2026-09-30");
    expect(recommendedFilingStart("2027-05-15")).toBe("2027-02-15");
  });

  it("formate les alertes", () => {
    expect(alertDaysLabel([7, 90, 30])).toBe("90, 30 et 7 jours avant l’échéance");
    expect(alertDaysLabel([30])).toBe("30 jours avant l’échéance");
  });
});
