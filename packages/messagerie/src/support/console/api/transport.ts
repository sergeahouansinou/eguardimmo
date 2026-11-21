import type { ApiClient } from '@eguardimmo/api';
import { fetchAttachment, messageBody } from '../../../external/api/transport';
import type { ConsolePostInput, ConsoleTicketPatch, ConsoleTicketQuery, EmergencyAccessInput, RequestAccessInput } from '../model';

const segment = encodeURIComponent;
const ROOT = '/api/v1/console';

function assigneeParam(query: ConsoleTicketQuery, operatorId: string | undefined): string | undefined {
  if (query.assignee === 'all') return undefined;
  if (query.assignee === 'me') return operatorId;
  return query.assignee;
}

export interface ConsoleTransport {
  stats: () => Promise<unknown>;
  list: (query: ConsoleTicketQuery, operatorId: string | undefined) => Promise<unknown>;
  show: (id: string) => Promise<unknown>;
  messages: (id: string, query: { after: string }) => Promise<unknown>;
  update: (id: string, patch: ConsoleTicketPatch) => Promise<unknown>;
  markRead: (id: string) => Promise<unknown>;
  post: (id: string, input: ConsolePostInput) => Promise<unknown>;
  staff: () => Promise<unknown>;
  requestAccess: (ticketId: string, input: RequestAccessInput) => Promise<unknown>;
  emergency: (ticketId: string, input: EmergencyAccessInput) => Promise<unknown>;
  review: (grantId: string) => Promise<unknown>;
  team: (organizationId: string) => Promise<unknown>;
  settings: (organizationId: string) => Promise<unknown>;
  download: (attachmentId: string) => Promise<Blob>;
}

export function createConsoleTransport(client: ApiClient, fetchImpl: typeof fetch): ConsoleTransport {
  const ticket = (id: string) => `${ROOT}/support/tickets/${segment(id)}`;
  const organization = (id: string) => `${ROOT}/organizations/${segment(id)}`;
  return {
    stats: () => client.get(`${ROOT}/support/stats`),
    list: (query, operatorId) =>
      client.get(`${ROOT}/support/tickets`, {
        status: query.status === 'all' ? undefined : query.status,
        priority: query.priority === 'all' ? undefined : query.priority,
        assignee: assigneeParam(query, operatorId),
        space: query.space === 'all' ? undefined : query.space,
        organization: query.organization ?? undefined,
        search: query.search.trim() === '' ? undefined : query.search.trim(),
        page: query.page,
        per_page: query.perPage,
      }),
    show: (id) => client.get(ticket(id)),
    messages: (id, query) => client.get(`${ticket(id)}/messages`, { after: query.after }),
    update: (id, patch) =>
      client.patch(ticket(id), {
        ...(patch.status === undefined ? {} : { status: patch.status }),
        ...(patch.priority === undefined ? {} : { priority: patch.priority }),
        ...(patch.assigneeId === undefined ? {} : { assignee_id: patch.assigneeId }),
      }),
    markRead: (id) => client.patch(ticket(id), { read: true }),
    post: (id, input) =>
      client.post(`${ticket(id)}/messages`, messageBody({ body: input.body, client_id: input.clientId, internal: input.internal ? '1' : '0' }, input.files)),
    staff: () => client.get(`${ROOT}/support/staff`),
    requestAccess: (ticketId, input) =>
      client.post(`${ticket(ticketId)}/access-requests`, { reason: input.reason, scopes: input.scopes, duration_hours: input.durationHours }),
    emergency: (ticketId, input) => client.post(`${ticket(ticketId)}/emergency-access`, { reason: input.reason, basis: input.basis }),
    review: (grantId) => client.post(`${ROOT}/support/access/${segment(grantId)}/review`, {}),
    team: (organizationId) => client.get(`${organization(organizationId)}/team`),
    settings: (organizationId) => client.get(`${organization(organizationId)}/settings`),
    download: (attachmentId) => fetchAttachment(client, fetchImpl, `${ROOT}/support/attachments/${segment(attachmentId)}`),
  };
}
