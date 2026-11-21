import type { ApiClient } from '@eguardimmo/api';
import { saveBlob } from '../../../data/api/attachmentDownload';
import { parsePayload, safeFileName } from '../../../external/api/transport';
import type { ConsoleSupportSource } from '../source';
import { toDetail, toGrant, toMessagesPage, toStats, toTicketPage } from './mapping';
import { grantResponsePayload, messagesPayload, settingsPayload, staffPayload, statsPayload, teamPayload, ticketDetailPayload, ticketListPayload } from './payloads';
import { createConsoleTransport } from './transport';

export interface ConsoleSupportApiSourceOptions {
  client: ApiClient;
  operatorId: () => Promise<string>;
  fetchImpl?: typeof fetch;
}

export function createConsoleSupportApiSource({ client, operatorId, fetchImpl = (...args) => fetch(...args) }: ConsoleSupportApiSourceOptions): ConsoleSupportSource {
  const transport = createConsoleTransport(client, fetchImpl);
  const detail = async (request: Promise<unknown>) => toDetail(parsePayload(ticketDetailPayload, await request).data);
  const grant = async (request: Promise<unknown>) => toGrant(parsePayload(grantResponsePayload, await request).data);
  return {
    operatorId,
    stats: async () => toStats(parsePayload(statsPayload, await transport.stats())),
    listTickets: async (query, operator) => toTicketPage(parsePayload(ticketListPayload, await transport.list(query, operator))),
    getTicket: (id) => detail(transport.show(id)),
    listMessages: async (id, query) => toMessagesPage(parsePayload(messagesPayload, await transport.messages(id, query))),
    updateTicket: (id, patch) => detail(transport.update(id, patch)),
    markRead: (id) => detail(transport.markRead(id)),
    postMessage: (id, input) => detail(transport.post(id, input)),
    staff: async () => parsePayload(staffPayload, await transport.staff()).data,
    requestAccess: (ticketId, input) => grant(transport.requestAccess(ticketId, input)),
    openEmergency: (ticketId, input) => grant(transport.emergency(ticketId, input)),
    reviewGrant: (grantId) => grant(transport.review(grantId)),
    organizationTeam: async (organizationId) =>
      parsePayload(teamPayload, await transport.team(organizationId)).data.map((member) => ({ firstName: member.first_name, lastName: member.last_name, role: member.role })),
    organizationSettings: async (organizationId) => parsePayload(settingsPayload, await transport.settings(organizationId)).data,
    downloadAttachment: async (attachment) => {
      saveBlob(await transport.download(attachment.id), safeFileName(attachment.name));
    },
  };
}
