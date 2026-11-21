import type { ApiClient } from '@eguardimmo/api';
import { fetchAttachment, messageBody } from '../../api/transport';
import type {
  RestrictInput,
  StaffListQuery,
  StaffMarkInput,
  StaffMessagesQuery,
  StaffOpenInput,
  StaffPostInput,
  StaffUpdateInput,
} from '../model';

const segment = encodeURIComponent;

export interface StaffTransport {
  list: (query: StaffListQuery, cursor: string | null) => Promise<unknown>;
  show: (id: string) => Promise<unknown>;
  messages: (id: string, query: StaffMessagesQuery) => Promise<unknown>;
  unread: () => Promise<unknown>;
  open: (input: StaffOpenInput) => Promise<unknown>;
  post: (id: string, input: StaffPostInput) => Promise<unknown>;
  patch: (id: string, body: Record<string, unknown>) => Promise<unknown>;
  redact: (id: string, messageId: string, reason: string | null) => Promise<unknown>;
  restrict: (id: string, input: RestrictInput) => Promise<unknown>;
  lift: (id: string) => Promise<unknown>;
  recipients: () => Promise<unknown>;
  identity: () => Promise<unknown>;
  download: (attachmentId: string) => Promise<Blob>;
}

export function stateBody(input: StaffMarkInput | StaffUpdateInput): Record<string, unknown> {
  const body: Record<string, unknown> = {};
  if ('read' in input && input.read !== undefined) body.read = input.read;
  if ('archived' in input && input.archived !== undefined) body.archived = input.archived;
  if ('status' in input && input.status !== undefined) body.status = input.status;
  if ('assigneeId' in input && input.assigneeId !== undefined) body.assignee_id = input.assigneeId;
  return body;
}

export function createStaffTransport(client: ApiClient, organizationId: string, fetchImpl: typeof fetch): StaffTransport {
  const root = `/api/v1/org/${segment(organizationId)}/conversations`;
  const thread = (id: string) => `${root}/${segment(id)}`;
  return {
    list: (query, cursor) => client.get(root, { kind: query.kind, tab: query.tab, search: query.search.trim(), per_page: query.perPage, cursor }),
    show: (id) => client.get(thread(id)),
    messages: (id, query) => client.get(`${thread(id)}/messages`, { after: query.after, cursor: query.cursor }),
    unread: () => client.get(`${root}/unread`),
    open: (input) => {
      const links = input.kind === 'tenant' ? { lease_id: input.leaseId } : { mandate_id: input.mandateId };
      return client.post(root, messageBody({ kind: input.kind, party_id: input.partyId, ...links, subject: input.subject, body: input.body, client_id: input.clientId }, input.files));
    },
    post: (id, input) => client.post(`${thread(id)}/messages`, messageBody({ body: input.body, client_id: input.clientId }, input.files)),
    patch: (id, body) => client.patch(thread(id), body),
    redact: (id, messageId, reason) => client.post(`${thread(id)}/messages/${segment(messageId)}/redaction`, reason === null ? {} : { reason }),
    restrict: (id, input) => client.post(`${thread(id)}/mute`, { days: input.days, reason: input.reason }),
    lift: (id) => client.delete(`${thread(id)}/mute`),
    recipients: () => client.get(`${root}/recipients`),
    identity: () => client.get('/api/v1/me'),
    download: (attachmentId) => fetchAttachment(client, fetchImpl, `/api/v1/org/${segment(organizationId)}/conversation-attachments/${segment(attachmentId)}`),
  };
}
