'use client';

import { createSourceContext, useScreenQuery } from '../../outils/kit';
import type { ScreenQuery } from '../../outils/kit';
import { createDemoContactsSource } from './demo';
import { contactListSchema } from './schemas';
import type { Contact, ContactInput } from './schemas';

export interface ContactsSource {
  list: () => Promise<unknown>;
  create: (draft: ContactInput) => Promise<unknown>;
  setShared: (id: string, shared: boolean) => Promise<unknown>;
  setArchived: (id: string, archived: boolean) => Promise<unknown>;
  remove: (id: string) => Promise<void>;
}

const context = createSourceContext(createDemoContactsSource);

export const ContactsSourceProvider = context.Provider;
export const useContactsSource = context.useSource;
export const resetContactsDemo = context.resetDefault;

export const CONTACTS_KEY = ['suivi', 'contacts'] as const;

export function useContacts(): ScreenQuery<Contact[]> {
  const source = useContactsSource();
  return useScreenQuery(CONTACTS_KEY, source.list, contactListSchema);
}
