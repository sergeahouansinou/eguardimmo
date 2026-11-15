import type { MessagerieSpace } from '../demo';
import type { CreateSupportTicketInput, ReplyInput, TicketPatch, TicketQuery } from '../inputs';
import type {
  Message,
  Participant,
  ParticipantRole,
  StaffMember,
  TicketCategory,
  TicketDetail,
  TicketList,
  TicketPriority,
  TicketStats,
  TicketStatus,
  TicketSummary,
} from '../schemas';
import {
  consoleTicketListSchema,
  staffResponseSchema,
  ticketDetailResponseSchema,
  ticketStatsResponseSchema,
  ticketSummaryListSchema,
} from './apiSchemas';
import type {
  ApiTicketCategory,
  ApiTicketDetail,
  ApiTicketPriority,
  ApiTicketSpace,
  ApiTicketStatus,
  ApiTicketSummary,
} from './apiSchemas';
import { formatDelay, messageForm, minutesBetween, parseResponse, participant, toAttachment, translated } from './shared';
import type { ApiMessagerieSourceOptions } from './shared';

export const OPERATOR_TICKET_MESSAGE = 'Les opérateurs ne peuvent pas ouvrir de demande d’assistance.';

const STATUS: Record<ApiTicketStatus, TicketStatus> = { open: 'ouvert', waiting: 'en_attente', resolved: 'resolu' };
const STATUS_TO_API: Record<TicketStatus, ApiTicketStatus> = { ouvert: 'open', en_attente: 'waiting', resolu: 'resolved' };
const PRIORITY: Record<ApiTicketPriority, TicketPriority> = { high: 'haute', normal: 'normale', low: 'basse' };
const PRIORITY_TO_API: Record<TicketPriority, ApiTicketPriority> = { haute: 'high', normale: 'normal', basse: 'low' };
const CATEGORY: Record<ApiTicketCategory, TicketCategory> = {
  messaging: 'messagerie',
  billing: 'facturation',
  account: 'compte',
  documents: 'documents',
  other: 'autre',
};
const CATEGORY_TO_API: Record<TicketCategory, ApiTicketCategory> = {
  messagerie: 'messaging',
  facturation: 'billing',
  compte: 'account',
  documents: 'documents',
  autre: 'other',
};

const REQUEST_SPACE: Record<MessagerieSpace, ApiTicketSpace | null> = {
  locataire: 'tenant',
  proprietaire: 'owner',
  agence: 'organization',
  bailleur: 'organization',
  console: null,
};
const REQUESTER_ROLE: Record<ApiTicketSpace, ParticipantRole> = {
  tenant: 'locataire',
  owner: 'proprietaire',
  organization: 'agence',
  marketplace: 'locataire',
};
const SPACE_LABEL: Record<ApiTicketSpace, string> = {
  tenant: 'Espace locataire',
  owner: 'Espace propriétaire',
  organization: 'Organisation',
  marketplace: 'SeBook',
};
const FALLBACK_OPERATOR_VIEWER = 'operateur';

function requesterOf(item: ApiTicketSummary): Participant {
  return participant(item.requester, REQUESTER_ROLE[item.space]);
}

export function toTicketSummary(item: ApiTicketSummary): TicketSummary {
  return {
    id: item.id,
    reference: item.reference,
    subject: item.subject,
    organization: item.organization ?? SPACE_LABEL[item.space],
    requester: requesterOf(item),
    assigneeId: item.assignee?.id ?? null,
    assigneeName: item.assignee?.name ?? null,
    priority: PRIORITY[item.priority],
    status: STATUS[item.status],
    category: CATEGORY[item.category],
    createdAt: item.created_at,
    updatedAt: item.updated_at,
    messageCount: item.message_count,
  };
}

function viewerOf(item: ApiTicketDetail, requesterView: boolean, operatorViewerId: string | undefined): string {
  if (requesterView) return item.requester.id;
  const lastSupport = item.messages.findLast((message) => message.author.support);
  return operatorViewerId ?? lastSupport?.author.id ?? FALLBACK_OPERATOR_VIEWER;
}

export function toTicketDetail(
  item: ApiTicketDetail,
  space: MessagerieSpace,
  requesterView: boolean,
  operatorViewerId?: string,
): TicketDetail {
  const requester = requesterOf(item);
  const supportRole: ParticipantRole = space === 'console' ? 'operateur' : 'support';
  const participants = new Map<string, Participant>([[requester.id, requester]]);
  for (const { author } of item.messages) {
    if (!participants.has(author.id)) participants.set(author.id, participant(author, author.support ? supportRole : requester.role));
  }
  const messages: Message[] = item.messages.map((message) => ({
    id: message.id,
    authorId: message.author.id,
    body: message.body,
    sentAt: message.sent_at,
    attachments: message.attachments.map(toAttachment),
    internal: message.internal,
  }));
  return {
    ...toTicketSummary(item),
    viewerId: viewerOf(item, requesterView, operatorViewerId),
    participants: [...participants.values()],
    messages,
    firstResponseLabel:
      item.first_response_at === null ? null : formatDelay(minutesBetween(item.created_at, item.first_response_at)),
    linked: [],
    access: item.access ? { reason: item.access.reason, grantedAt: item.access.granted_at, expiresAt: item.access.expires_at } : null,
  };
}

export function ticketHandlers({ client, space, organizationId, viewerId }: ApiMessagerieSourceOptions) {
  const consoleDetail = async (request: Promise<unknown>): Promise<TicketDetail> =>
    toTicketDetail(parseResponse(ticketDetailResponseSchema, await request).data, space, false, viewerId);
  const myDetail = async (request: Promise<unknown>): Promise<TicketDetail> =>
    toTicketDetail(parseResponse(ticketDetailResponseSchema, await request).data, space, true);
  const consoleTicket = (id: string) => `/api/v1/console/support/tickets/${encodeURIComponent(id)}`;
  const myTicket = (id: string) => `/api/v1/support/tickets/${encodeURIComponent(id)}`;

  return {
    listTickets: async (query: TicketQuery): Promise<TicketList> =>
      translated(async () => {
        const response = parseResponse(
          consoleTicketListSchema,
          await client.get('/api/v1/console/support/tickets', {
            status: query.tab === 'tous' ? undefined : STATUS_TO_API[query.tab],
            priority: query.priority === 'toutes' ? undefined : PRIORITY_TO_API[query.priority],
            assignee: query.assigneeId === 'tous' ? undefined : query.assigneeId,
            search: query.search.trim(),
            page: query.page,
            per_page: query.pageSize,
          }),
        );
        return {
          items: response.data.map(toTicketSummary),
          total: response.meta.total,
          page: response.meta.current_page,
          pageSize: response.meta.per_page,
          counts: {
            ouvert: response.counts.open,
            en_attente: response.counts.waiting,
            resolu: response.counts.resolved,
            tous: response.counts.all,
          },
        };
      }),

    ticketStats: async (): Promise<TicketStats> =>
      translated(async () => {
        const { data } = parseResponse(ticketStatsResponseSchema, await client.get('/api/v1/console/support/stats'));
        const minutes = data.first_response_minutes;
        return {
          open: data.open,
          openHigh: data.open_high,
          waiting: data.waiting,
          waitingDetail: '',
          firstResponse: minutes === null ? '—' : formatDelay(minutes),
          firstResponseDetail: minutes === null ? 'Aucune réponse sur 30 jours' : 'Médiane sur 30 jours',
          resolved30d: data.resolved_30d,
          satisfaction: '',
        };
      }),

    getTicket: async (id: string): Promise<TicketDetail> => translated(() => consoleDetail(client.get(consoleTicket(id)))),

    listStaff: async (): Promise<StaffMember[]> =>
      translated(async () => parseResponse(staffResponseSchema, await client.get('/api/v1/console/support/staff')).data),

    updateTicket: async (id: string, patch: TicketPatch): Promise<TicketDetail> =>
      translated(() =>
        consoleDetail(
          client.patch(consoleTicket(id), {
            ...(patch.status === undefined ? {} : { status: STATUS_TO_API[patch.status] }),
            ...(patch.priority === undefined ? {} : { priority: PRIORITY_TO_API[patch.priority] }),
            ...(patch.assigneeId === undefined ? {} : { assignee_id: patch.assigneeId }),
          }),
        ),
      ),

    replyToTicket: async (id: string, input: ReplyInput): Promise<TicketDetail> =>
      translated(() =>
        consoleDetail(
          client.post(
            `${consoleTicket(id)}/messages`,
            messageForm({ body: input.body, internal: input.internal ? '1' : '0' }, input.attachments),
          ),
        ),
      ),

    requestTicketAccess: async (id: string, reason: string): Promise<TicketDetail> =>
      translated(() => consoleDetail(client.post(`${consoleTicket(id)}/access`, { reason }))),

    listMyTickets: async (): Promise<TicketSummary[]> =>
      translated(async () => parseResponse(ticketSummaryListSchema, await client.get('/api/v1/support/tickets')).data.map(toTicketSummary)),

    getMyTicket: async (id: string): Promise<TicketDetail> => translated(() => myDetail(client.get(myTicket(id)))),

    createSupportTicket: async (input: CreateSupportTicketInput): Promise<TicketDetail> => {
      const requestSpace = REQUEST_SPACE[space];
      if (requestSpace === null) throw new Error(OPERATOR_TICKET_MESSAGE);
      return translated(() =>
        myDetail(
          client.post(
            '/api/v1/support/tickets',
            messageForm(
              {
                space: requestSpace,
                organization_id: organizationId,
                category: CATEGORY_TO_API[input.category],
                subject: input.subject,
                body: input.body,
              },
              input.attachments,
            ),
          ),
        ),
      );
    },

    replyToMyTicket: async (id: string, input: ReplyInput): Promise<TicketDetail> =>
      translated(() => myDetail(client.post(`${myTicket(id)}/messages`, messageForm({ body: input.body }, input.attachments)))),
  };
}
