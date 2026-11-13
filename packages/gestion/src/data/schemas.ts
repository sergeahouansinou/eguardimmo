import { z } from 'zod';
import { CURRENCIES } from '../format/money';

const minor = z.number().int();
const count = z.number().int().nonnegative();
const isoDate = z.iso.date();
const isoDateTime = z.iso.datetime({ offset: true });
const yearMonth = z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/);
const href = z.string().regex(/^\/[\w\-/]*$/);

export const toneSchema = z.enum(['danger', 'warning', 'info', 'success', 'neutral']);
export type Tone = z.infer<typeof toneSchema>;

export const shellSchema = z.object({
  user: z.object({
    firstName: z.string().min(1),
    fullName: z.string().min(1),
    initials: z.string().min(1).max(2),
    email: z.email(),
  }),
  workspace: z.object({
    name: z.string().min(1),
    ownerName: z.string().min(1),
    role: z.enum(['admin', 'gestionnaire', 'agent']),
    plan: z.string().min(1),
    members: count,
  }),
  counts: z.object({
    lots: count,
    tenants: count,
    unreadMessages: count,
    openInterventions: count,
  }),
  notifications: z.array(
    z.object({
      id: z.string().min(1),
      tone: toneSchema,
      title: z.string().min(1),
      detail: z.string(),
      unread: z.boolean(),
      href,
    }),
  ),
});
export type ShellData = z.infer<typeof shellSchema>;
export type ShellNotification = ShellData['notifications'][number];

export const todoCategorySchema = z.enum(['finances', 'baux', 'suivi', 'compte']);
export type TodoCategory = z.infer<typeof todoCategorySchema>;

export const todoKindSchema = z.enum([
  'impaye',
  'retard',
  'fin_de_bail',
  'revision',
  'intervention',
  'assurance',
  'profil',
]);
export type TodoKind = z.infer<typeof todoKindSchema>;

export const bureauSchema = z.object({
  generatedAt: isoDateTime,
  currency: z.enum(CURRENCIES),
  collection: z.object({ called: minor, collected: minor }),
  arrears: z.object({ amount: minor, tenants: count, beyond30Days: count }),
  occupancy: z.object({ rented: count, total: count }),
  cashflow: z.object({ net: minor, previousNet: minor }),
  todos: z.array(
    z.object({
      id: z.string().min(1),
      category: todoCategorySchema,
      kind: todoKindSchema,
      tone: toneSchema,
      urgent: z.boolean(),
      title: z.string().min(1),
      detail: z.string(),
      badge: z.object({ label: z.string().min(1), tone: toneSchema }).optional(),
      action: z.object({ label: z.string().min(1), href }),
    }),
  ),
  today: z.array(z.object({ id: z.string().min(1), time: z.string().regex(/^\d{2}:\d{2}$/), title: z.string().min(1), detail: z.string() })),
  deadlines: z.array(z.object({ id: z.string().min(1), date: isoDate, title: z.string().min(1), detail: z.string() })),
  rentHistory: z.array(z.object({ month: yearMonth, called: minor, collected: minor })).max(12),
  recentPayments: z.array(
    z.object({
      id: z.string().min(1),
      date: isoDate,
      tenant: z.string().min(1),
      unit: z.string().min(1),
      method: z.enum(['virement', 'prelevement', 'especes', 'cheque', 'mobile_money', 'carte']),
      partial: z.boolean(),
      amount: minor,
    }),
  ),
});
export type BureauData = z.infer<typeof bureauSchema>;
export type BureauTodo = BureauData['todos'][number];
