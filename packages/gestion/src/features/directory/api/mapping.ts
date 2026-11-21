import type { z } from 'zod';
import type {
  CategoryChoice,
  ContactDetail,
  ContactPoint,
  ContactSummary,
  DuplicateCandidate,
  ImportResult,
  PropertyLink,
  TagChoice,
} from '../model';
import type { apiCategoryList, apiContactPage, apiContactPointResponse, apiContactResponse, apiImportResponse, apiPropertyLinkResponse, apiTagPage, duplicateCandidates } from './schemas';

type Summary = z.infer<typeof apiContactPage>['data'][number];
type Detail = z.infer<typeof apiContactResponse>['data'];
type Link = z.infer<typeof apiPropertyLinkResponse>['data'];
interface Term {
  id: string;
  key: string;
  label: string;
  semantic_key: string | null;
}

const toCategory = (term: Term): CategoryChoice => ({ id: term.id, key: term.key, label: term.label, semanticKey: term.semantic_key });
const toTag = (tag: z.infer<typeof apiTagPage>['data'][number]): TagChoice => ({ id: tag.id, name: tag.name, slug: tag.slug, color: tag.color });

export const toContactSummary = (row: Summary): ContactSummary => ({
  id: row.id,
  kind: row.kind,
  displayName: row.display_name,
  primaryEmail: row.primary_email,
  primaryPhone: row.primary_phone,
  anonymized: row.is_anonymized,
  archivedAt: row.archived_at,
});

export const toContactPoint = (point: z.infer<typeof apiContactPointResponse>['data']): ContactPoint => ({
  id: point.id,
  type: point.type,
  value: point.value,
  label: point.label,
  primary: point.is_primary,
});

export const toContactDetail = (row: Detail): ContactDetail => ({
  ...toContactSummary({ id: row.id, kind: row.kind, display_name: row.display_name, primary_email: null, primary_phone: null, is_anonymized: row.is_anonymized, archived_at: row.archived_at }),
  primaryEmail: row.contact_points.find((point) => point.type === 'email' && point.is_primary)?.value ?? null,
  primaryPhone: row.contact_points.find((point) => point.type === 'phone' && point.is_primary)?.value ?? null,
  lastName: row.last_name,
  firstName: row.first_name,
  companyName: row.company_name,
  address: row.address === null ? null : { line1: row.address.line1, line2: row.address.line2 ?? null, postalCode: row.address.postal_code, city: row.address.city, country: row.address.country },
  language: row.language,
  note: row.note,
  hasAccount: row.has_account,
  lockVersion: row.lock_version,
  anonymizedAt: row.anonymized_at,
  categories: row.categories.map(toCategory),
  tags: row.tags.map(toTag),
  contactPoints: row.contact_points.map(toContactPoint),
  identifiers: row.identifiers.map((identifier) => ({ id: identifier.id, scheme: identifier.scheme, country: identifier.country, value: identifier.value, last4: identifier.last4 })),
});

export const toPropertyLink = (row: Link): PropertyLink => ({
  id: row.id,
  propertyId: row.property_id,
  propertyName: row.property_name,
  unitId: row.unit_id,
  unitReference: row.unit_reference,
  party: { id: row.party.id, displayName: row.party.display_name, kind: row.party.kind, anonymized: row.party.is_anonymized },
  category: row.category === null ? null : toCategory(row.category),
  createdAt: row.created_at,
});

export const toCategories = (page: z.infer<typeof apiCategoryList>): CategoryChoice[] =>
  page.data
    .filter((term) => !term.archived && !term.hidden)
    .map((term) => ({ id: term.id, key: term.key, label: term.labels.fr ?? Object.values(term.labels)[0] ?? term.key, semanticKey: term.semantic_key }));

export const toTags = (rows: z.infer<typeof apiTagPage>['data']): TagChoice[] => rows.map(toTag);

export const toImportResult = (response: z.infer<typeof apiImportResponse>): ImportResult => ({ id: response.data.id, count: response.data.count, partyIds: response.data.party_ids });

export const toDuplicateCandidates = (payload: z.infer<typeof duplicateCandidates>['candidates']): DuplicateCandidate[] =>
  payload.map((candidate) => ({ id: candidate.id, displayName: candidate.display_name, reasons: candidate.reasons }));
