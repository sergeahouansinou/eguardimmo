import { z } from 'zod';

export const identityResponseSchema = z.object({
  data: z.object({
    id: z.string().min(1),
    name: z.string().min(1),
    email: z.string().min(1),
    email_verified_at: z.string().nullable(),
    last_login_at: z.string().nullable(),
    previous_login_at: z.string().nullable(),
  }),
});

export const securityResponseSchema = z.object({
  data: z.object({
    email: z.string().min(1),
    email_verified: z.boolean(),
    has_password: z.boolean(),
    two_factor: z.object({
      enabled: z.boolean(),
      enabled_at: z.string().nullable(),
      backup_codes_remaining: z.number().int().min(0),
      backup_codes_total: z.number().int().min(0),
    }),
    linked_accounts: z.array(
      z.object({
        provider: z.enum(['google', 'apple']),
        linked: z.boolean(),
        email: z.string().nullable(),
        linked_at: z.string().nullable(),
      }),
    ),
  }),
});

export const devicesResponseSchema = z.object({
  data: z.array(
    z.object({
      id: z.string().min(1),
      name: z.string().min(1),
      last_used_at: z.string().nullable(),
      created_at: z.string().nullable(),
      expires_at: z.string().nullable(),
      current: z.boolean(),
    }),
  ),
});
