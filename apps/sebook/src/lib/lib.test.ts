import { describe, expect, it } from "vitest";
import { addDays, formatStay, isIsoDay, nightsBetween, todayIso } from "./dates";
import { formatMinor, majorToMinor, minorDigits } from "./money";

describe("money", () => {
  it("formate en unité mineure, sans décimale quand le montant est rond", () => {
    expect(formatMinor(7400, "EUR")).toBe("74 €");
    expect(formatMinor(17720, "EUR")).toBe("177,20 €");
  });

  it("respecte les devises sans décimale (XOF)", () => {
    expect(minorDigits("XOF")).toBe(0);
    expect(formatMinor(45000, "XOF")).toContain("45");
    expect(majorToMinor(45000, "XOF")).toBe(45000);
    expect(majorToMinor(74, "EUR")).toBe(7400);
  });

  it("refuse un montant non entier", () => {
    expect(() => formatMinor(1.5, "EUR")).toThrow(RangeError);
  });
});

describe("dates", () => {
  it("valide les jours calendaires", () => {
    expect(isIsoDay("2027-02-28")).toBe(true);
    expect(isIsoDay("2027-02-30")).toBe(false);
    expect(isIsoDay("28/02/2027")).toBe(false);
  });

  it("calcule nuits, ajouts de jours et libellés", () => {
    expect(nightsBetween("2027-03-20", "2027-03-22")).toBe(2);
    expect(nightsBetween("2027-03-22", "2027-03-20")).toBe(0);
    expect(addDays("2027-12-31", 1)).toBe("2028-01-01");
    expect(formatStay("2027-03-20", "2027-03-22")).toBe("20 mars 2027 au 22 mars 2027");
  });

  it("todayIso suit la date locale de l’instant donné", () => {
    expect(todayIso(new Date(2027, 2, 20, 23, 30))).toBe("2027-03-20");
  });
});
