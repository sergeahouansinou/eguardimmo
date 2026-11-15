import { describe, expect, it } from "vitest";
import { addMonths, daysBetween, formatDate, formatRemaining, monthLabel, plural, wholeMonthsBetween } from "./dates";
import { declaration2044, fiscalSummary } from "./fiscal";
import { createDemoData } from "./demo";
import { earliestEndDate, isValidIban, mandateEndSchema, quoteDecisionSchema } from "./inputs";
import { eur, eurFixed, eurSigned, feeOf, vatIncluded } from "./money";
import { reportTotals, settlementTotals, yearTotals } from "./derive";

describe("isValidIban", () => {
  it("accepte un IBAN valide avec ou sans espaces", () => {
    expect(isValidIban("FR76 3000 6000 0112 3456 7890 189")).toBe(true);
    expect(isValidIban("fr7630006000011234567890189")).toBe(true);
  });

  it("rejette une clé fausse ou un format incorrect", () => {
    expect(isValidIban("FR76 3000 6000 0112 3456 7890 188")).toBe(false);
    expect(isValidIban("123")).toBe(false);
  });
});

describe("quoteDecisionSchema", () => {
  it("accepte sans commentaire mais exige 5 caractères pour refuser", () => {
    expect(quoteDecisionSchema.safeParse({ interventionId: "a", decision: "accept", comment: "" }).success).toBe(true);
    expect(quoteDecisionSchema.safeParse({ interventionId: "a", decision: "refuse", comment: "non" }).success).toBe(false);
    expect(quoteDecisionSchema.safeParse({ interventionId: "a", decision: "refuse", comment: "trop cher" }).success).toBe(true);
  });
});

describe("mandateEndSchema", () => {
  it("applique la borne de préavis en intervalle fermé sur la date minimale", () => {
    const min = earliestEndDate("2026-11-13", 3);
    expect(min).toBe("2027-02-13");
    const schema = mandateEndSchema(min);
    const base = { kind: "early", reason: "vente", details: "" } as const;
    expect(schema.safeParse({ ...base, desiredOn: "2027-02-12" }).success).toBe(false);
    expect(schema.safeParse({ ...base, desiredOn: "2027-02-13" }).success).toBe(true);
  });
});

describe("dates et montants", () => {
  it("formate les dates et durées en français", () => {
    expect(formatDate("2026-11-05")).toBe("05/11/2026");
    expect(monthLabel("2026-10")).toMatch(/oct/i);
    expect(addMonths("2026-11-30", 3)).toBe("2027-02-28");
    expect(daysBetween("2026-11-01", "2026-11-13")).toBe(12);
    expect(wholeMonthsBetween("2026-11-13", "2027-12-31")).toBe(13);
    expect(formatRemaining("2026-11-13", "2027-12-31")).toBe("Dans 1 an et 1 mois");
    expect(plural(2, "bien")).toBe("2 biens");
    expect(plural(1, "bien")).toBe("1 bien");
  });

  it("calcule honoraires et TVA en unités mineures entières", () => {
    expect(feeOf(85000, 7)).toBe(5950);
    expect(feeOf(70000, 7)).toBe(4900);
    expect(vatIncluded(38000, 10)).toBe(3455);
    expect(eur(70000)).toBe("700\u00a0€");
    expect(eur(65150)).toBe("651,50\u00a0€");
    expect(eurFixed(70000)).toBe("700,00\u00a0€");
    expect(eurSigned(4900)).toBe("− 49,00\u00a0€");
    expect(() => eur(10.5)).toThrow(RangeError);
  });
});

describe("cohérence fiscale", () => {
  const data = createDemoData();

  it("le résultat de la 2044 égale recettes moins charges moins intérêts", () => {
    const declaration = declaration2044(data.fiscal);
    const summary = fiscalSummary(data.fiscal);
    expect(declaration.totals.revenue).toBe(summary.revenue);
    expect(declaration.totals.charges + declaration.totals.interest).toBe(summary.totalCharges);
    expect(declaration.totals.result).toBe(summary.result);
    expect(declaration.revenue[0]?.line).toBe("211");
  });

  it("les totaux annuels égalent la somme des reversements", () => {
    const totals = yearTotals(data.settlements);
    expect(totals.reversed).toBe(totals.collected - totals.fees - totals.works);
    expect(totals.reversedPaid + totals.pending).toBe(totals.reversed);
    const first = data.settlements[0];
    if (!first) throw new Error("fixture absente");
    expect(settlementTotals(first).reversed).toBe(settlementTotals(first).collected - settlementTotals(first).fees - first.works);
    const report = data.reports[0];
    if (!report) throw new Error("fixture absente");
    expect(reportTotals(report).reversed).toBe(reportTotals(report).collected - reportTotals(report).fees - reportTotals(report).works);
  });
});
