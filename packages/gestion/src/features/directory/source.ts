'use client';

import { MissingSourceError, createSourceContext } from '../locataires/kit/sourceContext';
import type { Page } from '../orgapi/model';
import type {
  CategoryChoice,
  ContactDetail,
  ContactFields,
  ContactInput,
  ContactPoint,
  ContactPointChanges,
  ContactPointInput,
  ContactQuery,
  ContactSummary,
  ImportResult,
  ImportRow,
  PropertyLink,
  PropertyLinkInput,
  TagChoice,
} from './model';

export interface DirectorySource {
  readonly organizationId: string | null;
  contacts: (query: ContactQuery) => Promise<Page<ContactSummary>>;
  contact: (id: string) => Promise<ContactDetail>;
  createContact: (input: ContactInput, allowDuplicate: boolean) => Promise<ContactDetail>;
  updateContact: (id: string, lockVersion: number, fields: ContactFields) => Promise<ContactDetail>;
  archiveContact: (id: string) => Promise<ContactDetail>;
  restoreContact: (id: string) => Promise<ContactDetail>;
  anonymizeContact: (id: string) => Promise<ContactDetail>;
  addContactPoint: (id: string, input: ContactPointInput) => Promise<ContactPoint>;
  updateContactPoint: (id: string, pointId: string, changes: ContactPointChanges) => Promise<ContactPoint>;
  importContacts: (rows: readonly ImportRow[], clientId: string, allowDuplicates: boolean) => Promise<ImportResult>;
  linksOfContact: (partyId: string, cursor: string | null) => Promise<Page<PropertyLink>>;
  contactsOfProperty: (propertyId: string, unitId: string | null, cursor: string | null) => Promise<Page<PropertyLink>>;
  addPropertyLink: (propertyId: string, input: PropertyLinkInput) => Promise<PropertyLink>;
  removePropertyLink: (propertyId: string, linkId: string) => Promise<void>;
  categories: () => Promise<CategoryChoice[]>;
  tags: () => Promise<TagChoice[]>;
}

const context = createSourceContext<DirectorySource>('Contacts', () => {
  throw new MissingSourceError('Contacts');
});

export const DirectorySourceProvider = context.SourceProvider;
export const useDirectorySource = context.useSource;
