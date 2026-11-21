import type { ApiClient } from '@eguardimmo/api';
import { z } from 'zod';
import { id, oneOf, pageOf, timestamp } from '../shared/schemas';
import { createTransport } from '../shared/transport';
import { CONTACT_UPDATE_STATUSES } from './model';
import type { ContactUpdate } from './model';
import type { ContactUpdatesSource } from './source';

export const apiContactUpdateSchema = z.object({
  id,
  party_id: id,
  status: z.enum(CONTACT_UPDATE_STATUSES),
  email: z.string().nullable(),
  phone: z.string().nullable(),
  requested_at: timestamp,
  decided_at: timestamp.nullable(),
});

const apiContactUpdatePage = pageOf(apiContactUpdateSchema);
const apiContactUpdateResponse = oneOf(apiContactUpdateSchema);

export const toContactUpdate = (row: z.infer<typeof apiContactUpdateSchema>): ContactUpdate => ({
  id: row.id,
  partyId: row.party_id,
  status: row.status,
  email: row.email,
  phone: row.phone,
  requestedAt: row.requested_at,
  decidedAt: row.decided_at,
});

const PAGE_SIZE = 25;
const segment = encodeURIComponent;

export interface ApiContactUpdatesOptions {
  client: ApiClient;
  organizationId: string | null;
  fetchImpl?: typeof fetch;
}

export function createApiContactUpdatesSource({ client, organizationId, fetchImpl }: ApiContactUpdatesOptions): ContactUpdatesSource {
  const transport = createTransport(client, organizationId, fetchImpl);
  const path = (partyId: string, updateId: string, action: string): string => `/parties/${segment(partyId)}/contact-updates/${segment(updateId)}/${action}`;
  return {
    list: async (partyId, cursor) => {
      const page = await transport.get(`/parties/${segment(partyId)}/contact-updates`, apiContactUpdatePage, { per_page: PAGE_SIZE, cursor });
      return { items: page.data.map(toContactUpdate), nextCursor: page.meta.next_cursor };
    },
    apply: async (partyId, updateId) => toContactUpdate((await transport.post(path(partyId, updateId, 'apply'), apiContactUpdateResponse)).data),
    dismiss: async (partyId, updateId) => toContactUpdate((await transport.post(path(partyId, updateId, 'dismiss'), apiContactUpdateResponse)).data),
  };
}
