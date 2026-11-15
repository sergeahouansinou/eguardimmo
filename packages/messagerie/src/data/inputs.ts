import { z } from 'zod';
import { ticketCategorySchema } from './schemas';
import type { CampaignPeriod, ConversationTab, TicketCategory, TicketPriority, TicketStatus, TicketTab } from './schemas';

export const MAX_ATTACHMENT_BYTES = 10 * 1024 * 1024;
export const MAX_ATTACHMENTS = 5;
export const ACCEPTED_ATTACHMENT_TYPES: readonly string[] = [
  'application/pdf',
  'image/jpeg',
  'image/png',
  'image/webp',
];
export const ACCEPTED_ATTACHMENT_EXTENSIONS = '.pdf,.jpg,.jpeg,.png,.webp';

const body = z
  .string()
  .trim()
  .min(1, 'Saisissez votre message')
  .max(5000, '5 000 caractères au maximum');

const subject = z.string().trim().min(1, 'Saisissez un sujet').max(140, '140 caractères au maximum');

export const replyInputSchema = z.object({ body });

export const newMessageInputSchema = z.object({
  recipientId: z.string().min(1, 'Choisissez un destinataire'),
  linkId: z.string(),
  subject,
  body,
});

const audienceId = z.string().min(1, 'Choisissez les destinataires');

export const campaignDraftInputSchema = z.object({ audienceId, subject });

export const campaignBuildingsSchema = z.array(z.string().min(1)).min(1, 'Ajoutez au moins un immeuble');

export const campaignTestInputSchema = z.object({ subject, body });

export const campaignInputSchema = z
  .object({
    audienceId,
    subject,
    body,
    mode: z.enum(['now', 'scheduled']),
    scheduledAt: z.string(),
    copyToHistory: z.boolean(),
  })
  .refine((value) => value.mode === 'now' || value.scheduledAt.length > 0, {
    path: ['scheduledAt'],
    message: 'Choisissez la date et l’heure d’envoi',
  });

export const supportTicketInputSchema = z.object({
  category: ticketCategorySchema,
  subject,
  body,
});

export const accessReasonSchema = z.object({
  reason: z.string().trim().min(10, 'Indiquez un motif d’au moins 10 caractères').max(500, '500 caractères au maximum'),
});

export interface ConversationQuery {
  tab: ConversationTab;
  search: string;
  page: number;
  pageSize: number;
}

export interface ReplyInput {
  body: string;
  attachments: File[];
  internal?: boolean;
}

export interface NewConversationInput {
  recipientId: string;
  linkId: string | null;
  subject: string;
  body: string;
  attachments: File[];
}

export const ALL_BUILDINGS = 'all';

export interface CampaignQuery {
  tab: 'all' | 'envoyee' | 'programmee' | 'brouillon';
  search: string;
  building: string;
  period: CampaignPeriod;
  page: number;
  pageSize: number;
}

export interface SaveCampaignInput {
  id: string | null;
  audienceId: string;
  buildingIds: string[];
  subject: string;
  body: string;
  mode: 'now' | 'scheduled' | 'draft';
  scheduledAt: string | null;
  copyToHistory: boolean;
  attachments: File[];
}

export interface SendCampaignTestInput {
  subject: string;
  body: string;
  attachments: File[];
}

export interface TicketQuery {
  tab: TicketTab;
  search: string;
  priority: TicketPriority | 'toutes';
  assigneeId: string;
  page: number;
  pageSize: number;
}

export interface TicketPatch {
  status?: TicketStatus;
  priority?: TicketPriority;
  assigneeId?: string | null;
}

export interface CreateSupportTicketInput {
  category: TicketCategory;
  subject: string;
  body: string;
  attachments: File[];
}

export function validateAttachment(file: Pick<File, 'name' | 'size' | 'type'>): string | null {
  if (!ACCEPTED_ATTACHMENT_TYPES.includes(file.type)) {
    return `« ${file.name} » : seuls les PDF et les images (JPEG, PNG, WebP) sont acceptés.`;
  }
  if (file.size === 0) return `« ${file.name} » est vide.`;
  if (file.size > MAX_ATTACHMENT_BYTES) return `« ${file.name} » dépasse 10 Mo.`;
  return null;
}
