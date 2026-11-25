import type { ApiClient } from '@eguardimmo/api';
import { z } from 'zod';
import { CONSOLE_ROOT, count, dataOf, nullableDateTime, parse, read, segment } from '../transport';

export const REMINDER_CATEGORIES = ['account', 'journey', 'tenant', 'team'] as const;

const channelSettingSchema = z.object({
  channel: z.string().min(1),
  label: z.string(),
  enabled: z.boolean(),
  locked: z.boolean(),
  default: z.boolean(),
});

const typeSchema = z.object({
  type: z.string().min(1),
  label: z.string(),
  group: z.string(),
  audience: z.string().min(1),
  audience_label: z.string(),
  channels: z.array(channelSettingSchema),
});

const reminderSchema = z.object({
  code: z.string().min(1),
  label: z.string(),
  description: z.string(),
  category: z.enum(REMINDER_CATEGORIES),
  category_label: z.string(),
  timing: z.enum(['after', 'before']),
  enabled: z.boolean(),
  delay_days: count,
  delay_min: count,
  delay_max: count,
  repeat_every_days: count.nullable(),
  max_occurrences: count,
  occurrences_limit: count,
  channels: z.array(z.string()),
  available_channels: z.array(z.string()),
  last_run_at: nullableDateTime,
  last_sent_count: count.nullable(),
  updated_at: nullableDateTime,
});

export type NotificationTypeSetting = z.infer<typeof typeSchema>;
export type Reminder = z.infer<typeof reminderSchema>;

export interface TypeChange {
  type: string;
  channel: string;
  enabled: boolean;
}

export interface ReminderInput {
  enabled: boolean;
  delay_days: number;
  repeat_every_days: number | null;
  max_occurrences: number;
  channels: string[];
}

export interface NotificationSettingsApi {
  types: () => Promise<NotificationTypeSetting[]>;
  updateTypes: (changes: TypeChange[]) => Promise<NotificationTypeSetting[]>;
  reminders: () => Promise<Reminder[]>;
  updateReminder: (code: string, input: ReminderInput) => Promise<Reminder>;
}

export function notificationSettingsApi(client: ApiClient): NotificationSettingsApi {
  const types = dataOf(z.array(typeSchema));
  return {
    types: async () => (await read(client, '/notifications/types', types)).data,
    updateTypes: async (changes) => parse(types, await client.put(`${CONSOLE_ROOT}/notifications/types`, { changes })).data,
    reminders: async () => (await read(client, '/notifications/reminders', dataOf(z.array(reminderSchema)))).data,
    updateReminder: async (code, input) =>
      parse(dataOf(reminderSchema), await client.put(`${CONSOLE_ROOT}/notifications/reminders/${segment(code)}`, { ...input })).data,
  };
}
