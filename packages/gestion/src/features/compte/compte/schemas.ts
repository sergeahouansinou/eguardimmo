import { z } from 'zod';
import { DEMO_TODAY } from '../../outils/kit';

export const LANDLORD_TYPES = ['particulier', 'societe'] as const;
export const CIVILITIES = ['mme', 'm'] as const;

function validBirthDate(value: string): boolean {
  const match = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(value);
  if (!match) return false;
  const [, day, month, year] = match;
  const iso = `${year ?? ''}-${month ?? ''}-${day ?? ''}`;
  const date = new Date(`${iso}T12:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === iso && iso < DEMO_TODAY;
}

export const profileFormSchema = z
  .object({
    landlordType: z.enum(LANDLORD_TYPES),
    civility: z.enum(CIVILITIES),
    firstName: z.string().trim().min(1, 'Saisissez le prénom.').max(60, '60 caractères au maximum.'),
    lastName: z.string().trim().min(1, 'Saisissez le nom.').max(60, '60 caractères au maximum.'),
    birthDate: z.string().trim().refine((value) => value === '' || validBirthDate(value), 'Saisissez une date passée au format jj/mm/aaaa.'),
    birthPlace: z.string().trim().max(80, '80 caractères au maximum.'),
    companyName: z.string().trim().max(120, '120 caractères au maximum.'),
    siren: z
      .string()
      .trim()
      .refine((value) => value === '' || /^\d{3} ?\d{3} ?\d{3}$/.test(value), 'Le SIREN compte 9 chiffres, par exemple 912 345 678.'),
    vatNumber: z
      .string()
      .trim()
      .refine((value) => value === '' || /^[A-Z]{2}[0-9A-Z]{2,12}$/.test(value), 'Format attendu : FR40912345678, sans espace.'),
    phone: z
      .string()
      .trim()
      .min(1, 'Saisissez un téléphone mobile.')
      .regex(/^\+?\d[\d ]{7,17}$/, 'Saisissez un numéro valide, par exemple +33 6 00 00 00 09.'),
    address: z.string().trim().min(5, "Saisissez l'adresse complète.").max(200, '200 caractères au maximum.'),
  })
  .superRefine((value, context) => {
    if (value.landlordType === 'societe' && value.companyName === '') {
      context.addIssue({ code: 'custom', path: ['companyName'], message: 'Saisissez la raison sociale.' });
    }
  });
export type ProfileForm = z.infer<typeof profileFormSchema>;

export const profileSchema = z.object({
  form: profileFormSchema,
  email: z.email(),
  security: z.object({
    passwordChangedAt: z.iso.date(),
    twoFactorMethod: z.string().min(1),
    twoFactorEnabled: z.boolean(),
    sessions: z.number().int().nonnegative(),
  }),
});
export type Profile = z.infer<typeof profileSchema>;

export const PLAN_IDS = ['gratuit', 'silver', 'gold'] as const;
export type PlanId = (typeof PLAN_IDS)[number];
export const BILLINGS = ['mensuel', 'annuel'] as const;
export type Billing = (typeof BILLINGS)[number];

export const subscriptionSchema = z.object({
  planId: z.enum(PLAN_IDS),
  billing: z.enum(BILLINGS),
  nextChargeDate: z.iso.date(),
  cancelAt: z.iso.date().nullable(),
  paymentMethod: z.object({ brand: z.string().min(1), last4: z.string().regex(/^\d{4}$/) }),
  usage: z.object({
    lots: z.number().int().nonnegative(),
    users: z.number().int().nonnegative(),
    signatures: z.number().int().nonnegative(),
    storageMb: z.number().int().nonnegative(),
  }),
});
export type Subscription = z.infer<typeof subscriptionSchema>;

export const invoiceSchema = z.object({
  id: z.string().min(1),
  date: z.iso.date(),
  amount: z.number().int().nonnegative(),
  status: z.enum(['payee', 'en-attente']),
  planId: z.enum(PLAN_IDS),
  billing: z.enum(BILLINGS),
});
export type Invoice = z.infer<typeof invoiceSchema>;
export const invoicesSchema = z.array(invoiceSchema);

export const changePlanSchema = z.object({ planId: z.enum(PLAN_IDS), billing: z.enum(BILLINGS) });
export type ChangePlanInput = z.infer<typeof changePlanSchema>;
