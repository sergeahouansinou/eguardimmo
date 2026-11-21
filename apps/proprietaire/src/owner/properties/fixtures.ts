import { ADDRESS, AGENCY_A, AGENCY_B, MANDANT_A, MANDANT_B } from "../shared/fixtures";

export const UNIT_ID = "0193a5e1-0000-7000-8000-0000000000c1";
export const SECOND_UNIT_ID = "0193a5e1-0000-7000-8000-0000000000c2";

export const UNIT = {
  id: UNIT_ID,
  reference: "A1",
  type: "apartment",
  floor: 2,
  surface_hundredths: 6450,
  property: { name: "Résidence Les Filaos", address: ADDRESS },
  agency: AGENCY_A,
  mandant: MANDANT_A,
  covered_from: "2025-01-01",
  covered_until: null,
};

export const SECOND_UNIT = {
  ...UNIT,
  id: SECOND_UNIT_ID,
  reference: "PK3",
  type: "parking",
  floor: -1,
  surface_hundredths: null,
  agency: AGENCY_B,
  mandant: MANDANT_B,
  covered_from: "2024-06-01",
  covered_until: "2026-12-31",
};
