import { z } from 'zod';
import { ASSIGNEES, BIEN_IDS } from '../shared/biens';
import { isoDateSchema } from '../shared/schemas';

export const CHANNELS = ['email', 'notification'] as const;
export type Channel = (typeof CHANNELS)[number];

export const channelLabels: Record<Channel, string> = { email: 'E-mail', notification: 'Notification' };

const reminderSchema = z.object({
  channel: z.enum(CHANNELS),
  daysBefore: z.number().int().min(0).max(90),
});

export const taskInputSchema = z.object({
  title: z.string().trim().min(1, 'Indiquez le sujet de la tâche.').max(120, 'Le sujet ne dépasse pas 120 caractères.'),
  bienId: z.enum(BIEN_IDS, { error: 'Choisissez le bien concerné.' }),
  assignee: z.enum(ASSIGNEES, { error: 'Choisissez la personne assignée.' }),
  dueDate: isoDateSchema,
  reminder: reminderSchema.nullable(),
});
export type TaskInput = z.infer<typeof taskInputSchema>;

export const taskSchema = taskInputSchema.extend({
  id: z.string().min(1),
  done: z.boolean(),
});
export type Task = z.infer<typeof taskSchema>;

export const taskListSchema = z.array(taskSchema);

export function reminderLabel(reminder: Task['reminder']): string {
  if (!reminder) return 'Aucun';
  const delay =
    reminder.daysBefore === 0 ? 'le jour même' : `${String(reminder.daysBefore)} jour${reminder.daysBefore > 1 ? 's' : ''} avant`;
  return `${channelLabels[reminder.channel]}, ${delay}`;
}
