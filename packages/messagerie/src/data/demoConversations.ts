import { newMessageInputSchema, replyInputSchema } from './inputs';
import type { ConversationQuery, NewConversationInput, ReplyInput } from './inputs';
import { participantSchema } from './schemas';
import type { ConversationDetail, ConversationTab, ParticipantRole } from './schemas';
import { assertAttachments, fold, newMessage, paginate, run, toSummary } from './demoState';
import type { DemoContext } from './demoState';

const TABS: ConversationTab[] = ['all', 'unread', 'awaiting', 'sent', 'archived', 'mandant', 'locataire'];

function matches(meId: string, tab: ConversationTab, conversation: ConversationDetail): boolean {
  if (tab === 'archived') return conversation.archived;
  if (conversation.archived) return false;
  switch (tab) {
    case 'all':
      return true;
    case 'unread':
      return conversation.unread;
    case 'awaiting':
      return conversation.awaitingReply;
    case 'sent':
      return conversation.lastAuthorId === meId;
    case 'mandant':
    case 'locataire':
      return conversation.counterpart.role === tab;
  }
}

function find(context: DemoContext, id: string): ConversationDetail {
  const conversation = context.state.conversations.find((item) => item.id === id);
  if (!conversation) throw new Error('Conversation introuvable.');
  return conversation;
}

export function conversationHandlers(context: DemoContext) {
  const { state } = context;
  return {
    inboxStats: () =>
      run(() => {
        const unread = state.conversations.filter((item) => !item.archived && item.unread);
        const unreadByRole: Partial<Record<ParticipantRole, number>> = {};
        for (const item of unread) {
          unreadByRole[item.counterpart.role] = (unreadByRole[item.counterpart.role] ?? 0) + 1;
        }
        return {
          unread: unread.length,
          unreadByRole,
          stale: { count: state.inbox.staleCount, detail: state.inbox.staleDetail },
          averageReplyLabel: state.inbox.averageReplyLabel,
        };
      }),

    listConversations: (query: ConversationQuery) =>
      run(() => {
        const needle = fold(query.search.trim());
        const inTab = state.conversations.filter((item) => matches(state.me.id, query.tab, item));
        const found = needle
          ? inTab.filter((item) =>
              fold(`${item.subject} ${item.counterpart.name} ${item.tag ?? ''} ${item.preview}`).includes(needle),
            )
          : inTab;
        const sorted = [...found].sort((a, b) => b.lastMessageAt.localeCompare(a.lastMessageAt));
        const counts = Object.fromEntries(
          TABS.map((tab) => [tab, state.conversations.filter((item) => matches(state.me.id, tab, item)).length]),
        );
        return {
          viewerId: state.me.id,
          items: paginate(sorted, query.page, query.pageSize).map(toSummary),
          total: sorted.length,
          page: query.page,
          pageSize: query.pageSize,
          counts,
        };
      }),

    getConversation: (id: string) => run(() => find(context, id)),

    listRecipients: () => run(() => state.recipients),

    replyToConversation: (id: string, input: ReplyInput) =>
      run(() => {
        const parsed = replyInputSchema.parse({ body: input.body });
        assertAttachments(input.attachments);
        const conversation = find(context, id);
        const message = newMessage(context, state.me.id, parsed.body, input.attachments);
        conversation.messages.push(message);
        conversation.preview = message.body;
        conversation.lastMessageAt = message.sentAt;
        conversation.lastAuthorId = message.authorId;
        conversation.messageCount = conversation.messages.length;
        conversation.hasAttachments = conversation.hasAttachments || message.attachments.length > 0;
        conversation.unread = false;
        conversation.awaitingReply = false;
        return conversation;
      }),

    createConversation: (input: NewConversationInput) =>
      run(() => {
        const parsed = newMessageInputSchema.parse({
          recipientId: input.recipientId,
          linkId: input.linkId ?? '',
          subject: input.subject,
          body: input.body,
        });
        assertAttachments(input.attachments);
        const recipient = state.recipients.find((item) => item.id === parsed.recipientId);
        if (!recipient) throw new Error('Destinataire introuvable.');
        const link = recipient.linkOptions.find((option) => option.id === parsed.linkId);
        const counterpart = participantSchema.parse(recipient);
        const message = newMessage(context, state.me.id, parsed.body, input.attachments);
        const conversation: ConversationDetail = {
          id: context.nextId('conv'),
          subject: parsed.subject,
          counterpart,
          ...(counterpart.detail ? { tag: counterpart.detail } : {}),
          preview: message.body,
          lastMessageAt: message.sentAt,
          lastAuthorId: message.authorId,
          unread: false,
          archived: false,
          awaitingReply: false,
          messageCount: 1,
          hasAttachments: message.attachments.length > 0,
          viewerId: state.me.id,
          participants: [state.me, counterpart],
          messages: [message],
          context: link ? [{ label: 'Rattaché à', value: link.label }] : [],
          links: [],
        };
        state.conversations.push(conversation);
        return conversation;
      }),

    setConversationRead: (id: string, read: boolean) =>
      run(() => {
        find(context, id).unread = !read;
      }),

    setConversationArchived: (id: string, archived: boolean) =>
      run(() => {
        find(context, id).archived = archived;
      }),
  };
}
