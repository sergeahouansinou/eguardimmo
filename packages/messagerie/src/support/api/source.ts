import type { ApiClient } from '@eguardimmo/api';
import { saveBlob } from '../../data/api/attachmentDownload';
import { parsePayload, safeFileName } from '../../external/api/transport';
import type { SupportRequestSpace } from '../model';
import type { SupportSource } from '../source';
import { toAvailability, toDetail, toMessagesPage, toSummary } from './mapping';
import { availabilityPayload, messagesPayload, ticketDetailPayload, ticketListPayload } from './payloads';
import { createSupportTransport } from './transport';

export interface SupportApiSourceOptions {
  client: ApiClient;
  space: SupportRequestSpace;
  organizationId?: string | null;
  fetchImpl?: typeof fetch;
}

export function createSupportApiSource({
  client,
  space,
  organizationId = null,
  fetchImpl = (...args) => fetch(...args),
}: SupportApiSourceOptions): SupportSource {
  if (space === 'organization' && organizationId === null) throw new Error('Une demande d’organisation exige l’identifiant de l’organisation.');
  const transport = createSupportTransport(client, { space, organizationId }, fetchImpl);
  const detail = async (request: Promise<unknown>) => toDetail(parsePayload(ticketDetailPayload, await request).data);
  return {
    availability: async () => toAvailability(parsePayload(availabilityPayload, await transport.status())),
    listTickets: async () => parsePayload(ticketListPayload, await transport.list()).data.map(toSummary),
    getTicket: (id) => detail(transport.show(id)),
    listMessages: async (id, query) => toMessagesPage(parsePayload(messagesPayload, await transport.messages(id, query))),
    openTicket: (input) => detail(transport.open(input)),
    postMessage: (id, input) => detail(transport.post(id, input)),
    markRead: (id) => detail(transport.markRead(id)),
    downloadAttachment: async (attachment) => {
      saveBlob(await transport.download(attachment.id), safeFileName(attachment.name));
    },
  };
}
