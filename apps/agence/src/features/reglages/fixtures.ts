import { AGENCY } from "@/features/shared/directory";
import {
  DEFAULT_FEE_BASIS_POINTS,
  DEFAULT_MIN_FEE_PER_LOT_MINOR,
  PAYOUT_DAY,
  VAT_BASIS_POINTS,
  WORKS_CEILING_MINOR,
} from "@/features/shared/agencyDefaults";
import type { Finances, Identity } from "./schemas";

export function initialIdentity(): Identity {
  return {
    companyName: AGENCY.name,
    legalForm: "SARL",
    siren: "912345675",
    capitalMinor: 2_000_000,
    address: "24 avenue de la République",
    postalCode: "75011",
    city: "Paris",
    phone: "+33 1 00 00 00 21",
    email: AGENCY.email,
    logoName: "logo-delmas.png",
    signatureName: "signature-delmas.png",
  };
}

export function initialFinances(): Finances {
  return {
    currency: "EUR",
    feeRateBp: DEFAULT_FEE_BASIS_POINTS,
    feeBasis: "rent_and_charges",
    feeTaxMode: "incl_tax",
    minFeeMinor: DEFAULT_MIN_FEE_PER_LOT_MINOR,
    payoutDay: PAYOUT_DAY,
    worksCeilingMinor: WORKS_CEILING_MINOR,
    vat: { regime: "normal", rateBp: VAT_BASIS_POINTS },
    account: {
      ibanMasked: `FR76 •••• •••• •••• •••• ${AGENCY.mandantsAccountLast4}`,
      last4: AGENCY.mandantsAccountLast4,
      bank: "Banque du Canal",
      holder: AGENCY.name,
      reconciledOn: "2026-11-12",
    },
  };
}
