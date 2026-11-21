import type { SupportTicketSummary } from './model';

export interface SeenTickets {
  mark: (ticketId: string, updatedAt: string) => void;
  has: (ticketId: string, updatedAt: string) => boolean;
}

export function createSeenTickets(): SeenTickets {
  const seen = new Map<string, string>();
  return {
    mark: (ticketId, updatedAt) => {
      seen.set(ticketId, updatedAt);
    },
    has: (ticketId, updatedAt) => seen.get(ticketId) === updatedAt,
  };
}

export function isTicketUnread(ticket: SupportTicketSummary, seen: SeenTickets): boolean {
  if (ticket.status === 'open' || seen.has(ticket.id, ticket.updatedAt)) return false;
  if (ticket.requesterLastReadAt === null) return true;
  return new Date(ticket.updatedAt).getTime() > new Date(ticket.requesterLastReadAt).getTime();
}

export function countUnread(tickets: readonly SupportTicketSummary[], seen: SeenTickets): number {
  return tickets.filter((ticket) => isTicketUnread(ticket, seen)).length;
}
