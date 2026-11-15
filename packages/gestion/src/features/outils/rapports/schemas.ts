import { z } from 'zod';

const monthSchema = z.string().regex(/^\d{4}-\d{2}$/);

export const reportFormatSchema = z.enum(['PDF', 'CSV', 'Excel']);
export type ReportFormat = z.infer<typeof reportFormatSchema>;

export const historyEntrySchema = z.object({
  id: z.string(),
  slug: z.string(),
  label: z.string(),
  period: z.string(),
  scope: z.string(),
  generatedAt: z.iso.datetime({ offset: true }),
  format: reportFormatSchema,
});
export type HistoryEntry = z.infer<typeof historyEntrySchema>;

export const FREQUENCIES = [
  { value: 'weekly', label: 'Chaque semaine' },
  { value: 'monthly', label: 'Chaque mois' },
  { value: 'quarterly', label: 'Chaque trimestre' },
] as const;

export const frequencySchema = z.enum(['weekly', 'monthly', 'quarterly']);
export type Frequency = z.infer<typeof frequencySchema>;

export const scheduleSchema = z.object({
  id: z.string(),
  slug: z.string(),
  label: z.string(),
  recipient: z.string(),
  frequency: frequencySchema,
  nextRun: z.iso.date(),
});
export type Schedule = z.infer<typeof scheduleSchema>;

export const overviewSchema = z.object({
  favorites: z.array(z.string()),
  history: z.array(historyEntrySchema),
  schedules: z.array(scheduleSchema),
});
export type Overview = z.infer<typeof overviewSchema>;

export const loyerLotSchema = z.object({
  id: z.string(),
  name: z.string(),
  buildingId: z.string(),
  buildingName: z.string(),
  tenantId: z.string(),
  tenantName: z.string(),
  rent: z.number().int(),
  startMonth: monthSchema,
  payments: z.array(z.object({ month: monthSchema, amount: z.number().int() })),
});
export type LoyerLot = z.infer<typeof loyerLotSchema>;

export const loyersDataSchema = z.object({
  generatedAt: z.iso.datetime({ offset: true }),
  today: z.iso.date(),
  lots: z.array(loyerLotSchema),
});
export type LoyersData = z.infer<typeof loyersDataSchema>;

const recipientField = z.string().trim().min(1, 'Saisissez une adresse e-mail.').pipe(z.email('Adresse e-mail invalide, par exemple nom@exemple.com.'));

export const scheduleFormSchema = z.object({
  recipient: recipientField,
  frequency: frequencySchema,
});
export type ScheduleInput = z.infer<typeof scheduleFormSchema> & { slug: string; label: string };

export const emailFormSchema = z.object({
  recipient: recipientField,
  subject: z.string().trim().min(1, 'Saisissez un objet.').max(120, 'Objet limité à 120 caractères.'),
  message: z.string().trim().max(1000, 'Message limité à 1 000 caractères.'),
});
export type EmailInput = z.infer<typeof emailFormSchema>;
