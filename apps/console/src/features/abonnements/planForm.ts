import { z } from 'zod';
import { organisationTypeSchema, planInputSchema } from '@/console/schemas';
import type { PlanInput } from '@/console/schemas';
import { wholeNumber } from '@/lib/formFields';
import { parseEurosToMinor } from '@/lib/format';

const euros = (label: string) =>
  z
    .string()
    .trim()
    .transform((value, context) => {
      const minor = parseEurosToMinor(value);
      if (minor === null) {
        context.addIssue({ code: 'custom', message: `${label} invalide, exemple : 199,00` });
        return z.NEVER;
      }
      return minor;
    });

const whole = wholeNumber;

export const planFormSchema = z.object({
  name: z.string().trim().min(2, 'Le nom doit comporter au moins 2 caractères.').max(60),
  code: z
    .string()
    .trim()
    .regex(/^[a-z][a-z0-9-]{1,30}$/, 'Code en minuscules, chiffres et tirets (2 à 31 caractères).'),
  audience: organisationTypeSchema,
  description: z.string().trim().max(200, '200 caractères au plus.'),
  monthly: euros('Prix mensuel'),
  yearly: euros('Prix annuel'),
  trialDays: whole('Essai', 0, 90),
  users: whole('Utilisateurs', 1, 10_000),
  lots: whole('Lots', 1, 100_000),
  storageGb: whole('Stockage', 1, 100_000),
  emailsMonth: whole('E-mails', 1, 10_000_000),
  publicSignup: z.boolean(),
});

export type PlanFormInput = z.input<typeof planFormSchema>;
export type PlanFormValues = z.output<typeof planFormSchema>;

export function toPlanInput(values: PlanFormValues, moduleIds: string[]): PlanInput {
  return planInputSchema.parse({
    name: values.name,
    code: values.code,
    audience: values.audience,
    description: values.description,
    monthlyMinor: values.monthly,
    yearlyMinor: values.yearly,
    trialDays: values.trialDays,
    limits: { users: values.users, lots: values.lots, storageGb: values.storageGb, emailsMonth: values.emailsMonth },
    moduleIds,
    publicSignup: values.publicSignup,
  });
}
