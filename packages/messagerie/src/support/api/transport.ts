import type { ApiClient } from '@eguardimmo/api';
import { fetchAttachment, messageBody } from '../../external/api/transport';
import type { SupportOpenInput, SupportPostInput, SupportRequestSpace } from '../model';

const segment = encodeURIComponent;
const ROOT = '/api/v1/support';

export interface SupportTransport {
  status: () => Promise<unknown>;
  list: () => Promise<unknown>;
  show: (id: string) => Promise<unknown>;
  messages: (id: string, query: { after: string }) => Promise<unknown>;
  open: (input: SupportOpenInput) => Promise<unknown>;
  post: (id: string, input: SupportPostInput) => Promise<unknown>;
  markRead: (id: string) => Promise<unknown>;
  download: (attachmentId: string) => Promise<Blob>;
}

export interface SupportTransportContext {
  space: SupportRequestSpace;
  organizationId: string | null;
}

export function createSupportTransport(client: ApiClient, { space, organizationId }: SupportTransportContext, fetchImpl: typeof fetch): SupportTransport {
  const ticket = (id: string) => `${ROOT}/tickets/${segment(id)}`;
  return {
    status: () => client.get(`${ROOT}/status`),
    list: () => client.get(`${ROOT}/tickets`),
    show: (id) => client.get(ticket(id)),
    messages: (id, query) => client.get(`${ticket(id)}/messages`, { after: query.after }),
    open: (input) =>
      client.post(
        `${ROOT}/tickets`,
        messageBody(
          {
            space,
            organization_id: space === 'organization' ? organizationId : undefined,
            category: input.category,
            subject: input.subject,
            body: input.body,
            client_id: input.clientId,
          },
          input.files,
        ),
      ),
    post: (id, input) => client.post(`${ticket(id)}/messages`, messageBody({ body: input.body, client_id: input.clientId }, input.files)),
    markRead: (id) => client.patch(ticket(id), { read: true }),
    download: (attachmentId) => fetchAttachment(client, fetchImpl, `${ROOT}/attachments/${segment(attachmentId)}`),
  };
}
