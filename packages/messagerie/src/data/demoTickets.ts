import { isDemoSupportOnline } from './demoSupportHours';
import { accessReasonSchema, replyInputSchema, supportTicketInputSchema } from './inputs';
import type { CreateSupportTicketInput, ReplyInput, TicketPatch, TicketQuery } from './inputs';
import { ticketPrioritySchema, ticketStatusSchema } from './schemas';
import type { TicketDetail, TicketTab } from './schemas';
import { assertAttachments, fold, newMessage, paginate, run, toTicketSummary } from './demoState';
import type { DemoContext } from './demoState';

const TABS: TicketTab[] = ['ouvert', 'en_attente', 'resolu', 'tous'];
const ACCESS_MINUTES = 60;

const supportBot = {
  id: 'support-eguardimmo',
  name: 'Support eGuardImmo',
  initials: 'SE',
  role: 'support',
} as const;

function find(context: DemoContext, id: string): TicketDetail {
  const ticket = context.state.tickets.find((item) => item.id === id);
  if (!ticket) throw new Error('Ticket introuvable.');
  return ticket;
}

function findMine(context: DemoContext, id: string): TicketDetail {
  const ticket = find(context, id);
  if (ticket.requester.id !== context.state.me.id) throw new Error('Ticket introuvable.');
  return ticket;
}

function publicView(context: DemoContext, ticket: TicketDetail): TicketDetail {
  return {
    ...ticket,
    viewerId: context.state.me.id,
    messages: ticket.messages.filter((message) => !message.internal),
    access: null,
    linked: [],
  };
}

function touch(context: DemoContext, ticket: TicketDetail): void {
  const last = ticket.messages.at(-1);
  ticket.messageCount = ticket.messages.length;
  ticket.updatedAt = last?.sentAt ?? context.now().toISOString();
}

export function ticketHandlers(context: DemoContext) {
  const { state } = context;
  const resolvedNow = () => state.tickets.filter((item) => item.status === 'resolu').length;
  const resolvedAtStart = resolvedNow();

  return {
    listTickets: (query: TicketQuery) =>
      run(() => {
        const needle = fold(query.search.trim());
        const byTab = (tab: TicketTab) =>
          state.tickets.filter((item) => tab === 'tous' || item.status === tab);
        const found = byTab(query.tab).filter(
          (item) =>
            (query.priority === 'toutes' || item.priority === query.priority) &&
            (query.assigneeId === 'tous' ||
              (query.assigneeId === 'none' ? item.assigneeId === null : item.assigneeId === query.assigneeId)) &&
            (needle === '' || fold(`${item.subject} ${item.reference} ${item.organization}`).includes(needle)),
        );
        const sorted = [...found].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
        return {
          items: paginate(sorted, query.page, query.pageSize).map(toTicketSummary),
          total: sorted.length,
          page: query.page,
          pageSize: query.pageSize,
          counts: Object.fromEntries(TABS.map((tab) => [tab, byTab(tab).length])),
        };
      }),

    ticketStats: () =>
      run(() => {
        const open = state.tickets.filter((item) => item.status === 'ouvert');
        const waiting = state.tickets.filter((item) => item.status === 'en_attente');
        return {
          open: open.length,
          openHigh: open.filter((item) => item.priority === 'haute').length,
          waiting: waiting.length,
          waitingDetail: 'Relance à 72 h',
          firstResponse: state.ticketBaseline.firstResponse,
          firstResponseDetail: state.ticketBaseline.firstResponseDetail,
          resolved30d: state.ticketBaseline.resolved30d + (resolvedNow() - resolvedAtStart),
          satisfaction: state.ticketBaseline.satisfaction,
        };
      }),

    getTicket: (id: string) => run(() => ({ ...find(context, id), viewerId: state.me.id })),

    listStaff: () => run(() => state.staff),

    updateTicket: (id: string, patch: TicketPatch) =>
      run(() => {
        const ticket = find(context, id);
        if (patch.status !== undefined) ticket.status = ticketStatusSchema.parse(patch.status);
        if (patch.priority !== undefined) ticket.priority = ticketPrioritySchema.parse(patch.priority);
        if (patch.assigneeId !== undefined) {
          const member = patch.assigneeId === null ? null : state.staff.find((item) => item.id === patch.assigneeId);
          if (member === undefined) throw new Error('Opérateur introuvable.');
          ticket.assigneeId = member?.id ?? null;
          ticket.assigneeName = member?.name ?? null;
        }
        ticket.updatedAt = context.now().toISOString();
        return ticket;
      }),

    replyToTicket: (id: string, input: ReplyInput) =>
      run(() => {
        const parsed = replyInputSchema.parse({ body: input.body });
        assertAttachments(input.attachments);
        const ticket = find(context, id);
        const internal = input.internal ?? false;
        ticket.messages.push(newMessage(context, state.me.id, parsed.body, input.attachments, internal));
        if (!internal && ticket.firstResponseLabel === null) ticket.firstResponseLabel = 'À l’instant';
        touch(context, ticket);
        return ticket;
      }),

    requestTicketAccess: (id: string, reason: string) =>
      run(() => {
        const parsed = accessReasonSchema.parse({ reason });
        const ticket = find(context, id);
        const grantedAt = context.now();
        const expiresAt = new Date(grantedAt.getTime() + ACCESS_MINUTES * 60_000);
        ticket.access = { reason: parsed.reason, grantedAt: grantedAt.toISOString(), expiresAt: expiresAt.toISOString() };
        ticket.messages.push(
          newMessage(
            context,
            state.me.id,
            `Accès justifié ouvert pour ${String(ACCESS_MINUTES)} minutes. Motif : ${parsed.reason}`,
            [],
            true,
          ),
        );
        touch(context, ticket);
        return ticket;
      }),

    supportStatus: () =>
      run(() => ({
        online: isDemoSupportOnline(context.now()),
        hoursLabel: state.support.hoursLabel,
        responseLabel: state.support.responseLabel,
      })),

    listMyTickets: () =>
      run(() => {
        const mine = state.tickets.filter((item) => item.requester.id === state.me.id);
        const sorted = [...mine].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
        return sorted.map(toTicketSummary);
      }),

    getMyTicket: (id: string) => run(() => publicView(context, findMine(context, id))),

    createSupportTicket: (input: CreateSupportTicketInput) =>
      run(() => {
        const parsed = supportTicketInputSchema.parse({
          category: input.category,
          subject: input.subject,
          body: input.body,
        });
        assertAttachments(input.attachments);
        const sequence = state.tickets.length + 2100;
        const first = newMessage(context, state.me.id, parsed.body, input.attachments);
        const reference = `SUP-${String(sequence)}`;
        const acknowledgement = newMessage(
          context,
          supportBot.id,
          `Merci, votre demande ${reference} est enregistrée. Nous vous répondons dans les meilleurs délais.`,
          [],
        );
        const ticket: TicketDetail = {
          id: context.nextId('tk'),
          reference,
          subject: parsed.subject,
          organization: state.me.detail ?? state.me.name,
          requester: state.me,
          assigneeId: null,
          assigneeName: null,
          priority: 'normale',
          status: 'ouvert',
          category: parsed.category,
          createdAt: first.sentAt,
          updatedAt: acknowledgement.sentAt,
          messageCount: 2,
          viewerId: state.me.id,
          participants: [state.me, supportBot],
          messages: [first, acknowledgement],
          firstResponseLabel: null,
          linked: [],
          access: null,
        };
        state.tickets.push(ticket);
        return publicView(context, ticket);
      }),

    replyToMyTicket: (id: string, input: ReplyInput) =>
      run(() => {
        const parsed = replyInputSchema.parse({ body: input.body });
        assertAttachments(input.attachments);
        const ticket = findMine(context, id);
        ticket.messages.push(newMessage(context, state.me.id, parsed.body, input.attachments));
        if (ticket.status === 'resolu' || ticket.status === 'en_attente') ticket.status = 'ouvert';
        touch(context, ticket);
        return publicView(context, ticket);
      }),
  };
}
