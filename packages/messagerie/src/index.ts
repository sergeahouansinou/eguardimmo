export { MessagerieProvider, useMessagerieConfig } from './config';
export type { MessagerieConfig, MessagerieProviderProps, MessagerieRoutes } from './config';
export {
  agenceProfile,
  bailleurProfile,
  consoleProfile,
  locataireProfile,
  messagerieProfiles,
  proprietaireProfile,
} from './profiles';
export type { InboxTabConfig, MessagerieProfile } from './profiles';

export { createDemoMessagerieSource, demoSeeds } from './data/demo';
export type { DemoMessagerieSource, DemoSourceOptions, MessagerieSpace } from './data/demo';
export { createApiMessagerieSource } from './data/api';
export type { ApiMessagerieSourceDependencies, ApiMessagerieSourceOptions } from './data/api';
export { MessagerieSourceProvider, useMessagerieSource } from './data/source';
export type { MessagerieSource } from './data/source';
export {
  ACCEPTED_ATTACHMENT_EXTENSIONS,
  ACCEPTED_ATTACHMENT_TYPES,
  MAX_ATTACHMENTS,
  MAX_ATTACHMENT_BYTES,
  ALL_BUILDINGS,
  accessReasonSchema,
  campaignDraftInputSchema,
  campaignInputSchema,
  campaignTestInputSchema,
  newMessageInputSchema,
  replyInputSchema,
  supportTicketInputSchema,
  validateAttachment,
} from './data/inputs';
export type {
  CampaignQuery,
  ConversationQuery,
  CreateSupportTicketInput,
  NewConversationInput,
  ReplyInput,
  SaveCampaignInput,
  SendCampaignTestInput,
  TicketPatch,
  TicketQuery,
} from './data/inputs';
export * from './data/schemas';
export {
  messagerieKeys,
  useCampaign,
  useCampaignAudiences,
  useCampaignBuildings,
  useCampaigns,
  useConversation,
  useConversations,
  useCreateConversation,
  useCreateSupportTicket,
  useHelpCenter,
  useInboxStats,
  useMyTicket,
  useMyTickets,
  useRecipients,
  useReplyToConversation,
  useReplyToMyTicket,
  useReplyToTicket,
  useRequestTicketAccess,
  useSaveCampaign,
  useSendCampaignTest,
  useSetConversationArchived,
  useSetConversationRead,
  useStaff,
  useSupportStatus,
  useTicket,
  useTicketStats,
  useTickets,
  useUpdateTicket,
} from './data/queries';
export type { ClientQuery } from './data/queries';

export { AttachmentChip, AttachmentList, AttachmentPicker, useAttachments } from './components/attachments';
export type { AttachmentChipProps, AttachmentPickerProps, AttachmentsState } from './components/attachments';
export { CampaignForm } from './components/CampaignForm';
export { CampaignList } from './components/CampaignList';
export type { CampaignListProps } from './components/CampaignList';
export { Composer } from './components/Composer';
export type { ComposerProps } from './components/Composer';
export { ContactSupportForm } from './components/ContactSupportForm';
export type { ContactSupportFormProps } from './components/ContactSupportForm';
export { ConversationList } from './components/ConversationList';
export type { ConversationListProps } from './components/ConversationList';
export { ConversationThread } from './components/ConversationThread';
export type { ConversationThreadProps } from './components/ConversationThread';
export { HelpCenter } from './components/HelpCenter';
export { MessageBubble } from './components/MessageBubble';
export type { MessageBubbleProps } from './components/MessageBubble';
export { MyTicketList, MyTicketThread } from './components/MyTickets';
export { NewMessageForm } from './components/NewMessageForm';
export type { NewMessageFormProps } from './components/NewMessageForm';
export { PageHeader } from './components/parts';
export type { PageHeaderProps } from './components/parts';
export { SupportWidget } from './components/SupportWidget';
export { TicketBoard, defaultTicketFilters } from './components/TicketBoard';
export type { TicketBoardProps, TicketFilters } from './components/TicketBoard';
export { TicketDetail } from './components/TicketDetail';

export { InboxPage } from './pages/InboxPage';
export { ConversationPage } from './pages/ConversationPage';
export { NewMessagePage } from './pages/NewMessagePage';
export { CampaignsPage, NewCampaignPage } from './pages/CampaignPages';
export { SupportBoardPage, TicketPage } from './pages/SupportPages';
export { HelpPage } from './pages/HelpPage';
