'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { ORG_ROOT, useOrgQuery, useRoleMatrix } from '../orgapi/hooks';
import { canRead, canWrite } from '../orgapi/permissions';
import type { ContactFields, ContactInput, ContactPointChanges, ContactPointInput, ContactQuery, ImportRow, PropertyLinkInput } from './model';
import { useDirectorySource } from './source';

export const DIRECTORY_ROOT = ['gestion', 'directory'] as const;
const CHOICE_STALE_MS = 120_000;

export const directoryKeys = {
  contacts: (query: ContactQuery) => [...DIRECTORY_ROOT, 'contacts', query] as const,
  contact: (id: string) => [...DIRECTORY_ROOT, 'contact', id] as const,
  linksOf: (partyId: string, cursor: string | null) => [...DIRECTORY_ROOT, 'links-of', partyId, cursor] as const,
  ofProperty: (propertyId: string, unitId: string | null, cursor: string | null) => [...DIRECTORY_ROOT, 'of-property', propertyId, unitId, cursor] as const,
  categories: () => [...DIRECTORY_ROOT, 'categories'] as const,
  tags: () => [...DIRECTORY_ROOT, 'tags'] as const,
};

export function useDirectoryPermissions() {
  const matrix = useRoleMatrix();
  const known = matrix.data !== undefined;
  return {
    pending: matrix.isPending && !matrix.isError,
    read: !known || canRead(matrix.data, 'parties'),
    write: known && canWrite(matrix.data, 'parties'),
    anonymize: known && canWrite(matrix.data, 'parties_anonymize'),
    link: known && canWrite(matrix.data, 'properties'),
  };
}

export function useContacts(query: ContactQuery, enabled = true) {
  const source = useDirectorySource();
  return useOrgQuery(directoryKeys.contacts(query), () => source.contacts(query), { enabled });
}

export function useContact(id: string) {
  const source = useDirectorySource();
  return useOrgQuery(directoryKeys.contact(id), () => source.contact(id));
}

export function useContactLinks(partyId: string, cursor: string | null) {
  const source = useDirectorySource();
  return useOrgQuery(directoryKeys.linksOf(partyId, cursor), () => source.linksOfContact(partyId, cursor));
}

export function useContactsOfProperty(propertyId: string | null, unitId: string | null, cursor: string | null) {
  const source = useDirectorySource();
  return useOrgQuery(directoryKeys.ofProperty(propertyId ?? '', unitId, cursor), () => source.contactsOfProperty(propertyId ?? '', unitId, cursor), { enabled: propertyId !== null && propertyId !== '' });
}

export function useContactCategories() {
  const source = useDirectorySource();
  return useOrgQuery(directoryKeys.categories(), () => source.categories(), { staleTime: CHOICE_STALE_MS });
}

export function useContactTags() {
  const source = useDirectorySource();
  return useOrgQuery(directoryKeys.tags(), () => source.tags(), { staleTime: CHOICE_STALE_MS });
}

export function useReloadDirectory(): () => void {
  const client = useQueryClient();
  return () => { void client.invalidateQueries({ queryKey: DIRECTORY_ROOT }); };
}

function useDirectoryMutation<I, O>(run: (input: I) => Promise<O>) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: run,
    onSuccess: async () => {
      await Promise.all([
        client.invalidateQueries({ queryKey: DIRECTORY_ROOT }),
        client.invalidateQueries({ queryKey: [...ORG_ROOT, 'party-search'] }),
        client.invalidateQueries({ queryKey: [...ORG_ROOT, 'party'] }),
      ]);
    },
  });
}

export function useCreateContact() {
  const source = useDirectorySource();
  return useDirectoryMutation(({ input, allowDuplicate }: { input: ContactInput; allowDuplicate: boolean }) => source.createContact(input, allowDuplicate));
}

export function useUpdateContact() {
  const source = useDirectorySource();
  return useDirectoryMutation(({ id, lockVersion, fields }: { id: string; lockVersion: number; fields: ContactFields }) => source.updateContact(id, lockVersion, fields));
}

export function useArchiveContact() {
  const source = useDirectorySource();
  return useDirectoryMutation((id: string) => source.archiveContact(id));
}

export function useRestoreContact() {
  const source = useDirectorySource();
  return useDirectoryMutation((id: string) => source.restoreContact(id));
}

export function useAnonymizeContact() {
  const source = useDirectorySource();
  return useDirectoryMutation((id: string) => source.anonymizeContact(id));
}

export function useAddContactPoint() {
  const source = useDirectorySource();
  return useDirectoryMutation(({ id, input }: { id: string; input: ContactPointInput }) => source.addContactPoint(id, input));
}

export function useUpdateContactPoint() {
  const source = useDirectorySource();
  return useDirectoryMutation(({ id, pointId, changes }: { id: string; pointId: string; changes: ContactPointChanges }) => source.updateContactPoint(id, pointId, changes));
}

export function useImportContacts() {
  const source = useDirectorySource();
  return useDirectoryMutation(({ rows, clientId, allowDuplicates }: { rows: readonly ImportRow[]; clientId: string; allowDuplicates: boolean }) => source.importContacts(rows, clientId, allowDuplicates));
}

export function useAddPropertyLink() {
  const source = useDirectorySource();
  return useDirectoryMutation(({ propertyId, input }: { propertyId: string; input: PropertyLinkInput }) => source.addPropertyLink(propertyId, input));
}

export function useRemovePropertyLink() {
  const source = useDirectorySource();
  return useDirectoryMutation(({ propertyId, linkId }: { propertyId: string; linkId: string }) => source.removePropertyLink(propertyId, linkId));
}
