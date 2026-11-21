import { z } from 'zod';
import { planAudienceSchema, planInputSchema } from '@/console/schemas';
import type { PlanInput } from '@/console/schemas';
import { optionalWholeNumber, wholeNumber } from '@/lib/formFields';
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
  audience: planAudienceSchema,
  description: z.string().trim().max(200, '200 caractères au plus.'),
  monthly: euros('Prix mensuel'),
  yearly: euros('Prix annuel'),
  trialDays: whole('Essai', 0, 90),
  users: optionalWholeNumber('Utilisateurs', 1, 10_000),
  lots: optionalWholeNumber('Lots', 1, 100_000),
  tenants: optionalWholeNumber('Locataires', 1, 1_000_000),
  leases: optionalWholeNumber('Baux', 1, 1_000_000),
  inspections: optionalWholeNumber('États des lieux', 1, 1_000_000),
  storageMb: whole('Stockage', 1, 100_000_000),
  signaturesMonth: optionalWholeNumber('Signatures', 1, 1_000_000),
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
    limits: {
      users: values.users,
      lots: values.lots,
      tenants: values.tenants,
      leases: values.leases,
      inspections: values.inspections,
      storageMb: values.storageMb,
      signaturesMonth: values.signaturesMonth,
    },
    moduleIds,
    publicSignup: values.publicSignup,
  });
}
