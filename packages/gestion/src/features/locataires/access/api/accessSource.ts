import type { ApiClient } from '@eguardimmo/api';
import { tenantAccessPermissions } from '../model';
import type { TenantAccessRole } from '../model';
import type { TenantAccessSource } from '../source';
import { toTenantAccess, toTenantChoice } from './accessMapping';
import { apiNoContent, apiPartyPage, apiTenantAccessResponse } from './accessSchemas';
import { createTenantAccessTransport } from './accessTransport';

export interface ApiTenantAccessSourceOptions {
  client: ApiClient;
  organizationId: string | null;
  role: TenantAccessRole | null;
}

const SEARCH_SIZE = 20;
const path = (partyId: string): string => `/${encodeURIComponent(partyId)}/tenant-access`;

export function createApiTenantAccessSource({ client, organizationId, role }: ApiTenantAccessSourceOptions): TenantAccessSource {
  const transport = createTenantAccessTransport(client, organizationId);
  return {
    permissions: tenantAccessPermissions(role),
    search: async (term) => {
      const page = await transport.get('', apiPartyPage, { kind: 'person', q: term.trim(), per_page: SEARCH_SIZE });
      return page.data.filter((party) => !party.is_anonymized && party.archived_at === null).map(toTenantChoice);
    },
    access: async (partyId) => toTenantAccess((await transport.get(path(partyId), apiTenantAccessResponse)).data),
    invite: async (partyId, email) => toTenantAccess((await transport.post(path(partyId), apiTenantAccessResponse, email === null ? {} : { email })).data),
    revoke: async (partyId) => {
      await transport.delete(path(partyId), apiNoContent);
    },
  };
}
