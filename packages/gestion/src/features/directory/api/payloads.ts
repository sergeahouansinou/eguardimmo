import { invalidInput } from '../../orgapi/errors';
import type { Body } from '@eguardimmo/api';
import type { ContactAddress, ContactFields, ContactInput, ContactPointChanges, ContactPointInput, PropertyLinkInput } from '../model';
import { MAX_CATEGORIES, MAX_CONTACT_POINTS, MAX_IMPORT_ROWS, MAX_NOTE_LENGTH, MAX_TAGS } from '../model';

const addressPayload = (address: ContactAddress | null) =>
  address === null ? null : { line1: address.line1, line2: address.line2, postal_code: address.postalCode, city: address.city, country: address.country };

const identityPayload = (fields: ContactFields) =>
  fields.kind === 'person'
    ? { last_name: fields.lastName, first_name: fields.firstName, company_name: null }
    : { last_name: null, first_name: null, company_name: fields.companyName };

const contactPointPayload = (point: ContactPointInput) => ({ type: point.type, value: point.value.trim(), label: point.label, primary: point.primary });

function assertFields(fields: ContactFields): void {
  if (fields.note !== null && fields.note.length > MAX_NOTE_LENGTH) throw invalidInput(`La note ne peut pas dépasser ${String(MAX_NOTE_LENGTH)} caractères.`);
  if (fields.categoryIds.length > MAX_CATEGORIES) throw invalidInput(`Un contact porte ${String(MAX_CATEGORIES)} catégories au plus.`);
  if (fields.tagIds.length > MAX_TAGS) throw invalidInput(`Un contact porte ${String(MAX_TAGS)} étiquettes au plus.`);
}

export function createPayload(input: ContactInput, allowDuplicate: boolean): Body {
  assertFields(input);
  if (input.contactPoints.length > MAX_CONTACT_POINTS) throw invalidInput(`Un contact porte ${String(MAX_CONTACT_POINTS)} coordonnées au plus à la création.`);
  const identity = identityPayload(input);
  return {
    kind: input.kind,
    ...(input.kind === 'person' ? { last_name: identity.last_name, first_name: identity.first_name } : { company_name: identity.company_name }),
    language: input.language,
    note: input.note,
    ...(input.address === null ? {} : { address: addressPayload(input.address) }),
    contact_category_ids: input.categoryIds,
    tag_ids: input.tagIds,
    contact_points: input.contactPoints.map(contactPointPayload),
    ...(allowDuplicate ? { allow_duplicate: true } : {}),
  };
}

export function updatePayload(lockVersion: number, fields: ContactFields): Body {
  assertFields(fields);
  if (!Number.isInteger(lockVersion) || lockVersion < 1) throw invalidInput('La version de la fiche est inconnue : rechargez-la.');
  return {
    lock_version: lockVersion,
    ...identityPayload(fields),
    address: addressPayload(fields.address),
    language: fields.language,
    note: fields.note,
    contact_category_ids: fields.categoryIds,
    tag_ids: fields.tagIds,
  };
}

export const newContactPointPayload = (input: ContactPointInput): Body => ({ type: input.type, value: input.value.trim(), label: input.label, is_primary: input.primary });

export function contactPointChangesPayload(changes: ContactPointChanges): Body {
  return {
    ...(changes.value === undefined ? {} : { value: changes.value.trim() }),
    ...(changes.label === undefined ? {} : { label: changes.label }),
    ...(changes.primary === true ? { is_primary: true } : {}),
  };
}

export const propertyLinkPayload = (input: PropertyLinkInput): Body => ({ party_id: input.partyId, unit_id: input.unitId, contact_category_id: input.categoryId });

export function importPayload(rows: readonly Record<string, unknown>[], clientId: string, allowDuplicates: boolean): Body {
  if (rows.length === 0) throw invalidInput('Aucune ligne à importer.');
  if (rows.length > MAX_IMPORT_ROWS) throw invalidInput(`Un import compte ${String(MAX_IMPORT_ROWS)} lignes au plus.`);
  return { client_id: clientId, allow_duplicates: allowDuplicates, rows: [...rows] };
}
