import type { ApiClient } from '@eguardimmo/api';
import type { z } from 'zod';
import type { OrgKind, OrgRole } from '../../orgapi/model';
import { createOrgTransport } from '../../orgapi/transport';
import type { DirectorySource } from '../source';
import { translateDirectoryError } from './errors';
import { toCategories, toContactDetail, toContactPoint, toContactSummary, toImportResult, toPropertyLink, toTags } from './mapping';
import { contactPointChangesPayload, createPayload, importPayload, newContactPointPayload, propertyLinkPayload, updatePayload } from './payloads';
import {
  apiCategoryList,
  apiContactPage,
  apiContactPointResponse,
  apiContactResponse,
  apiImportResponse,
  apiPropertyLinkPage,
  apiPropertyLinkResponse,
  apiTagPage,
} from './schemas';

export interface ApiDirectorySourceOptions {
  client: ApiClient;
  organizationId: string | null;
  role: OrgRole | null;
  kind: OrgKind | null;
}

const PAGE_SIZE = 25;
const CHOICE_PAGE_SIZE = 100;
const MAX_CHOICE_PAGES = 10;
const CATEGORY_VOCABULARY = 'contact_category';
const segment = (id: string): string => encodeURIComponent(id);
const party = (id: string): string => `/parties/${segment(id)}`;

export function createApiDirectorySource({ client, organizationId }: ApiDirectorySourceOptions, dependencies: { fetchImpl?: typeof fetch } = {}): DirectorySource {
  const transport = createOrgTransport(client, organizationId, translateDirectoryError, dependencies.fetchImpl);
  const detail = async (path: string) => toContactDetail((await transport.get(path, apiContactResponse)).data);
  const detailAfterPost = async (path: string) => toContactDetail((await transport.post(path, apiContactResponse)).data);

  const linkPage = async (path: string, query: Record<string, string | number | null | undefined>) => {
    const page = await transport.get(path, apiPropertyLinkPage, { per_page: PAGE_SIZE, ...query });
    return { items: page.data.map((row) => toPropertyLink(row)), nextCursor: page.meta.has_more ? page.meta.next_cursor : null };
  };

  const collectTags = async () => {
    const found = [];
    let cursor: string | null = null;
    for (let page = 0; page < MAX_CHOICE_PAGES; page += 1) {
      const result: z.infer<typeof apiTagPage> = await transport.get('/catalog/tags', apiTagPage, { per_page: CHOICE_PAGE_SIZE, cursor });
      found.push(...toTags(result.data));
      cursor = result.meta.next_cursor;
      if (cursor === null) break;
    }
    return found;
  };

  return {
    organizationId,
    contacts: async (query) => {
      const page = await transport.get('/parties', apiContactPage, {
        per_page: PAGE_SIZE,
        cursor: query.cursor,
        q: query.search.trim() === '' ? undefined : query.search.trim(),
        category: query.categoryId,
        kind: query.kind,
        status: query.status,
      });
      return { items: page.data.map(toContactSummary), nextCursor: page.meta.next_cursor };
    },
    contact: (id) => detail(party(id)),
    createContact: async (input, allowDuplicate) => toContactDetail((await transport.post('/parties', apiContactResponse, { body: createPayload(input, allowDuplicate) })).data),
    updateContact: async (id, lockVersion, fields) => toContactDetail((await transport.patch(party(id), apiContactResponse, updatePayload(lockVersion, fields))).data),
    archiveContact: (id) => detailAfterPost(`${party(id)}/archive`),
    restoreContact: async (id) => {
      await transport.remove(`${party(id)}/archive`);
      return detail(party(id));
    },
    anonymizeContact: (id) => detailAfterPost(`${party(id)}/anonymization`),
    addContactPoint: async (id, input) => toContactPoint((await transport.post(`${party(id)}/contact-points`, apiContactPointResponse, { body: newContactPointPayload(input) })).data),
    updateContactPoint: async (id, pointId, changes) =>
      toContactPoint((await transport.patch(`${party(id)}/contact-points/${segment(pointId)}`, apiContactPointResponse, contactPointChangesPayload(changes))).data),
    importContacts: async (rows, clientId, allowDuplicates) => toImportResult(await transport.post('/parties/import', apiImportResponse, { body: importPayload(rows, clientId, allowDuplicates) })),
    linksOfContact: (partyId, cursor) => linkPage('/property-contacts', { party: partyId, cursor }),
    contactsOfProperty: (propertyId, unitId, cursor) => linkPage(`/properties/${segment(propertyId)}/contacts`, { unit: unitId, cursor }),
    addPropertyLink: async (propertyId, input) => toPropertyLink((await transport.post(`/properties/${segment(propertyId)}/contacts`, apiPropertyLinkResponse, { body: propertyLinkPayload(input) })).data),
    removePropertyLink: (propertyId, linkId) => transport.remove(`/properties/${segment(propertyId)}/contacts/${segment(linkId)}`),
    categories: async () => toCategories(await transport.get(`/catalog/vocabularies/${CATEGORY_VOCABULARY}/terms`, apiCategoryList)),
    tags: collectTags,
  };
}
