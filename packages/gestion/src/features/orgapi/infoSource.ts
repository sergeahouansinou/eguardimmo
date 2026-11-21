import type { ApiClient } from '@eguardimmo/api';
import type { z } from 'zod';
import { createConfirmProof } from '../reauth/proof';
import { createErrorTranslator, invalidInput } from './errors';
import type { OrgKind, OrgRole } from './model';
import { apiLeasePage, apiMe, apiMembers, apiOrganization, apiPartyOne, apiPartySearchPage, apiPropertyPage, apiRoles, apiUnitPage } from './schemas';
import type { OrgInfoSource } from './source';
import { createOrgTransport } from './transport';
import { isValidTimeZone } from './zone';

export interface ApiOrgInfoOptions {
  client: ApiClient;
  organizationId: string | null;
  role: OrgRole | null;
  kind: OrgKind | null;
}

const CHOICE_PAGE_SIZE = 100;
const MAX_CHOICE_PAGES = 10;
const PARTY_SEARCH_SIZE = 20;
const translate = createErrorTranslator({ messages: {} });

export function createApiOrgInfoSource({ client, organizationId, role, kind }: ApiOrgInfoOptions, dependencies: { fetchImpl?: typeof fetch } = {}): OrgInfoSource {
  const transport = createOrgTransport(client, organizationId, translate, dependencies.fetchImpl);

  const collect = async <S extends z.ZodType<{ data: unknown[]; meta: { next_cursor: string | null } }>, T>(path: string, schema: S, query: Record<string, string | undefined>, convert: (page: z.infer<S>) => T[]): Promise<T[]> => {
    const found: T[] = [];
    let cursor: string | null = null;
    for (let page = 0; page < MAX_CHOICE_PAGES; page += 1) {
      const result: z.infer<S> = await transport.get(path, schema, { ...query, per_page: CHOICE_PAGE_SIZE, cursor });
      found.push(...convert(result));
      cursor = result.meta.next_cursor;
      if (cursor === null) break;
    }
    return found;
  };

  return {
    organizationId,
    role,
    kind,
    timezone: async () => (await transport.get('', apiOrganization)).data.timezone,
    updateTimezone: async (timezone) => {
      if (!isValidTimeZone(timezone)) throw invalidInput('Ce fuseau horaire est inconnu : choisissez un identifiant de la liste, par exemple Europe/Paris.');
      return (await transport.patch('', apiOrganization, { timezone })).data.timezone;
    },
    currentUser: async () => {
      const { data } = apiMe.parse(await client.get('/api/v1/me'));
      return { id: data.id, name: data.name };
    },
    members: async () => {
      const { data: members } = await transport.get('/members', apiMembers);
      const active = members.filter((member) => member.status === 'active');
      const choices = active.flatMap((member) => (member.user_id === null ? [] : [{ userId: member.user_id, name: `${member.first_name} ${member.last_name}`.trim(), self: member.self }]));
      return { choices, complete: choices.length === active.length };
    },
    roles: async () => {
      const { data } = await transport.get('/roles', apiRoles);
      return { currentRole: data.current_role, domains: data.domains.map((domain) => ({ key: domain.key, levels: domain.levels, twoFactor: domain.two_factor })) };
    },
    properties: () => collect('/properties', apiPropertyPage, {}, (page) => page.data.filter((property) => property.archived_at === null).map((property) => ({ id: property.id, name: property.name }))),
    units: (propertyId) => collect('/units', apiUnitPage, { property: propertyId }, (page) => page.data.map((unit) => ({ id: unit.id, reference: unit.reference }))),
    leases: () =>
      collect('/leases', apiLeasePage, {}, (page) =>
        page.data
          .filter((lease) => lease.archived_at === null)
          .map((lease) => ({ id: lease.id, reference: lease.reference, tenantNames: lease.tenants.map((tenant) => tenant.display_name), unitReference: lease.main_unit?.reference ?? null, propertyName: lease.main_unit?.property.name ?? null })),
      ),
    searchParties: async (search) => {
      const page = await transport.get('/parties', apiPartySearchPage, { q: search.trim() === '' ? undefined : search.trim(), per_page: PARTY_SEARCH_SIZE });
      return page.data.map((party) => ({ id: party.id, name: party.display_name, archived: party.archived_at !== null }));
    },
    party: async (id) => {
      const { data } = await transport.get(`/parties/${encodeURIComponent(id)}`, apiPartyOne);
      return { id: data.id, name: data.display_name, archived: data.archived_at !== null };
    },
    confirmTwoFactor: createConfirmProof(client),
  };
}
