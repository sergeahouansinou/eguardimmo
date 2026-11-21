import type { ApiClient } from '@eguardimmo/api';
import { legalPermissions } from '../model';
import type { LegalRole } from '../model';
import type { LegalIdentitySource } from '../source';
import { LegalApiError } from './legalErrors';
import { toLegalIdentity, toLegalPayload } from './legalMapping';
import { apiLegalIdentityResponse, apiOrganizationResponse } from './legalSchemas';
import { createLegalTransport } from './legalTransport';

export interface ApiLegalIdentitySourceOptions {
  client: ApiClient;
  organizationId: string | null;
  role: LegalRole | null;
}

export function createApiLegalIdentitySource({ client, organizationId, role }: ApiLegalIdentitySourceOptions): LegalIdentitySource {
  const transport = createLegalTransport(client, organizationId);
  const identity = async () => {
    try {
      return toLegalIdentity((await transport.get('/legal-identity', apiLegalIdentityResponse)).data);
    } catch (error) {
      if (error instanceof LegalApiError && error.code === 'legal_identity_not_found') return null;
      throw error;
    }
  };

  return {
    permissions: legalPermissions(role),
    load: async () => {
      const [{ data: organization }, current] = await Promise.all([transport.get('', apiOrganizationResponse), identity()]);
      return { country: organization.country, currency: organization.currency, identity: current };
    },
    save: async (input) => toLegalIdentity((await transport.put('/legal-identity', apiLegalIdentityResponse, toLegalPayload(input))).data),
  };
}
