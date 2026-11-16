import { z } from 'zod';

export const hrefSchema = z.string().regex(/^\/[\w\-/]*$/);
const count = z.number().int().nonnegative();

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
    ownerName: z.string().min(1).optional(),
    role: z.string().min(1),
    plan: z.string().min(1).optional(),
    members: count.optional(),
  }),
  counts: z.record(z.string().min(1), count),
  notifications: z.array(
    z.object({
      id: z.string().min(1),
      tone: toneSchema,
      title: z.string().min(1),
      detail: z.string(),
      unread: z.boolean(),
      href: hrefSchema,
    }),
  ),
});
export type ShellData = z.infer<typeof shellSchema>;
export type ShellCounts = ShellData['counts'];
export type ShellNotification = ShellData['notifications'][number];
