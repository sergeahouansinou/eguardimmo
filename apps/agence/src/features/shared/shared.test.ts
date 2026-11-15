import { describe, expect, it } from "vitest";
import { addDays, addMonths, daysBetween, formatDate, formatDateTime, formatPeriod, isIsoDate, monthsBetween } from "./dates";
import { validateFile } from "./files";
import { applyRate, formatMoney, formatRate, parseMoney, splitVat } from "./money";

const NBSP = " ";

describe("dates", () => {
  it("formate et calcule sans fuseau horaire", () => {
    expect(formatDate("2026-11-13")).toBe("13/11/2026");
    expect(formatDateTime("2026-11-13T10:02:00")).toBe("13/11/2026, 10:02");
    expect(formatPeriod("2026-11")).toBe("Novembre 2026");
    expect(daysBetween("2026-10-19", "2026-11-13")).toBe(25);
    expect(addDays("2026-11-13", 3)).toBe("2026-11-16");
    expect(addMonths("2026-01-31", 1)).toBe("2026-02-28");
    expect(monthsBetween("2026-11-13", "2028-06-30")).toBe(19);
    expect(isIsoDate("2026-02-30")).toBe(false);
    expect(isIsoDate("2026-11-13")).toBe(true);
  });
});

describe("money", () => {
  it("formate en unités mineures et refuse les flottants", () => {
    expect(formatMoney(110420)).toBe(`1${NBSP}104,20${NBSP}€`);
    expect(formatMoney(45000)).toBe(`450${NBSP}€`);
    expect(() => formatMoney(10.5)).toThrow(RangeError);
  });

  it("lit une saisie utilisateur en centimes", () => {
    expect(parseMoney("450,00")).toBe(45000);
    expect(parseMoney("1 450,5 €")).toBe(145050);
    expect(parseMoney("12.34")).toBe(1234);
    expect(parseMoney("12,345")).toBeNull();
    expect(parseMoney("-5")).toBeNull();
    expect(parseMoney("abc")).toBeNull();
  });

  it("calcule honoraires et TVA en entiers", () => {
    expect(applyRate(122000, 700)).toBe(8540);
    expect(splitVat(4900, 2000)).toEqual({ ht: 4083, vat: 817 });
    expect(splitVat(83580, 2000)).toEqual({ ht: 69650, vat: 13930 });
    expect(formatRate(700)).toBe(`7,00${NBSP}%`);
  });
});

describe("fichiers", () => {
  it("valide extension, type et taille", () => {
    const rules = { maxBytes: 100, extensions: ["pdf"], mimeTypes: ["application/pdf"] };
    expect(validateFile({ name: "a.pdf", size: 10, type: "application/pdf" }, rules)).toBeNull();
    expect(validateFile({ name: "a.exe", size: 10, type: "application/pdf" }, rules)).toContain("Format non accepté");
    expect(validateFile({ name: "a.pdf", size: 10, type: "text/html" }, rules)).toContain("Format non accepté");
    expect(validateFile({ name: "a.pdf", size: 101, type: "application/pdf" }, rules)).toContain("trop volumineux");
    expect(validateFile({ name: "a.pdf", size: 0, type: "application/pdf" }, rules)).toBe("Le fichier est vide.");
  });
});
