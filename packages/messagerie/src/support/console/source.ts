import type { SupportAttachment } from '../model';
import type {
  ConsoleGrant,
  ConsoleMessagesPage,
  ConsolePerson,
  ConsolePostInput,
  ConsoleStats,
  ConsoleTicketDetail,
  ConsoleTicketPage,
  ConsoleTicketPatch,
  ConsoleTicketQuery,
  EmergencyAccessInput,
  OrganizationMember,
  OrganizationSettings,
  RequestAccessInput,
} from './model';

export interface ConsoleSupportSource {
  operatorId: () => Promise<string>;
  stats: () => Promise<ConsoleStats>;
  listTickets: (query: ConsoleTicketQuery, operatorId: string | undefined) => Promise<ConsoleTicketPage>;
  getTicket: (id: string) => Promise<ConsoleTicketDetail>;
  listMessages: (id: string, query: { after: string }) => Promise<ConsoleMessagesPage>;
  updateTicket: (id: string, patch: ConsoleTicketPatch) => Promise<ConsoleTicketDetail>;
  markRead: (id: string) => Promise<ConsoleTicketDetail>;
  postMessage: (id: string, input: ConsolePostInput) => Promise<ConsoleTicketDetail>;
  staff: () => Promise<ConsolePerson[]>;
  requestAccess: (ticketId: string, input: RequestAccessInput) => Promise<ConsoleGrant>;
  openEmergency: (ticketId: string, input: EmergencyAccessInput) => Promise<ConsoleGrant>;
  reviewGrant: (grantId: string) => Promise<ConsoleGrant>;
  organizationTeam: (organizationId: string) => Promise<OrganizationMember[]>;
  organizationSettings: (organizationId: string) => Promise<OrganizationSettings>;
  downloadAttachment: (attachment: Pick<SupportAttachment, 'id' | 'name'>) => Promise<void>;
}
