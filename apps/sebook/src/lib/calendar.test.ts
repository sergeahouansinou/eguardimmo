import { describe, expect, it } from "vitest";
import {
  addDaysToParts,
  bookedNightKeys,
  buildMonthCells,
  isoOfParts,
  nextBlocked,
  nightsBetween,
  partsOfIso,
  selectDay,
  shiftMonth,
  shortDate,
} from "./calendar";

const TODAY = { y: 2027, m: 2, d: 10 };

describe("conversions de dates", () => {
  it("passe d’un jour ISO aux parties (mois indexé à 0) et inversement", () => {
    expect(partsOfIso("2027-03-05")).toEqual({ y: 2027, m: 2, d: 5 });
    expect(isoOfParts({ y: 2027, m: 2, d: 5 })).toBe("2027-03-05");
  });

  it("refuse une date inexistante ou mal formée", () => {
    expect(partsOfIso("2027-02-30")).toBeNull();
    expect(partsOfIso("5/3/2027")).toBeNull();
  });

  it("ajoute des jours en franchissant les mois et les années", () => {
    expect(addDaysToParts({ y: 2027, m: 11, d: 30 }, 2)).toEqual({ y: 2028, m: 0, d: 1 });
  });

  it("compte les nuits entre deux dates", () => {
    expect(nightsBetween({ y: 2027, m: 2, d: 30 }, { y: 2027, m: 3, d: 2 })).toBe(3);
    expect(nightsBetween(null, TODAY)).toBe(0);
  });

  it("formate une date courte selon la langue", () => {
    expect(shortDate({ y: 2027, m: 5, d: 20 }, ["janv.", "févr.", "mars", "avr.", "mai", "juin"], "fr")).toBe("20 juin");
    expect(shortDate({ y: 2027, m: 5, d: 20 }, undefined, "en")).toBe("Jun 20");
  });
});

describe("nuits occupées", () => {
  it("bloque les nuits d’arrivée incluse à départ exclu", () => {
    const keys = bookedNightKeys([{ checkIn: "2027-03-30", checkOut: "2027-04-02" }]);
    expect([...keys].sort()).toEqual([20270330, 20270331, 20270401]);
  });
});

describe("buildMonthCells", () => {
  const blocked = bookedNightKeys([{ checkIn: "2027-03-20", checkOut: "2027-03-22" }]);

  it("marque passé, occupé et au-delà de la fenêtre comme non sélectionnables", () => {
    const cells = buildMonthCells(2027, 2, null, null, TODAY, blocked, { y: 2027, m: 2, d: 25 });
    const at = (day: number) => cells.find((cell) => cell.day === day);
    expect(at(9)).toMatchObject({ past: true, disabled: true });
    expect(at(10)).toMatchObject({ past: false, disabled: false });
    expect(at(20)).toMatchObject({ booked: true, disabled: true });
    expect(at(22)).toMatchObject({ booked: false, disabled: false });
    expect(at(26)).toMatchObject({ beyond: true, disabled: true });
  });

  it("décale le premier jour (semaine commençant le lundi)", () => {
    const cells = buildMonthCells(2027, 2, null, null, TODAY);
    expect(cells.filter((cell) => cell.empty)).toHaveLength(0);
    expect(buildMonthCells(2027, 3, null, null, TODAY).filter((cell) => cell.empty)).toHaveLength(3);
  });

  it("repère arrivée, départ et jours intermédiaires", () => {
    const cells = buildMonthCells(2027, 2, { y: 2027, m: 2, d: 12 }, { y: 2027, m: 2, d: 15 }, TODAY);
    const flags = (day: number) => cells.find((cell) => cell.day === day);
    expect(flags(12)?.isStart).toBe(true);
    expect(flags(14)?.inRange).toBe(true);
    expect(flags(15)?.isEnd).toBe(true);
  });
});

describe("navigation entre mois", () => {
  it("ne recule pas avant le mois courant", () => {
    expect(shiftMonth(2027, 2, -1, TODAY)).toEqual({ y: 2027, m: 2 });
    expect(shiftMonth(2027, 0, 1, { y: 2026, m: 5, d: 1 })).toEqual({ y: 2027, m: 1 });
    expect(shiftMonth(2027, 11, 1, TODAY)).toEqual({ y: 2028, m: 0 });
  });

  it("bloque l’avance au-delà du dernier mois de la fenêtre", () => {
    const last = { y: 2028, m: 2, d: 9 };
    expect(nextBlocked(2028, 2, last)).toBe(true);
    expect(nextBlocked(2028, 1, last)).toBe(false);
  });
});

describe("selectDay", () => {
  const blocked = bookedNightKeys([{ checkIn: "2027-03-20", checkOut: "2027-03-22" }]);

  it("le premier clic fixe l’arrivée, le second le départ", () => {
    const first = selectDay(null, null, 2027, 2, 12);
    expect(first).toEqual({ checkIn: { y: 2027, m: 2, d: 12 }, checkOut: null });
    expect(selectDay(first.checkIn, first.checkOut, 2027, 2, 15)).toEqual({
      checkIn: { y: 2027, m: 2, d: 12 },
      checkOut: { y: 2027, m: 2, d: 15 },
    });
  });

  it("un clic avant l’arrivée ou sur une plage complète redémarre la sélection", () => {
    const ci = { y: 2027, m: 2, d: 12 };
    expect(selectDay(ci, null, 2027, 2, 11).checkIn).toEqual({ y: 2027, m: 2, d: 11 });
    expect(selectDay(ci, { y: 2027, m: 2, d: 15 }, 2027, 2, 18)).toEqual({ checkIn: { y: 2027, m: 2, d: 18 }, checkOut: null });
  });

  it("refuse un départ sous le séjour minimum", () => {
    const ci = { y: 2027, m: 2, d: 12 };
    expect(selectDay(ci, null, 2027, 2, 13, { minNights: 2 })).toEqual({ checkIn: ci, checkOut: null });
  });

  it("ignore une nuit occupée et repart du jour cliqué si le séjour traverse une nuit occupée", () => {
    const ci = { y: 2027, m: 2, d: 18 };
    expect(selectDay(ci, null, 2027, 2, 20, { blocked })).toEqual({ checkIn: ci, checkOut: null });
    expect(selectDay(ci, null, 2027, 2, 23, { blocked })).toEqual({ checkIn: { y: 2027, m: 2, d: 23 }, checkOut: null });
  });
});
