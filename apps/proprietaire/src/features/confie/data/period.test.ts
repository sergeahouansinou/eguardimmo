import { describe, expect, it } from "vitest";
import { MAX_PERIOD_DAYS, monthPeriod, parsePeriod, periodDays } from "./period";

describe("période d'un relevé", () => {
  it("compte les jours en incluant les deux bornes", () => {
    expect(periodDays({ from: "2026-11-01", to: "2026-11-01" })).toBe(1);
    expect(periodDays({ from: "2026-01-01", to: "2027-01-01" })).toBe(366);
    expect(periodDays({ from: "2026-11-01", to: "2026-11-30" })).toBe(30);
  });

  it("accepte une période valide jusqu'à 366 jours et refuse 367", () => {
    expect(MAX_PERIOD_DAYS).toBe(366);
    expect(parsePeriod("2026-11-01", "2026-11-01")).toEqual({ ok: true, period: { from: "2026-11-01", to: "2026-11-01" } });
    expect(parsePeriod("2026-01-01", "2027-01-01").ok).toBe(true);
    expect(parsePeriod("2026-01-01", "2027-01-02")).toEqual({ ok: false, message: "La période ne peut pas dépasser 366 jours." });
  });

  it.each([
    ["", "2026-11-30", "Indiquez la date de début, par exemple 01/11/2026."],
    ["2026-11-01", "", "Indiquez la date de fin, par exemple 30/11/2026."],
    ["2026-02-30", "2026-03-01", "Indiquez la date de début, par exemple 01/11/2026."],
    ["11/2026", "2026-11-30", "Indiquez la date de début, par exemple 01/11/2026."],
    ["2026-11-30", "2026-11-01", "La date de fin ne peut pas précéder celle de début."],
  ])("refuse %s → %s", (from, to, message) => {
    expect(parsePeriod(from, to)).toEqual({ ok: false, message });
  });

  it("propose le mois en cours, du premier au dernier jour", () => {
    expect(monthPeriod(new Date(2026, 10, 19))).toEqual({ from: "2026-11-01", to: "2026-11-30" });
    expect(monthPeriod(new Date(2028, 1, 10))).toEqual({ from: "2028-02-01", to: "2028-02-29" });
  });
});
