import { AGENCY_A, AGENCY_B, MANDANT_A, MANDANT_B, eur, xof } from "../shared/fixtures";
import { SECOND_UNIT_ID, UNIT_ID } from "../properties/fixtures";

function amounts(money: (amount: number) => { amount: number; currency: string }, values: readonly [number, number, number, number, number]) {
  const [called, collected, fees, works, net] = values;
  return { called: money(called), collected: money(collected), fees: money(fees), works: money(works), net: money(net) };
}

export const RENT_RESPONSE = {
  data: {
    month: "2026-11",
    mandants: [
      {
        agency: AGENCY_A,
        mandant: { name: MANDANT_A.name, role: "holder" },
        currency: "EUR",
        units: [
          { unit: { id: UNIT_ID, reference: "A1", property_name: "Résidence Les Filaos" }, amounts: amounts(eur, [70000, 70000, 5600, 0, 64400]), arrears: null },
          { unit: { id: "0193a5e1-0000-7000-8000-0000000000c9", reference: "B2", property_name: "Résidence Les Filaos" }, amounts: amounts(eur, [50000, 20000, 1600, 12000, 6400]), arrears: eur(30000) },
        ],
        others: amounts(eur, [0, 0, 0, 0, 0]),
        totals: amounts(eur, [120000, 90000, 7200, 12000, 70800]),
      },
      {
        agency: AGENCY_B,
        mandant: { name: MANDANT_B.name, role: "representative" },
        currency: "XOF",
        units: [{ unit: { id: SECOND_UNIT_ID, reference: "V1", property_name: "Villa Cotonou" }, amounts: amounts(xof, [250000, 250000, 20000, 0, 230000]), arrears: xof(0) }],
        others: amounts(xof, [0, 0, 0, 0, 0]),
        totals: amounts(xof, [250000, 250000, 20000, 0, 230000]),
      },
    ],
  },
};

export const PAYOUT_ID = "0193a5e1-0000-7000-8000-0000000000e1";

export const PAYOUTS_RESPONSE = {
  data: [
    { id: PAYOUT_ID, number: "RV-2026-0007", status: "paid", date: "2026-11-05", amount: eur(64400), bank_last4: "1234", agency: AGENCY_A, mandant: MANDANT_A },
    { id: "0193a5e1-0000-7000-8000-0000000000e2", number: "RV-2026-0008", status: "pending", date: null, amount: xof(230000), bank_last4: null, agency: AGENCY_B, mandant: MANDANT_B },
    { id: "0193a5e1-0000-7000-8000-0000000000e3", number: "RV-2026-0006", status: "returned", date: "2026-10-05", amount: eur(60000), bank_last4: "1234", agency: AGENCY_A, mandant: MANDANT_A },
  ],
  upcoming: [
    { agency: AGENCY_A, mandant: MANDANT_A, date: "2026-12-05", notice: null },
    {
      agency: AGENCY_B,
      mandant: MANDANT_B,
      date: null,
      notice: { code: "no_payout_account", message: "Aucun compte de versement n'est enregistré : renseignez-le pour recevoir vos reversements." },
    },
  ],
};
