export const CERTIFICATE_STATES = ['valid', 'to_renew', 'expired'] as const;
export type CertificateState = (typeof CERTIFICATE_STATES)[number];

export const SUBJECT_TYPES = ['organization', 'unit', 'party', 'equipment', 'lease'] as const;
export type SubjectType = (typeof SUBJECT_TYPES)[number];

export interface CertificateSubject {
  type: SubjectType;
  id: string;
}

export interface CertificateTypeRef {
  id: string;
  key: string;
  label: string;
  semanticKey: string | null;
}

export interface Certificate {
  id: string;
  subject: CertificateSubject;
  type: CertificateTypeRef;
  reference: string | null;
  issuerPartyId: string | null;
  issuedOn: string;
  expiresOn: string | null;
  state: CertificateState;
  values: Readonly<Record<string, unknown>>;
  storedFileId: string | null;
  replacesId: string | null;
  replacedById: string | null;
}

export const VALUE_KINDS = ['string', 'integer', 'number', 'boolean', 'date'] as const;
export type ValueKind = (typeof VALUE_KINDS)[number];

export interface ValueField {
  key: string;
  kind: ValueKind;
  required: boolean;
  options: readonly string[] | null;
  min: number | null;
  max: number | null;
}

export interface CertificateType extends CertificateTypeRef {
  defaultValidityMonths: number | null;
  reminderDays: number;
  fields: readonly ValueField[];
}

export interface Page<T> {
  items: T[];
  nextCursor: string | null;
}

export interface CertificateQuery {
  cursor?: string | null;
  perPage?: number;
  state?: CertificateState;
  typeId?: string;
  subject?: CertificateSubject;
  includeReplaced?: boolean;
  expiresFrom?: string;
  expiresTo?: string;
}

export type CertificateValues = Readonly<Record<string, string>>;

export interface NewCertificateInput {
  subject: CertificateSubject;
  typeId: string;
  reference: string;
  issuedOn: string;
  expiresOn: string;
  values: CertificateValues;
  file: File | null;
}

export interface RenewCertificateInput {
  reference: string;
  issuedOn: string;
  expiresOn: string;
  values: CertificateValues;
  file: File | null;
}

export interface DownloadedFile {
  blob: Blob;
  mimeType: string;
}

export interface ConformitePermissions {
  write: boolean;
}
