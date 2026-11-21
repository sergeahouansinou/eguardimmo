import type {
  SupportAttachment,
  SupportAvailability,
  SupportMessagesPage,
  SupportOpenInput,
  SupportPostInput,
  SupportTicketDetail,
  SupportTicketSummary,
} from './model';

export interface SupportSource {
  availability: () => Promise<SupportAvailability>;
  listTickets: () => Promise<SupportTicketSummary[]>;
  getTicket: (id: string) => Promise<SupportTicketDetail>;
  listMessages: (id: string, query: { after: string }) => Promise<SupportMessagesPage>;
  openTicket: (input: SupportOpenInput) => Promise<SupportTicketDetail>;
  postMessage: (id: string, input: SupportPostInput) => Promise<SupportTicketDetail>;
  markRead: (id: string) => Promise<SupportTicketDetail>;
  downloadAttachment: (attachment: Pick<SupportAttachment, 'id' | 'name'>) => Promise<void>;
}
