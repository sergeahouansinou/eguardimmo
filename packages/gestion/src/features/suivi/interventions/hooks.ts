'use client';

import { useContacts } from '../contacts/source';
import { compareText } from '../shared/text';

export function useIntervenantNames(extra: readonly (string | null)[] = []): string[] {
  const contacts = useContacts();
  const names = (contacts.data ?? []).filter((contact) => contact.category === 'artisan' && !contact.archived).map((contact) => contact.name);
  const retained = extra.filter((name): name is string => name !== null && name !== '');
  return [...new Set([...names, ...retained])].sort(compareText);
}
