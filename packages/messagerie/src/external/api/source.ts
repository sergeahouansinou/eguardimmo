import type { ApiClient } from '@eguardimmo/api';
import { saveBlob } from '../../data/api/attachmentDownload';
import type { ExternalSpace } from '../model';
import type { ExternalMessagerieSource } from '../source';
import { toDetail, toMessage, toMessagesPage, toOwnerOptions, toTenantOptions, toThreadPage } from './mapping';
import {
  messagePayload,
  messagesPayload,
  ownerOptionsPayload,
  tenantOptionsPayload,
  threadDetailPayload,
  threadListPayload,
  threadPayload,
  unreadPayload,
} from './payloads';
import { createTransport, parsePayload, safeFileName } from './transport';

export interface ExternalApiSourceOptions {
  client: ApiClient;
  space: ExternalSpace;
  fetchImpl?: typeof fetch;
}

export function createExternalApiSource({ client, space, fetchImpl = (...args) => fetch(...args) }: ExternalApiSourceOptions): ExternalMessagerieSource {
  const transport = createTransport(client, space, fetchImpl);
  return {
    listThreads: async (query, cursor) => toThreadPage(parsePayload(threadListPayload, await transport.list(query, cursor))),
    getThread: async (id) => toDetail(parsePayload(threadDetailPayload, await transport.show(id)).data),
    listMessages: async (id, query) => toMessagesPage(parsePayload(messagesPayload, await transport.messages(id, query))),
    unreadCount: async () => parsePayload(unreadPayload, await transport.unread()).data.unread,
    composeOptions: async () => {
      const payload = await transport.options();
      return space === 'tenant' ? toTenantOptions(parsePayload(tenantOptionsPayload, payload)) : toOwnerOptions(parsePayload(ownerOptionsPayload, payload));
    },
    openThread: async (input) => toDetail(parsePayload(threadDetailPayload, await transport.open(input)).data),
    postMessage: async (id, input) => toMessage(parsePayload(messagePayload, await transport.post(id, input)).data),
    markThread: async (id, input) => {
      parsePayload(threadPayload, await transport.patch(id, input));
    },
    redactMessage: async (id, messageId) => toMessage(parsePayload(messagePayload, await transport.redact(id, messageId)).data),
    downloadAttachment: async (attachment) => {
      saveBlob(await transport.download(attachment.id), safeFileName(attachment.name));
    },
  };
}
