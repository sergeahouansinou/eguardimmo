import { describe, expect, it } from "vitest";
import { createDemoData } from "./demo";
import { parsePortefeuille } from "./source";
import {
  balanceMinor,
  bailSituation,
  buildSchedule,
  indexPortefeuille,
  mandantFigures,
  mandatState,
  nextPayoutIso,
  reversementsOf,
} from "./selectors";

const TODAY = "2026-11-13";
const index = indexPortefeuille(createDemoData());

function bailOf(id: string) {
  const bail = index.bail(id);
  if (!bail) throw new Error(`Bail ${id} absent des fixtures`);
  return bail;
}

describe("fixtures de démonstration", () => {
  it("respectent le schéma", () => {
    expect(() => parsePortefeuille(createDemoData())).not.toThrow();
  });

  it("référencent uniquement des entités existantes", () => {
    for (const bail of index.data.baux) {
      expect(index.bien(bail.bienId), bail.number).toBeDefined();
      expect(index.locataire(bail.locataireId), bail.number).toBeDefined();
    }
    for (const bien of index.data.biens) {
      expect(index.mandat(bien.mandatId), bien.name).toBeDefined();
      expect(index.mandantOfBien(bien), bien.name).toBeDefined();
    }
  });

  it("n'ont qu'un bail en cours par lot", () => {
    const current = index.data.baux.filter((bail) => bail.status === "en_cours").map((bail) => bail.bienId);
    expect(new Set(current).size).toBe(current.length);
  });
});

describe("mandatState", () => {
  const renewing = index.mandat("m-2023-0071");
  if (!renewing) throw new Error("fixture absente");

  it("reprend le statut stocké sans résiliation", () => {
    expect(mandatState(renewing, TODAY)).toBe("a_renouveler");
    expect(mandatState({ ...renewing, status: "termine" }, TODAY)).toBe("termine");
    expect(mandatState({ ...renewing, status: "brouillon" }, TODAY)).toBe("brouillon");
  });

  it("distingue la fin programmée de la fin effective", () => {
    const termination = { reason: "accord", noticeIso: TODAY, note: "" };
    expect(mandatState({ ...renewing, termination: { ...termination, effectIso: "2027-02-13" } }, TODAY)).toBe("resilie");
    expect(mandatState({ ...renewing, termination: { ...termination, effectIso: TODAY } }, TODAY)).toBe("termine");
  });
});

describe("situation des baux", () => {
  it("classe impayé, préavis et à jour", () => {
    expect(bailSituation(bailOf("b-2026-007"))).toBe("impaye");
    expect(bailSituation(bailOf("b-2024-003"))).toBe("preavis");
    expect(bailSituation(bailOf("b-2024-018"))).toBe("a_jour");
  });

  it("calcule le solde en centimes", () => {
    expect(balanceMinor(bailOf("b-2026-007"))).toBe(-45_000);
    expect(balanceMinor(bailOf("b-2024-018"))).toBe(0);
  });
});

describe("buildSchedule", () => {
  it("liste les échéances échues, la plus récente d'abord", () => {
    const schedule = buildSchedule(bailOf("b-2026-007"), TODAY);
    expect(schedule).toHaveLength(8);
    expect(schedule[0]?.id).toBe("2026-11");
    expect(schedule.at(-1)?.id).toBe("2026-04");
  });

  it("marque impayées les échéances depuis le début du retard", () => {
    const schedule = buildSchedule(bailOf("b-2026-007"), TODAY);
    expect(schedule.filter((echeance) => echeance.state === "impaye").map((echeance) => echeance.id)).toEqual(["2026-11"]);
    expect(schedule[0]?.collectedMinor).toBe(0);
    expect(schedule[1]?.collectedMinor).toBe(45_000);
  });

  it("n'appelle rien avant l'entrée dans les lieux", () => {
    expect(buildSchedule({ ...bailOf("b-2024-018"), startIso: "2027-01-01", endIso: "2029-12-31" }, TODAY)).toEqual([]);
  });
});

describe("agrégats par mandant", () => {
  it("calcule loyers, honoraires et reversement sans flottant", () => {
    expect(mandantFigures(index, "marc-chevalier")).toEqual({
      lots: 2,
      calledMinor: 115_000,
      collectedMinor: 70_000,
      feeMinor: 4_900,
      payoutMinor: 65_100,
    });
  });

  it("calcule le prochain reversement", () => {
    expect(nextPayoutIso("2026-11-13", 5)).toBe("2026-12-05");
    expect(nextPayoutIso("2026-11-03", 5)).toBe("2026-11-05");
  });

  it("ne reverse que des mois échus, du plus récent au plus ancien", () => {
    const lines = reversementsOf(index, "famille-bernard");
    expect(lines.length).toBeGreaterThan(0);
    expect(lines.some((line) => line.month === "2026-11")).toBe(false);
    expect(lines.map((line) => line.month)).toEqual([...lines.map((line) => line.month)].sort().reverse());
    for (const line of lines) expect(line.netMinor).toBe(line.collectedMinor - line.feeMinor);
  });
});
