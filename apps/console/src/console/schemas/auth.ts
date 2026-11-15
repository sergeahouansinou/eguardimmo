import { z } from 'zod';

export const loginInputSchema = z.object({
  email: z.email('Saisissez une adresse e-mail valide.'),
  password: z.string().min(1, 'Saisissez votre mot de passe.'),
  code: z
    .string()
    .transform((value) => value.replace(/\s/g, ''))
    .refine((value) => /^\d{6}$/.test(value), 'Le code comporte 6 chiffres.'),
});
export type LoginInput = z.input<typeof loginInputSchema>;

export const loginResultSchema = z.discriminatedUnion('status', [
  z.object({ status: z.literal('ok') }),
  z.object({ status: z.literal('invalid') }),
  z.object({ status: z.literal('locked'), retryAfterSeconds: z.number().int().positive() }),
]);
export type LoginResult = z.infer<typeof loginResultSchema>;

export const LOGIN_FAILURE_MESSAGE = 'Identifiants ou code invalides.';
export const LOGIN_LOCK_THRESHOLD = 5;
export const LOGIN_LOCK_SECONDS = 15 * 60;
