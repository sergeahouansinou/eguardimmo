import type {
  Campaign,
  CampaignAudience,
  ConversationDetail,
  HelpCenterData,
  Participant,
  Recipient,
  StaffMember,
  TicketDetail,
} from './schemas';

export interface MessagerieSeed {
  me: Participant;
  meEmail?: string;
  conversations: ConversationDetail[];
  recipients: Recipient[];
  audiences: CampaignAudience[];
  campaigns: Campaign[];
  tickets: TicketDetail[];
  staff: StaffMember[];
  help: HelpCenterData;
  inbox: { staleCount: number; staleDetail: string | null; averageReplyLabel: string };
  ticketBaseline: { firstResponse: string; firstResponseDetail: string; resolved30d: number; satisfaction: string };
  support: { hoursLabel: string; responseLabel: string };
}
