import { z } from 'zod';

const count = z.number().int().nonnegative();
const id = z.string().min(1);
const isoDateTime = z.iso.datetime({ offset: true });
const href = z.string().regex(/^\/[\w\-/]*$/);

export const participantRoleSchema = z.enum([
  'locataire',
  'mandant',
  'proprietaire',
  'agence',
  'gestionnaire',
  'bailleur',
  'support',
  'operateur',
]);
export type ParticipantRole = z.infer<typeof participantRoleSchema>;

export const participantSchema = z.object({
  id,
  name: z.string().min(1),
  initials: z.string().min(1).max(2),
  role: participantRoleSchema,
  detail: z.string().optional(),
});
export type Participant = z.infer<typeof participantSchema>;

export const attachmentSchema = z.object({
  id,
  name: z.string().min(1),
  sizeBytes: count,
  mimeType: z.string().min(1),
});
export type Attachment = z.infer<typeof attachmentSchema>;

export const linkedObjectKindSchema = z.enum(['bail', 'bien', 'mandat', 'intervention', 'devis', 'incident']);
export type LinkedObjectKind = z.infer<typeof linkedObjectKindSchema>;

export const linkedObjectSchema = z.object({
  kind: linkedObjectKindSchema,
  label: z.string().min(1),
  href,
});
export type LinkedObject = z.infer<typeof linkedObjectSchema>;

export const messageSchema = z.object({
  id,
  authorId: id,
  body: z.string().min(1),
  sentAt: isoDateTime,
  attachments: z.array(attachmentSchema),
  internal: z.boolean(),
});
export type Message = z.infer<typeof messageSchema>;

export const conversationTabSchema = z.enum(['all', 'unread', 'awaiting', 'sent', 'archived', 'mandant', 'locataire']);
export type ConversationTab = z.infer<typeof conversationTabSchema>;

export const conversationSummarySchema = z.object({
  id,
  subject: z.string().min(1),
  counterpart: participantSchema,
  tag: z.string().optional(),
  preview: z.string(),
  lastMessageAt: isoDateTime,
  lastAuthorId: id,
  unread: z.boolean(),
  archived: z.boolean(),
  awaitingReply: z.boolean(),
  messageCount: count,
  hasAttachments: z.boolean(),
});
export type ConversationSummary = z.infer<typeof conversationSummarySchema>;

export const conversationListSchema = z.object({
  viewerId: id,
  items: z.array(conversationSummarySchema),
  total: count,
  page: z.number().int().positive(),
  pageSize: z.number().int().positive(),
  counts: z.record(conversationTabSchema, count),
});
export type ConversationList = z.infer<typeof conversationListSchema>;

export const contextRowSchema = z.object({ label: z.string().min(1), value: z.string().min(1) });
export type ContextRow = z.infer<typeof contextRowSchema>;

export const conversationDetailSchema = conversationSummarySchema.extend({
  viewerId: id,
  participants: z.array(participantSchema).min(1),
  messages: z.array(messageSchema).min(1),
  context: z.array(contextRowSchema),
  links: z.array(linkedObjectSchema),
});
export type ConversationDetail = z.infer<typeof conversationDetailSchema>;

export const recipientSchema = participantSchema.extend({
  linkOptions: z.array(z.object({ id, label: z.string().min(1) })),
});
export type Recipient = z.infer<typeof recipientSchema>;

export const inboxStatsSchema = z.object({
  unread: count,
  unreadByRole: z.partialRecord(participantRoleSchema, count),
  stale: z.object({ count, detail: z.string().nullable() }),
  averageReplyLabel: z.string().min(1),
});
export type InboxStats = z.infer<typeof inboxStatsSchema>;

export const campaignStatusSchema = z.enum(['envoyee', 'programmee', 'brouillon']);
export type CampaignStatus = z.infer<typeof campaignStatusSchema>;

export const campaignSchema = z.object({
  id,
  title: z.string().min(1),
  audienceId: id,
  audienceLabel: z.string().min(1),
  recipientCount: count,
  status: campaignStatusSchema,
  sentAt: isoDateTime.nullable(),
  scheduledAt: isoDateTime.nullable(),
  readCount: count.nullable(),
  failedCount: count,
  subject: z.string(),
  body: z.string(),
});
export type Campaign = z.infer<typeof campaignSchema>;

export const campaignListSchema = z.object({
  items: z.array(campaignSchema),
  total: count,
  page: z.number().int().positive(),
  pageSize: z.number().int().positive(),
  counts: z.record(z.enum(['all', 'envoyee', 'programmee', 'brouillon']), count),
  stats: z.object({
    thisMonth: count,
    scheduled: count,
    readRatePercent: z.number().int().min(0).max(100).nullable(),
    readSummary: z.string(),
    failures: count,
    failureDetail: z.string().nullable(),
  }),
});
export type CampaignListResult = z.infer<typeof campaignListSchema>;

export const campaignAudienceSchema = z.object({
  id,
  label: z.string().min(1),
  detail: z.string().min(1),
  count,
  withoutEmail: count,
});
export type CampaignAudience = z.infer<typeof campaignAudienceSchema>;

export const ticketStatusSchema = z.enum(['ouvert', 'en_attente', 'resolu']);
export type TicketStatus = z.infer<typeof ticketStatusSchema>;

export const ticketPrioritySchema = z.enum(['haute', 'normale', 'basse']);
export type TicketPriority = z.infer<typeof ticketPrioritySchema>;

export const ticketCategorySchema = z.enum(['messagerie', 'facturation', 'compte', 'documents', 'autre']);
export type TicketCategory = z.infer<typeof ticketCategorySchema>;

export const ticketSummarySchema = z.object({
  id,
  reference: z.string().min(1),
  subject: z.string().min(1),
  organization: z.string().min(1),
  requester: participantSchema,
  assigneeId: id.nullable(),
  assigneeName: z.string().nullable(),
  priority: ticketPrioritySchema,
  status: ticketStatusSchema,
  category: ticketCategorySchema,
  createdAt: isoDateTime,
  updatedAt: isoDateTime,
  messageCount: count,
});
export type TicketSummary = z.infer<typeof ticketSummarySchema>;

export const ticketAccessSchema = z.object({
  reason: z.string().min(1),
  grantedAt: isoDateTime,
  expiresAt: isoDateTime,
});
export type TicketAccess = z.infer<typeof ticketAccessSchema>;

export const ticketDetailSchema = ticketSummarySchema.extend({
  viewerId: id,
  participants: z.array(participantSchema).min(1),
  messages: z.array(messageSchema).min(1),
  firstResponseLabel: z.string().nullable(),
  linked: z.array(z.object({ id, label: z.string().min(1), detail: z.string(), tone: z.enum(['neutral', 'warning', 'info']) })),
  access: ticketAccessSchema.nullable(),
});
export type TicketDetail = z.infer<typeof ticketDetailSchema>;

export const ticketTabSchema = z.enum(['ouvert', 'en_attente', 'resolu', 'tous']);
export type TicketTab = z.infer<typeof ticketTabSchema>;

export const ticketListSchema = z.object({
  items: z.array(ticketSummarySchema),
  total: count,
  page: z.number().int().positive(),
  pageSize: z.number().int().positive(),
  counts: z.record(ticketTabSchema, count),
});
export type TicketList = z.infer<typeof ticketListSchema>;

export const ticketStatsSchema = z.object({
  open: count,
  openHigh: count,
  waiting: count,
  waitingDetail: z.string(),
  firstResponse: z.string().min(1),
  firstResponseDetail: z.string(),
  resolved30d: count,
  satisfaction: z.string(),
});
export type TicketStats = z.infer<typeof ticketStatsSchema>;

export const staffMemberSchema = z.object({ id, name: z.string().min(1) });
export type StaffMember = z.infer<typeof staffMemberSchema>;

export const supportStatusSchema = z.object({
  online: z.boolean(),
  hoursLabel: z.string().min(1),
  responseLabel: z.string().min(1),
});
export type SupportStatus = z.infer<typeof supportStatusSchema>;

export const helpArticleSchema = z.object({
  id,
  question: z.string().min(1),
  answer: z.string(),
  href: href.optional(),
  hrefLabel: z.string().optional(),
});
export type HelpArticle = z.infer<typeof helpArticleSchema>;

export const helpCategorySchema = z.object({
  id,
  title: z.string().min(1),
  articles: z.array(helpArticleSchema),
});
export type HelpCategory = z.infer<typeof helpCategorySchema>;

export const helpContactRowSchema = z.object({ label: z.string().min(1), value: z.string().min(1) });
export type HelpContactRow = z.infer<typeof helpContactRowSchema>;

export const helpCenterSchema = z.object({
  categories: z.array(helpCategorySchema),
  contactTitle: z.string().min(1),
  contact: z.array(helpContactRowSchema),
  emergencyTitle: z.string().nullable(),
  emergency: z.array(helpContactRowSchema),
});
export type HelpCenterData = z.infer<typeof helpCenterSchema>;
