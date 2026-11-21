import type { ApiClient } from '@eguardimmo/api';
import type { AcceptAccessInput, AccessStatus } from '../model';

const segment = encodeURIComponent;

export interface AccessTransport {
  list: (status: AccessStatus | null, cursor: string | null) => Promise<unknown>;
  accept: (id: string, input: AcceptAccessInput) => Promise<unknown>;
  refuse: (id: string) => Promise<unknown>;
  revoke: (id: string) => Promise<unknown>;
}

export function createAccessTransport(client: ApiClient, organizationId: string): AccessTransport {
  const root = `/api/v1/org/${segment(organizationId)}/support-access`;
  return {
    list: (status, cursor) => client.get(root, { status: status ?? undefined, cursor, per_page: 25 }),
    accept: (id, input) => client.post(`${root}/${segment(id)}/accept`, { duration_hours: input.durationHours, scopes: input.scopes }),
    refuse: (id) => client.post(`${root}/${segment(id)}/refuse`, {}),
    revoke: (id) => client.post(`${root}/${segment(id)}/revoke`, {}),
  };
}
