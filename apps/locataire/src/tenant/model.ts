import type { LeasePhase } from './labels';

export interface Money {
  amount: number;
  currency: string;
}

export interface UnitView {
  reference: string;
  type: string;
  floor: number | null;
  surfaceHundredths: number | null;
  propertyName: string;
  address: string;
}

export interface LeaseSummary {
  id: string;
  reference: string;
  regimeKey: string;
  phase: LeasePhase;
  startsOn: string;
  endsOn: string | null;
  organization: { id: string; name: string | null };
  mainUnit: UnitView | null;
  accessUntil: string | null;
  inGrace: boolean;
}

export interface TermView {
  key: string | null;
  label: string | null;
  semanticKey: string | null;
  amount: Money;
  vatBasisPoints: number;
  indexed: boolean;
}

export interface PartyView {
  name: string;
  role: string;
  isMe: boolean;
  jointLiability: boolean;
  from: string;
  to: string | null;
}

export interface LeaseUnitView {
  unit: UnitView | null;
  isMain: boolean;
  from: string;
  to: string | null;
}

export interface LeaseDetail extends LeaseSummary {
  durationMonths: number;
  tacitRenewal: boolean;
  periodicity: string;
  billingTiming: string;
  dueDay: number;
  currency: string;
  paymentMethod: string | null;
  signedOn: string | null;
  notice: { receivedOn: string; givenBy: string | null; departureOn: string | null } | null;
  units: LeaseUnitView[];
  parties: PartyView[];
  termsOn: string;
  terms: TermView[];
}

export interface LeasePage {
  items: LeaseSummary[];
  nextCursor: string | null;
}

export interface TenantLink {
  partyId: string;
  organization: { id: string; name: string | null };
}
