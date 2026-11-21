import { z } from 'zod';
import type { PlanningTask, TaskInput } from '../model';

const DATE = /^\d{4}-\d{2}-\d{2}$/;
const MIN_DATE = '2000-01-01';
const MAX_DATE = '2100-01-01';
const isRealDate = (value: string): boolean => DATE.test(value) && new Date(`${value}T00:00:00Z`).toISOString().slice(0, 10) === value;

export const dueDateSchema = z.string().refine((value) => isRealDate(value) && value > MIN_DATE && value < MAX_DATE, 'Indiquez une échéance valide.');

export const taskFormSchema = z
  .object({
    title: z.string().trim().min(1, 'Indiquez un titre.').max(120, 'Le titre ne peut pas dépasser 120 caractères.').regex(/^[^<>]*$/, 'Le titre ne peut pas contenir les caractères < et >.'),
    dueOn: dueDateSchema,
    assigneeUserId: z.string(),
    remindDaysBefore: z
      .string()
      .trim()
      .transform((text, context) => {
        if (text === '') return null;
        const days = Number(text);
        if (!/^\d+$/.test(text) || days > 90) {
          context.addIssue({ code: 'custom', message: 'Indiquez un nombre de jours entre 0 et 90.' });
          return z.NEVER;
        }
        return days;
      }),
    propertyId: z.string(),
    unitId: z.string(),
    leaseId: z.string(),
  })
  .refine((values) => values.unitId === '' || values.propertyId !== '', { path: ['unitId'], message: 'Choisissez d’abord le bien du lot.' });

export type TaskFormValues = z.input<typeof taskFormSchema>;
export type TaskFormOutput = z.output<typeof taskFormSchema>;

export function toTaskInput(values: TaskFormOutput): TaskInput {
  return { title: values.title, dueOn: values.dueOn, assigneeUserId: values.assigneeUserId, remindDaysBefore: values.remindDaysBefore, propertyId: values.propertyId, unitId: values.unitId, leaseId: values.leaseId };
}

export function taskToFormValues(task: PlanningTask): TaskFormValues {
  return {
    title: task.title,
    dueOn: task.dueOn,
    assigneeUserId: task.assigneeUserId ?? '',
    remindDaysBefore: task.remindDaysBefore === null ? '' : String(task.remindDaysBefore),
    propertyId: task.propertyId ?? '',
    unitId: task.unitId ?? '',
    leaseId: task.leaseId ?? '',
  };
}

export const postponeSchema = z.object({ dueOn: dueDateSchema });
export const assignSchema = z.object({ assigneeUserId: z.string().min(1, 'Choisissez le nouveau responsable.') });
