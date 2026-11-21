'use client';

import { createContext, use } from 'react';
import type { ReactNode } from 'react';
import type { Attachment } from './schemas';
import type {
  CampaignQuery,
  ConversationQuery,
  CreateSupportTicketInput,
  NewConversationInput,
  ReplyInput,
  SaveCampaignInput,
  SendCampaignTestInput,
  TicketPatch,
  TicketQuery,
} from './inputs';

export interface MessagerieSource {
  inboxStats: () => Promise<unknown>;
  listConversations: (query: ConversationQuery) => Promise<unknown>;
  getConversation: (id: string) => Promise<unknown>;
  listRecipients: () => Promise<unknown>;
  replyToConversation: (id: string, input: ReplyInput) => Promise<unknown>;
  createConversation: (input: NewConversationInput) => Promise<unknown>;
  setConversationRead: (id: string, read: boolean) => Promise<void>;
  setConversationArchived: (id: string, archived: boolean) => Promise<void>;
  downloadConversationAttachment?: (attachment: Pick<Attachment, 'id' | 'name'>) => Promise<void>;

  listCampaigns: (query: CampaignQuery) => Promise<unknown>;
  getCampaign: (id: string) => Promise<unknown>;
  listCampaignAudiences: () => Promise<unknown>;
  saveCampaign: (input: SaveCampaignInput) => Promise<unknown>;
  sendCampaignTest: (input: SendCampaignTestInput) => Promise<unknown>;

  listTickets: (query: TicketQuery) => Promise<unknown>;
  ticketStats: () => Promise<unknown>;
  getTicket: (id: string) => Promise<unknown>;
  listStaff: () => Promise<unknown>;
  updateTicket: (id: string, patch: TicketPatch) => Promise<unknown>;
  replyToTicket: (id: string, input: ReplyInput) => Promise<unknown>;
  requestTicketAccess: (id: string, reason: string) => Promise<unknown>;
  downloadTicketAttachment?: (attachment: Pick<Attachment, 'id' | 'name'>) => Promise<void>;

  supportStatus: () => Promise<unknown>;
  listMyTickets: () => Promise<unknown>;
  getMyTicket: (id: string) => Promise<unknown>;
  createSupportTicket: (input: CreateSupportTicketInput) => Promise<unknown>;
  replyToMyTicket: (id: string, input: ReplyInput) => Promise<unknown>;

  helpCenter: () => Promise<unknown>;
}

const SourceContext = createContext<MessagerieSource | null>(null);

export function MessagerieSourceProvider({ source, children }: { source: MessagerieSource; children: ReactNode }) {
  return <SourceContext value={source}>{children}</SourceContext>;
}

export function useMessagerieSource(): MessagerieSource {
  const source = use(SourceContext);
  if (!source) throw new Error('MessagerieProvider manquant autour de la messagerie.');
  return source;
}
