import type { AgencyRef, Money } from "../shared/model";

export interface MandateEndRequest {
  id: string;
  mandateId: string;
  status: string;
  reason: string | null;
  requestedAt: string;
  cancelledAt: string | null;
}

export interface MandateTerms {
  feeKind: string;
  feeBasisPoints: number | null;
  feeFlatAmount: Money | null;
  feeBase: string | null;
  feeMinimumAmount: Money | null;
  feeTaxMode: string;
  payoutDay: number;
  validFrom: string;
}

export interface MandateUnit {
  id: string;
  reference: string | null;
  propertyName: string | null;
  validFrom: string;
  endDate: string | null;
}

export interface OwnerMandate {
  id: string;
  reference: string;
  status: string;
  typeLabel: string;
  agency: AgencyRef;
  mandantName: string | null;
  startsOn: string;
  endDate: string | null;
  tacitRenewal: boolean;
  renewalMonths: number | null;
  noticeMonths: number | null;
  currency: string;
  signedOn: string | null;
  noticeGivenOn: string | null;
  endRequest: MandateEndRequest | null;
  terms: MandateTerms | null;
  units: MandateUnit[];
}

export const REASON_MAX = 1000;
