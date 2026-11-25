import { z } from 'zod';
import { toneSchema } from '../../data/schemas';

export const notificationSchema = z.object({
  id: z.string().min(1),
  type: z.string().min(1),
  tone: toneSchema,
  title: z.string(),
  detail: z.string(),
  unread: z.boolean(),
  href: z.string().nullable(),
  organization_id: z.string().nullable(),
  created_at: z.string().min(1),
  read_at: z.string().nullable(),
});

export const notificationPageSchema = z.object({
  data: z.array(notificationSchema),
  meta: z.object({ next_cursor: z.string().nullable() }),
});

export const notificationResponseSchema = z.object({ data: notificationSchema });

export const unreadCountSchema = z.object({ data: z.object({ unread: z.number().int().min(0) }) });

export const readAllSchema = z.object({ data: z.object({ updated: z.number().int().min(0) }) });

export const CHANNELS = ['in_app', 'email', 'push'] as const;

export const AUDIENCES = ['staff', 'tenant', 'owner', 'account'] as const;

export const preferencesSchema = z.object({
  data: z.object({
    types: z.array(
      z.object({
        type: z.string().min(1),
        label: z.string().min(1),
        group: z.string().min(1),
        audience: z.enum(AUDIENCES),
        channels: z.array(
          z.object({
            channel: z.enum(CHANNELS),
            label: z.string().min(1),
            enabled: z.boolean(),
            locked: z.boolean(),
          }),
        ),
      }),
    ),
  }),
});
