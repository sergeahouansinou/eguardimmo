import type { ApiClient } from '@eguardimmo/api';
import { parsePayload } from '../../../external/api/transport';
import type { SupportAccessSource } from '../source';
import { toGrant, toGrantPage } from './mapping';
import { grantListPayload, grantPayload } from './payloads';
import { createAccessTransport } from './transport';

export interface SupportAccessApiSourceOptions {
  client: ApiClient;
  organizationId: string;
}

export function createSupportAccessApiSource({ client, organizationId }: SupportAccessApiSourceOptions): SupportAccessSource {
  const transport = createAccessTransport(client, organizationId);
  return {
    list: async (status, cursor) => toGrantPage(parsePayload(grantListPayload, await transport.list(status, cursor))),
    accept: async (id, input) => toGrant(parsePayload(grantPayload, await transport.accept(id, input)).data),
    refuse: async (id) => toGrant(parsePayload(grantPayload, await transport.refuse(id)).data),
    revoke: async (id) => toGrant(parsePayload(grantPayload, await transport.revoke(id)).data),
  };
}
