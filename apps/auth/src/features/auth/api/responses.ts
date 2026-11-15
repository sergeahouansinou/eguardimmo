import { z } from "zod";

export const meResponseSchema = z.object({
  data: z.object({
    id: z.string().min(1),
    name: z.string().min(1),
    email: z.string().min(1),
    email_verified_at: z.string().nullable(),
  }),
});

export const loginResponseSchema = z.object({ two_factor: z.boolean() });

export const secretKeyResponseSchema = z.object({ secretKey: z.string().min(1) });

export const qrCodeResponseSchema = z.object({ url: z.string().min(1) });

export const recoveryCodesResponseSchema = z.array(z.string().min(1)).min(1);

export const resetStatusResponseSchema = z.object({ data: z.object({ status: z.enum(["valid", "expired"]) }) });

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
        provider: z.enum(["google", "apple"]),
        linked: z.boolean(),
        email: z.string().nullable(),
        linked_at: z.string().nullable(),
      }),
    ),
    devices: z.array(
      z.object({
        id: z.string().min(1),
        name: z.string().min(1),
        type: z.enum(["mobile", "navigateur"]),
        last_activity_at: z.string(),
        current: z.boolean(),
      }),
    ),
    confirmed_until: z.string().nullable(),
    confirmed_with_code_until: z.string().nullable(),
  }),
});
