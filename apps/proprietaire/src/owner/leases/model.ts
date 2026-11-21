import type { Address, AgencyRef, Money } from "../shared/model";

export interface LeaseUnit {
  id: string;
  reference: string;
  typeKey: string;
  floor: number | null;
  surfaceHundredths: number | null;
  propertyName: string;
  address: Address;
}

export interface LeaseTenant {
  displayName: string;
  role: string;
  validFrom: string;
  endDate: string | null;
}

export interface OwnerLease {
  id: string;
  reference: string | null;
  status: string;
  phase: string;
  startsOn: string;
  endDate: string | null;
  agency: AgencyRef;
  mandantName: string | null;
  mainUnit: LeaseUnit | null;
  tenants: LeaseTenant[];
}

export interface LeaseTerm {
  componentLabel: string | null;
  amount: Money;
  vatBasisPoints: number;
  indexed: boolean;
  validFrom: string;
  endDate: string | null;
}

export interface LeaseNotice {
  receivedOn: string;
  givenBy: string | null;
  departureOn: string | null;
}

export interface LeaseUnitLink {
  unit: LeaseUnit | null;
  isMain: boolean;
  validFrom: string;
  endDate: string | null;
}

export interface OwnerLeaseDetail extends OwnerLease {
  durationMonths: number | null;
  tacitRenewal: boolean;
  periodicity: string;
  billingTiming: string;
  dueDay: number | null;
  currency: string;
  signedOn: string | null;
  notice: LeaseNotice | null;
  units: LeaseUnitLink[];
  termsOn: string;
  terms: LeaseTerm[];
}
