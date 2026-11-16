import type { TenantInput } from '../schemas';
import { ID_SCHEME_BY_DOC } from './apiMapping';
import type { ApiParty, IdentifierScheme } from './apiSchemas';

export const LANGUAGE = 'fr';

const nullIfEmpty = (value: string): string | null => (value === '' ? null : value);

function identity(values: TenantInput): Record<string, unknown> {
  return values.kind === 'societe'
    ? { company_name: values.companyName }
    : { last_name: values.lastName, first_name: values.firstName, birth_date: nullIfEmpty(values.birthDate) };
}

export function createPartyPayload(values: TenantInput): Record<string, unknown> {
  const fields = identity(values);
  if (values.kind === 'particulier' && fields.birth_date === null) delete fields.birth_date;
  return { kind: values.kind === 'societe' ? 'company' : 'person', ...fields, language: LANGUAGE };
}

export const updatePartyPayload = (current: ApiParty, values: TenantInput): Record<string, unknown> => ({ lock_version: current.lock_version, ...identity(values) });

export interface IdentifierPlan {
  scheme: IdentifierScheme;
  action: 'none' | 'add' | 'update';
  identifierId?: string;
}

export function planIdentifier(current: ApiParty | null, values: TenantInput): IdentifierPlan | null {
  if (values.idDocType === '') return null;
  const scheme = ID_SCHEME_BY_DOC[values.idDocType];
  const existing = current?.identifiers.find((identifier) => identifier.scheme === scheme);
  if (values.idNumber === '') return existing ? { scheme, action: 'none', identifierId: existing.id } : { scheme, action: 'none' };
  return existing ? { scheme, action: 'update', identifierId: existing.id } : { scheme, action: 'add' };
}
