export const FIXTURE_ORG = '0198a0a0-0000-7000-8000-000000000001';
export const FIXTURE_PARTY = '0198a0a0-0000-7000-8000-0000000000c1';
export const FIXTURE_OTHER_PARTY = '0198a0a0-0000-7000-8000-0000000000c2';
export const FIXTURE_CATEGORY = '0198a0a0-0000-7000-8000-0000000000d1';
export const FIXTURE_TAG = '0198a0a0-0000-7000-8000-0000000000e1';
export const FIXTURE_POINT = '0198a0a0-0000-7000-8000-0000000000f1';
export const FIXTURE_LINK = '0198a0a0-0000-7000-8000-0000000000f2';
export const FIXTURE_PROPERTY = '0198a0a0-0000-7000-8000-0000000000b1';
export const FIXTURE_UNIT = '0198a0a0-0000-7000-8000-0000000000b2';
export const FIXTURE_IMPORT = '0198a0a0-0000-7000-8000-0000000000a9';

export const categoryFixture = (overrides: Record<string, unknown> = {}) => ({ id: FIXTURE_CATEGORY, key: 'craftsman', label: 'Artisan', semantic_key: 'craftsman', ...overrides });
export const tagFixture = (overrides: Record<string, unknown> = {}) => ({ id: FIXTURE_TAG, name: 'Plomberie', slug: 'plomberie', color: null, ...overrides });

export const summaryFixture = (overrides: Record<string, unknown> = {}) => ({
  id: FIXTURE_PARTY,
  kind: 'company',
  display_name: 'Plomberie Sanvi',
  primary_email: 'contact@plomberie-sanvi.fr',
  primary_phone: '+33612401877',
  is_anonymized: false,
  archived_at: null,
  ...overrides,
});

export const contactPointFixture = (overrides: Record<string, unknown> = {}) => ({ id: FIXTURE_POINT, type: 'email', value: 'contact@plomberie-sanvi.fr', label: 'Rodrigue Sanvi', is_primary: true, ...overrides });

export const detailFixture = (overrides: Record<string, unknown> = {}) => ({
  id: FIXTURE_PARTY,
  kind: 'company',
  display_name: 'Plomberie Sanvi',
  last_name: null,
  first_name: null,
  company_name: 'Plomberie Sanvi',
  legal_form_term_id: null,
  birth_date: null,
  address: null,
  language: 'fr',
  note: 'Intervient sous 48 h',
  has_account: false,
  custom_fields: {},
  lock_version: 3,
  is_anonymized: false,
  anonymized_at: null,
  archived_at: null,
  categories: [categoryFixture()],
  tags: [tagFixture()],
  contact_points: [contactPointFixture()],
  identifiers: [],
  bank_accounts: [],
  ...overrides,
});

export const personDetailFixture = (overrides: Record<string, unknown> = {}) =>
  detailFixture({
    kind: 'person',
    display_name: 'Rodrigue Sanvi',
    last_name: 'Sanvi',
    first_name: 'Rodrigue',
    company_name: null,
    address: { line1: '12 rue des Lilas', line2: null, postal_code: '75011', city: 'Paris', country: 'FR' },
    ...overrides,
  });

export const propertyLinkFixture = (overrides: Record<string, unknown> = {}) => ({
  id: FIXTURE_LINK,
  property_id: FIXTURE_PROPERTY,
  property_name: 'Résidence des Lilas',
  unit_id: null,
  unit_reference: null,
  party: { id: FIXTURE_PARTY, display_name: 'Plomberie Sanvi', kind: 'company', is_anonymized: false },
  category: categoryFixture(),
  created_at: '2026-11-20T09:00:00+00:00',
  ...overrides,
});

export const cursorPageFixture = <T>(data: T[], nextCursor: string | null = null) => ({ data, meta: { path: 'x', per_page: 25, next_cursor: nextCursor, prev_cursor: null } });
export const linkPageFixture = <T>(data: T[], nextCursor: string | null = null) => ({ data, meta: { has_more: nextCursor !== null, next_cursor: nextCursor } });

export const categoryTermFixture = (overrides: Record<string, unknown> = {}) => ({
  id: FIXTURE_CATEGORY,
  vocabulary: 'contact_category',
  key: 'craftsman',
  labels: { fr: 'Artisan', en: 'Craftsman' },
  semantic_key: 'craftsman',
  parent_id: null,
  position: 1,
  metadata: {},
  platform: true,
  system: false,
  archived: false,
  hidden: false,
  overridden: false,
  ...overrides,
});

export const duplicatesProblem = (candidates: unknown[] = [{ id: FIXTURE_OTHER_PARTY, display_name: 'Plomberie Sanvi SARL', reasons: ['email', 'name'] }]) => ({
  status: 409,
  body: { type: 'about:blank', title: 'Doublon possible', status: 409, code: 'party_possible_duplicate', detail: 'detail serveur', candidates },
});
