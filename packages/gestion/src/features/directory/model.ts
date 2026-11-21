import type { Page } from '../orgapi/model';

export const CONTACT_KINDS = ['person', 'company'] as const;
export type ContactKind = (typeof CONTACT_KINDS)[number];

export const CONTACT_POINT_TYPES = ['email', 'phone'] as const;
export type ContactPointType = (typeof CONTACT_POINT_TYPES)[number];

export const CONTACT_LANGUAGES = ['fr', 'en', 'nl', 'de'] as const;
export type ContactLanguage = (typeof CONTACT_LANGUAGES)[number];

export const CONTACT_STATUSES = ['active', 'archived', 'all'] as const;
export type ContactStatus = (typeof CONTACT_STATUSES)[number];

export const DUPLICATE_REASONS = ['email', 'phone', 'identifier', 'name'] as const;
export type DuplicateReason = (typeof DUPLICATE_REASONS)[number];

export const MAX_NOTE_LENGTH = 500;
export const MAX_CONTACT_POINTS = 10;
export const MAX_CATEGORIES = 20;
export const MAX_TAGS = 50;
export const MAX_IMPORT_ROWS = 500;

export interface ContactSummary {
  id: string;
  kind: ContactKind;
  displayName: string;
  primaryEmail: string | null;
  primaryPhone: string | null;
  anonymized: boolean;
  archivedAt: string | null;
}

export interface ContactPoint {
  id: string;
  type: ContactPointType;
  value: string;
  label: string | null;
  primary: boolean;
}

export interface ContactIdentifier {
  id: string;
  scheme: string;
  country: string;
  value: string | null;
  last4: string | null;
}

export interface ContactAddress {
  line1: string;
  line2: string | null;
  postalCode: string;
  city: string;
  country: string;
}

export interface CategoryChoice {
  id: string;
  key: string;
  label: string;
  semanticKey: string | null;
}

export interface TagChoice {
  id: string;
  name: string;
  slug: string;
  color: string | null;
}

export interface ContactDetail extends ContactSummary {
  lastName: string | null;
  firstName: string | null;
  companyName: string | null;
  address: ContactAddress | null;
  language: string;
  note: string | null;
  hasAccount: boolean;
  lockVersion: number;
  anonymizedAt: string | null;
  categories: CategoryChoice[];
  tags: TagChoice[];
  contactPoints: ContactPoint[];
  identifiers: ContactIdentifier[];
}

export interface ContactQuery {
  cursor: string | null;
  search: string;
  categoryId: string | null;
  kind: ContactKind | null;
  status: ContactStatus;
}

export interface ContactPointInput {
  type: ContactPointType;
  value: string;
  label: string | null;
  primary: boolean;
}

export interface ContactFields {
  kind: ContactKind;
  lastName: string | null;
  firstName: string | null;
  companyName: string | null;
  address: ContactAddress | null;
  language: ContactLanguage;
  note: string | null;
  categoryIds: string[];
  tagIds: string[];
}

export interface ContactInput extends ContactFields {
  contactPoints: ContactPointInput[];
}

export interface ContactPointChanges {
  value?: string;
  label?: string | null;
  primary?: true;
}

export interface DuplicateCandidate {
  id: string;
  displayName: string;
  reasons: DuplicateReason[];
}

export interface PropertyLinkParty {
  id: string;
  displayName: string;
  kind: ContactKind;
  anonymized: boolean;
}

export interface PropertyLink {
  id: string;
  propertyId: string;
  propertyName: string | null;
  unitId: string | null;
  unitReference: string | null;
  party: PropertyLinkParty;
  category: CategoryChoice | null;
  createdAt: string;
}

export interface PropertyLinkInput {
  partyId: string;
  unitId: string | null;
  categoryId: string | null;
}

export type ImportRow = Record<string, unknown>;

export interface ImportResult {
  id: string;
  count: number;
  partyIds: string[];
}

export interface ImportRowError {
  row: number;
  messages: string[];
}

export interface ImportRowDuplicate {
  row: number;
  candidates: DuplicateCandidate[];
  duplicateOfRows: number[];
}

export type ImportFailure =
  | { kind: 'invalid'; rows: ImportRowError[]; total: number }
  | { kind: 'duplicates'; rows: ImportRowDuplicate[]; total: number };

export type ContactPage = Page<ContactSummary>;
export type PropertyLinkPage = Page<PropertyLink>;
