import { z } from "zod";

export const profileSchema = z.object({
  data: z
    .object({
      id: z.uuid(),
      name: z.string(),
      email: z.email(),
      email_verified_at: z.string().nullable(),
      phone: z.string().nullable(),
      last_login_at: z.string().nullable(),
      previous_login_at: z.string().nullable(),
    })
    .transform((user) => ({ id: user.id, name: user.name, email: user.email, emailVerified: user.email_verified_at !== null, phone: user.phone })),
});

export type AccountProfile = z.output<typeof profileSchema>["data"];

export const emailChangeSchema = z.object({ data: z.object({ status: z.literal("code_sent"), expires_in_minutes: z.number().int().positive() }) });
