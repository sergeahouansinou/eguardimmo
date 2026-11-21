import { fetchAttachment, safeFileName } from '../../external/api/transport';
import type { MessagerieSpace } from '../demo';
import type { ConversationQuery, NewConversationInput, ReplyInput } from '../inputs';
import type { Attachment, ConversationDetail, ConversationList, ConversationSummary, InboxStats, Participant, Recipient } from '../schemas';
import {
  conversationDetailResponseSchema,
  conversationListResponseSchema,
  conversationStatsResponseSchema,
  recipientsResponseSchema,
} from './apiSchemas';
import type { ApiConversationDetail, ApiConversationSummary } from './apiSchemas';
import { saveBlob } from './attachmentDownload';
import { STALE_HOURS, messageForm, parseResponse, participant, teamRole, toAttachment, translated } from './shared';
import type { ApiMessagerieSourceOptions } from './shared';

export const NO_ORGANIZATION_MESSAGE = 'La messagerie avec votre gestionnaire arrive bientôt.';
const NO_AVERAGE_REPLY = '—';
const FORMER_PARTICIPANT = { id: 'ancien-participant', name: 'Ancien participant' };

function counterpartOf(item: ApiConversationSummary, space: MessagerieSpace): Participant {
  return participant(item.counterpart ?? FORMER_PARTICIPANT, teamRole(space));
}

export function toConversationSummary(item: ApiConversationSummary, space: MessagerieSpace): ConversationSummary {
  return {
    id: item.id,
    subject: item.subject,
    counterpart: counterpartOf(item, space),
    preview: item.preview,
    lastMessageAt: item.last_message_at,
    lastAuthorId: item.last_author_id,
    unread: item.unread,
    archived: item.archived,
    awaitingReply: item.awaiting_reply,
    messageCount: item.message_count,
    hasAttachments: item.has_attachments,
  };
}

export function toConversationDetail(item: ApiConversationDetail, space: MessagerieSpace): ConversationDetail {
  return {
    ...toConversationSummary(item, space),
    viewerId: item.viewer_id,
    participants: item.participants.map((member) => participant(member, teamRole(space))),
    messages: item.messages.map((message) => ({
      id: message.id,
      authorId: message.author_id,
      body: message.body,
      sentAt: message.sent_at,
      attachments: message.attachments.map(toAttachment),
      internal: false,
    })),
    context: [],
    links: [],
  };
}

export function conversationHandlers({ client, organizationId, space, fetchImpl = (...args) => fetch(...args) }: ApiMessagerieSourceOptions) {
  const base = (): string => {
    if (organizationId === null) throw new Error(NO_ORGANIZATION_MESSAGE);
    return `/api/v1/org/${encodeURIComponent(organizationId)}`;
  };

  const detail = async (request: Promise<unknown>): Promise<ConversationDetail> =>
    toConversationDetail(parseResponse(conversationDetailResponseSchema, await request).data, space);

  return {
    inboxStats: async (): Promise<InboxStats> =>
      translated(async () => {
        const { data } = parseResponse(conversationStatsResponseSchema, await client.get(`${base()}/conversations/stats`));
        return {
          unread: data.unread,
          unreadByRole: {},
          stale: {
            count: data.stale,
            detail: data.stale > 0 ? `${String(data.stale)} en attente depuis plus de ${String(STALE_HOURS)} h` : null,
          },
          averageReplyLabel: NO_AVERAGE_REPLY,
        };
      }),

    listConversations: async (query: ConversationQuery): Promise<ConversationList> =>
      translated(async () => {
        const serverTab = query.tab === 'mandant' || query.tab === 'locataire' ? 'all' : query.tab;
        const withoutServerTab = serverTab !== query.tab;
        const response = parseResponse(
          conversationListResponseSchema,
          await client.get(`${base()}/conversations`, {
            tab: serverTab,
            search: query.search.trim(),
            page: withoutServerTab ? 1 : query.page,
            per_page: withoutServerTab ? 1 : query.pageSize,
          }),
        );
        return {
          viewerId: response.viewer_id,
          items: withoutServerTab ? [] : response.data.map((item) => toConversationSummary(item, space)),
          total: withoutServerTab ? 0 : response.meta.total,
          page: withoutServerTab ? query.page : response.meta.current_page,
          pageSize: withoutServerTab ? query.pageSize : response.meta.per_page,
          counts: { ...response.counts, mandant: 0, locataire: 0 },
        };
      }),

    getConversation: async (id: string): Promise<ConversationDetail> =>
      translated(() => detail(client.get(`${base()}/conversations/${encodeURIComponent(id)}`))),

    listRecipients: async (): Promise<Recipient[]> =>
      translated(async () => {
        const { data } = parseResponse(recipientsResponseSchema, await client.get(`${base()}/conversations/recipients`));
        return data.map((member) => ({ ...participant(member, teamRole(space)), linkOptions: [] }));
      }),

    replyToConversation: async (id: string, input: ReplyInput): Promise<ConversationDetail> =>
      translated(() =>
        detail(client.post(`${base()}/conversations/${encodeURIComponent(id)}/messages`, messageForm({ body: input.body }, input.attachments))),
      ),

    createConversation: async (input: NewConversationInput): Promise<ConversationDetail> =>
      translated(() =>
        detail(
          client.post(
            `${base()}/conversations`,
            messageForm({ recipient_id: input.recipientId, subject: input.subject, body: input.body }, input.attachments),
          ),
        ),
      ),

    setConversationRead: async (id: string, read: boolean): Promise<void> => {
      await translated(() => client.patch(`${base()}/conversations/${encodeURIComponent(id)}`, { read }));
    },

    setConversationArchived: async (id: string, archived: boolean): Promise<void> => {
      await translated(() => client.patch(`${base()}/conversations/${encodeURIComponent(id)}`, { archived }));
    },

    downloadConversationAttachment: async (attachment: Pick<Attachment, 'id' | 'name'>): Promise<void> => {
      const blob = await translated(() => fetchAttachment(client, fetchImpl, `${base()}/conversation-attachments/${encodeURIComponent(attachment.id)}`));
      saveBlob(blob, safeFileName(attachment.name));
    },
  };
}
