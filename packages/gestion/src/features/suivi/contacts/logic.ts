import { ALL, bienShort, matchesBien } from '../shared/biens';
import { compareText } from '../shared/text';
import { categoryLabels } from './schemas';
import type { Contact } from './schemas';

export type SortKey = 'name' | 'category';

export const matchesBienFilter = (contact: Contact, filter: string): boolean =>
  contact.bienIds.length === 0 ? filter === ALL : contact.bienIds.some((id) => matchesBien(id, filter));

export function compareContacts(key: SortKey, a: Contact, b: Contact): number {
  return key === 'name' ? compareText(a.name, b.name) : compareText(categoryLabels[a.category], categoryLabels[b.category]);
}

export function biensLabel(contact: Contact): string {
  const [first] = contact.bienIds;
  if (first === undefined) return '—';
  return contact.bienIds.length === 1 ? bienShort(first) : `${String(contact.bienIds.length)} biens`;
}

export const initialsOf = (name: string): string =>
  name
    .split(/\s+/)
    .filter((word) => word !== '')
    .slice(0, 2)
    .map((word) => word.charAt(0))
    .join('');
