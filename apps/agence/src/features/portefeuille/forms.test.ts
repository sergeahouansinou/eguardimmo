import { describe, expect, it } from "vitest";
import {
  bailEndIso,
  isValidIban,
  lotFormSchema,
  makeBailFormSchema,
  makeTerminationFormSchema,
  mandantFormSchema,
  mandatFormSchema,
  parseDecimal,
  toMinor,
} from "./forms";

const issuePaths = (result: { success: boolean; error?: { issues: { path: PropertyKey[] }[] } }) =>
  result.error?.issues.map((issue) => issue.path.join(".")) ?? [];

describe("IBAN et montants", () => {
  it("valide la clé de contrôle", () => {
    expect(isValidIban("FR76 3000 6000 0112 3456 7890 189")).toBe(true);
    expect(isValidIban("FR76 3000 6000 0112 3456 7890 188")).toBe(false);
    expect(isValidIban("FR76")).toBe(false);
  });

  it("lit les décimales françaises", () => {
    expect(parseDecimal("1 250,50")).toBe(1250.5);
    expect(parseDecimal("620")).toBe(620);
    expect(parseDecimal("abc")).toBeNull();
    expect(parseDecimal("-5")).toBeNull();
    expect(parseDecimal("")).toBeNull();
  });

  it("convertit en centimes entiers", () => {
    expect(toMinor("620")).toBe(62_000);
    expect(toMinor("620,5")).toBe(62_050);
    expect(toMinor("0,10")).toBe(10);
    expect(() => toMinor("x")).toThrow(RangeError);
  });
});

describe("makeBailFormSchema", () => {
  const schema = makeBailFormSchema({ occupiedUntil: { "apt-12": "2027-08-31" } });
  const valid = {
    bienId: "apt-8",
    locataireId: "chloe-martin",
    startIso: "2026-12-01",
    kind: "vide-3" as const,
    rent: "620",
    charges: "60",
    deposit: "620",
    dueDay: "5",
    paymentMode: "virement" as const,
    note: "",
  };

  it("accepte un bail complet", () => {
    expect(schema.safeParse(valid).success).toBe(true);
  });

  it("exige lot, locataire et montants", () => {
    const result = schema.safeParse({ ...valid, bienId: "", locataireId: "", rent: "", charges: "x", deposit: "" });
    expect(issuePaths(result)).toEqual(expect.arrayContaining(["bienId", "locataireId", "rent", "charges", "deposit"]));
  });

  it("refuse un lot occupé à la date de début", () => {
    const result = schema.safeParse({ ...valid, bienId: "apt-12", startIso: "2027-08-31" });
    expect(issuePaths(result)).toEqual(["startIso"]);
    expect(schema.safeParse({ ...valid, bienId: "apt-12", startIso: "2027-09-01" }).success).toBe(true);
  });

  it("plafonne le dépôt à 1 mois en location vide et 2 mois en meublé", () => {
    expect(issuePaths(schema.safeParse({ ...valid, deposit: "700" }))).toEqual(["deposit"]);
    expect(schema.safeParse({ ...valid, kind: "meuble-1", deposit: "1240" }).success).toBe(true);
    expect(issuePaths(schema.safeParse({ ...valid, kind: "meuble-1", deposit: "1300" }))).toEqual(["deposit"]);
  });

  it("refuse un jour d'échéance hors 1 à 28", () => {
    expect(issuePaths(schema.safeParse({ ...valid, dueDay: "31" }))).toEqual(["dueDay"]);
  });

  it("calcule la fin selon le type de bail", () => {
    expect(bailEndIso("2026-12-01", "vide-3")).toBe("2029-11-30");
    expect(bailEndIso("2026-12-01", "meuble-1")).toBe("2027-11-30");
    expect(bailEndIso("2026-12-01", "vide-6")).toBe("2032-11-30");
  });
});

describe("makeTerminationFormSchema", () => {
  const schema = makeTerminationFormSchema("2026-11-13");

  it("impose le préavis de 3 mois", () => {
    expect(issuePaths(schema.safeParse({ reason: "mandant", effectIso: "2027-01-01", note: "" }))).toEqual(["effectIso"]);
    expect(schema.safeParse({ reason: "mandant", effectIso: "2027-02-13", note: "" }).success).toBe(true);
  });

  it("dispense du préavis en cas d'accord amiable", () => {
    expect(schema.safeParse({ reason: "accord", effectIso: "2026-12-01", note: "" }).success).toBe(true);
  });

  it("limite les observations", () => {
    expect(issuePaths(schema.safeParse({ reason: "accord", effectIso: "2026-12-01", note: "x".repeat(501) }))).toEqual(["note"]);
  });
});

describe("mandantFormSchema", () => {
  const base = {
    type: "particulier" as const,
    firstName: "Claire",
    lastName: "Vasseur",
    companyName: "",
    profession: "",
    birthDate: "",
    email: "claire.vasseur@example.com",
    mobile: "06 12 34 56 78",
    address: "",
    postalCode: "",
    city: "",
    accountHolder: "Claire Vasseur",
    iban: "FR76 3000 6000 0112 3456 7890 189",
    inviteByEmail: false,
    reportsByEmail: true,
    idFileName: "",
  };

  it("accepte un particulier complet", () => {
    expect(mandantFormSchema.safeParse(base).success).toBe(true);
  });

  it("exige l'identité selon le type", () => {
    expect(issuePaths(mandantFormSchema.safeParse({ ...base, firstName: "", lastName: "" }))).toEqual(["firstName", "lastName"]);
    expect(issuePaths(mandantFormSchema.safeParse({ ...base, type: "societe" }))).toEqual(["companyName"]);
  });

  it("refuse IBAN, e-mail et mobile invalides", () => {
    const result = mandantFormSchema.safeParse({ ...base, iban: "FR76 0000", email: "claire", mobile: "123" });
    expect(issuePaths(result)).toEqual(expect.arrayContaining(["iban", "email", "mobile"]));
  });
});

describe("mandatFormSchema", () => {
  const lot = { name: "Apt 8", kind: "T3", surface: "40", street: "40 rue de Brest", postalCode: "69002", city: "Lyon" };
  const base = {
    mandantId: "marc-chevalier",
    lots: [lot],
    feePercent: "7,00",
    payoutDay: "5",
    worksLimit: "500",
    startIso: "2026-12-01",
    endIso: "2029-11-30",
    renewal: "aucune" as const,
    signedFileName: "",
  };

  it("accepte un mandat complet", () => {
    expect(mandatFormSchema.safeParse(base).success).toBe(true);
  });

  it("exige au moins un lot et des lots valides", () => {
    expect(issuePaths(mandatFormSchema.safeParse({ ...base, lots: [] }))).toEqual(["lots"]);
    expect(lotFormSchema.safeParse({ ...lot, postalCode: "690" }).success).toBe(false);
  });

  it("borne les honoraires entre 0 et 20 %", () => {
    expect(issuePaths(mandatFormSchema.safeParse({ ...base, feePercent: "25" }))).toEqual(["feePercent"]);
    expect(issuePaths(mandatFormSchema.safeParse({ ...base, feePercent: "0" }))).toEqual(["feePercent"]);
  });

  it("exige une échéance postérieure à la prise d'effet", () => {
    expect(issuePaths(mandatFormSchema.safeParse({ ...base, endIso: "2026-12-01" }))).toEqual(["endIso"]);
  });
});
