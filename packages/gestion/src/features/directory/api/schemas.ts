import { z } from 'zod';
import { CONTACT_KINDS, CONTACT_POINT_TYPES, DUPLICATE_REASONS } from '../model';
import { cursorMeta } from '../../orgapi/schemas';

const id = z.guid();
const timestamp = z.iso.datetime({ offset: true });
const kind = z.enum(CONTACT_KINDS);
const nullableText = z.string().nullable();

export const apiContactSummary = z.object({
  id,
  kind,
  display_name: z.string(),
  primary_email: nullableText,
  primary_phone: nullableText,
  is_anonymized: z.boolean(),
  archived_at: timestamp.nullable(),
});

const apiTerm = z.object({ id, key: z.string(), label: z.string(), semantic_key: nullableText });
const apiTag = z.object({ id, name: z.string(), slug: z.string(), color: nullableText });
const apiContactPoint = z.object({ id, type: z.enum(CONTACT_POINT_TYPES), value: z.string(), label: nullableText, is_primary: z.boolean() });
const apiIdentifier = z.object({ id, scheme: z.string(), country: z.string(), value: nullableText, last4: nullableText });
const apiAddress = z.object({ line1: z.string(), line2: nullableText.optional(), postal_code: z.string(), city: z.string(), country: z.string() });

const apiContactDetail = z.object({
  id,
  kind,
  display_name: z.string(),
  last_name: nullableText,
  first_name: nullableText,
  company_name: nullableText,
  address: apiAddress.nullable(),
  language: z.string(),
  note: nullableText,
  has_account: z.boolean(),
  lock_version: z.number().int().positive(),
  is_anonymized: z.boolean(),
  anonymized_at: timestamp.nullable(),
  archived_at: timestamp.nullable(),
  categories: z.array(apiTerm),
  tags: z.array(apiTag),
  contact_points: z.array(apiContactPoint),
  identifiers: z.array(apiIdentifier),
});

export const apiContactPage = z.object({ data: z.array(apiContactSummary), meta: cursorMeta });
export const apiContactResponse = z.object({ data: apiContactDetail });
export const apiContactPointResponse = z.object({ data: apiContactPoint });

export const apiImportResponse = z.object({ data: z.object({ id, count: z.number().int().nonnegative(), party_ids: z.array(id) }) });

const apiPropertyLink = z.object({
  id,
  property_id: id,
  property_name: nullableText,
  unit_id: id.nullable(),
  unit_reference: nullableText,
  party: z.object({ id, display_name: z.string(), kind, is_anonymized: z.boolean() }),
  category: apiTerm.nullable(),
  created_at: timestamp,
});

export const apiPropertyLinkPage = z.object({ data: z.array(apiPropertyLink), meta: z.object({ has_more: z.boolean(), next_cursor: z.string().nullable() }) });
export const apiPropertyLinkResponse = z.object({ data: apiPropertyLink });

export const apiCategoryList = z.object({
  data: z.array(z.object({ id, key: z.string(), labels: z.record(z.string(), z.string()), semantic_key: nullableText, archived: z.boolean(), hidden: z.boolean() })),
});

export const apiTagPage = z.object({ data: z.array(apiTag), meta: cursorMeta });

const duplicateCandidate = z.object({ id, display_name: z.string(), reasons: z.array(z.enum(DUPLICATE_REASONS)) });
export const duplicateCandidates = z.object({ candidates: z.array(duplicateCandidate) });

export const importInvalidRows = z.object({
  rows: z.array(z.object({ row: z.number().int().positive(), errors: z.record(z.string(), z.array(z.string())) })),
  rows_in_error: z.number().int().nonnegative(),
});

export const importDuplicateRows = z.object({
  rows: z.array(z.object({ row: z.number().int().positive(), candidates: z.array(duplicateCandidate), duplicate_of_rows: z.array(z.number().int().positive()) })),
  rows_in_error: z.number().int().nonnegative(),
});
