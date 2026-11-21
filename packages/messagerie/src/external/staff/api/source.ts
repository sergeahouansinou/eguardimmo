import type { ApiClient } from '@eguardimmo/api';
import { saveBlob } from '../../../data/api/attachmentDownload';
import { parsePayload, safeFileName } from '../../api/transport';
import type { StaffRole } from '../model';
import type { StaffMessagerieSource } from '../source';
import { toAssignees, toStaffDetail, toStaffMessage, toStaffMessagesPage, toStaffThreadPage, toStaffUnread } from './mapping';
import {
  assigneesPayload,
  identityPayload,
  staffDetailPayload,
  staffListPayload,
  staffMessagePayload,
  staffMessagesPayload,
  staffUnreadPayload,
} from './payloads';
import { createStaffTransport, stateBody } from './transport';

export interface StaffApiSourceOptions {
  client: ApiClient;
  organizationId: string;
  role: StaffRole;
  fetchImpl?: typeof fetch;
}

export function createStaffApiSource({ client, organizationId, role, fetchImpl = (...args) => fetch(...args) }: StaffApiSourceOptions): StaffMessagerieSource {
  const transport = createStaffTransport(client, organizationId, fetchImpl);
  const detail = async (request: Promise<unknown>) => toStaffDetail(parsePayload(staffDetailPayload, await request).data);
  return {
    listThreads: async (query, cursor) => toStaffThreadPage(parsePayload(staffListPayload, await transport.list(query, cursor))),
    getThread: (id) => detail(transport.show(id)),
    listMessages: async (id, query) => toStaffMessagesPage(parsePayload(staffMessagesPayload, await transport.messages(id, query))),
    unread: async () => toStaffUnread(parsePayload(staffUnreadPayload, await transport.unread())),
    openThread: (input) => detail(transport.open(input)),
    postMessage: async (id, input) => toStaffMessage(parsePayload(staffMessagePayload, await transport.post(id, input)).data),
    markThread: async (id, input) => {
      await transport.patch(id, stateBody(input));
    },
    updateThread: (id, input) => detail(transport.patch(id, stateBody(input))),
    redactMessage: async (id, messageId, reason) => toStaffMessage(parsePayload(staffMessagePayload, await transport.redact(id, messageId, reason)).data),
    restrict: (id, input) => detail(transport.restrict(id, input)),
    lift: (id) => detail(transport.lift(id)),
    assignees: async () => {
      const [recipients, identity] = await Promise.all([transport.recipients(), transport.identity()]);
      return toAssignees(parsePayload(assigneesPayload, recipients), parsePayload(identityPayload, identity).data, role);
    },
    downloadAttachment: async (attachment) => {
      saveBlob(await transport.download(attachment.id), safeFileName(attachment.name));
    },
  };
}
