export const VAT_REGIMES = ['normal', 'franchise'] as const;
export type VatRegime = (typeof VAT_REGIMES)[number];

export interface Money {
  amount: number;
  currency: string;
}

export interface LegalAddress {
  line1: string;
  line2: string | null;
  postalCode: string;
  city: string;
  country: string;
}

export interface LegalIdentity {
  legalName: string;
  address: LegalAddress;
  siren: string;
  siret: string | null;
  vatNumber: string | null;
  legalForm: string | null;
  shareCapital: Money | null;
  registryCity: string | null;
  professionalCardNumber: string | null;
  professionalCardIssuer: string | null;
  guaranteeProvider: string | null;
  guaranteeAmount: Money | null;
  vatRegime: VatRegime;
  vatOnDebits: boolean;
  paymentTermsDays: number | null;
}

export interface LegalIdentityInput {
  legalName: string;
  address: LegalAddress;
  siren: string;
  siret: string | null;
  vatNumber: string | null;
  legalForm: string | null;
  shareCapital: number | null;
  registryCity: string | null;
  professionalCardNumber: string | null;
  professionalCardIssuer: string | null;
  guaranteeProvider: string | null;
  guaranteeAmount: number | null;
  vatRegime: VatRegime;
  vatOnDebits: boolean;
  paymentTermsDays: number | null;
}

export interface LegalIdentityState {
  country: string;
  currency: string | null;
  identity: LegalIdentity | null;
}

export type LegalRole = 'owner' | 'admin' | 'manager' | 'accountant';

export interface LegalPermissions {
  edit: boolean;
}

export const legalPermissions = (role: LegalRole | null): LegalPermissions => ({ edit: role === 'owner' || role === 'admin' });
