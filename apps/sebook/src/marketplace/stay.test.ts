import { describe, expect, it } from "vitest";
import { checkStay, overlapsOccupied, reservationHref } from "./stay";

const base = { checkIn: "2027-03-20", checkOut: "2027-03-22", guests: 2, capacity: 4, minNights: 2, occupied: [], today: "2027-03-01" };

describe("checkStay", () => {
  it("accepte un séjour valide et compte les nuits", () => {
    expect(checkStay(base)).toEqual({ ok: true, nights: 2 });
  });

  it("reste muet tant que les dates sont incomplètes", () => {
    expect(checkStay({ ...base, checkOut: "" })).toEqual({ ok: false, problem: "incomplete", message: null });
  });

  it.each([
    [{ checkIn: "2027-02-20", checkOut: "2027-02-22" }, "past"],
    [{ checkOut: "2027-03-20" }, "order"],
    [{ checkOut: "2027-03-21" }, "minNights"],
    [{ guests: 5 }, "guests"],
    [{ guests: 0 }, "guests"],
    [{ occupied: [{ from: "2027-03-21", to: "2027-03-25" }] }, "occupied"],
  ])("refuse %j (%s)", (override, problem) => {
    const result = checkStay({ ...base, ...override });
    expect(result).toMatchObject({ ok: false, problem });
  });
});

describe("overlapsOccupied", () => {
  const occupied = [{ from: "2027-03-10", to: "2027-03-14" }];
  it("le départ exclusif permet d’arriver le jour du départ précédent", () => {
    expect(overlapsOccupied("2027-03-14", "2027-03-16", occupied)).toBe(false);
    expect(overlapsOccupied("2027-03-08", "2027-03-10", occupied)).toBe(false);
  });
  it("détecte un chevauchement partiel ou englobant", () => {
    expect(overlapsOccupied("2027-03-13", "2027-03-16", occupied)).toBe(true);
    expect(overlapsOccupied("2027-03-08", "2027-03-20", occupied)).toBe(true);
  });
});

describe("reservationHref", () => {
  it("transporte le séjour dans l’adresse", () => {
    expect(reservationHref("k3m7q9x2v8nb", { checkIn: "2027-03-20", checkOut: "2027-03-22", guests: 2 })).toBe(
      "/listings/k3m7q9x2v8nb/reserve?arrivee=2027-03-20&depart=2027-03-22&voyageurs=2",
    );
  });
});
