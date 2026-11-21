import { z } from 'zod';
import { count, idSchema, isoDateSchema, isoDateTimeSchema, minorSchema, pageOf } from './common';

export const organisationTypeSchema = z.enum(['bailleur', 'agence', 'proprietaire']);
export type OrganisationType = z.infer<typeof organisationTypeSchema>;
export const organisationStateSchema = z.enum(['active', 'essai', 'suspendue']);
export type OrganisationState = z.infer<typeof organisationStateSchema>;

export const ORGANISATION_TYPE_LABELS: Record<OrganisationType, string> = {
  bailleur: 'Bailleur',
  agence: 'Agence sous mandat',
  proprietaire: 'Propriétaire',
};

export const organisationRowSchema = z.object({
  id: idSchema,
  name: z.string().min(1),
  type: organisationTypeSchema,
  planId: idSchema,
  planName: z.string(),
  state: organisationStateSchema,
  trialEndsOn: isoDateSchema.nullable(),
  createdOn: isoDateSchema,
  userCount: count,
});
export type OrganisationRow = z.infer<typeof organisationRowSchema>;

export const organisationListSchema = pageOf(organisationRowSchema).extend({
  counts: z.object({ all: count, bailleur: count, agence: count, proprietaire: count }),
  stats: z.object({
    total: count,
    bailleurs: count,
    agences: count,
    proprietaires: count,
    actives: count,
    essais: count,
    suspendues: count,
    nextTrialEnd: isoDateSchema.nullable(),
  }),
});
export type OrganisationList = z.infer<typeof organisationListSchema>;

export const organisationFiltersSchema = z.object({
  type: z.union([organisationTypeSchema, z.literal('')]).default(''),
  planId: z.string().default(''),
  state: z.union([organisationStateSchema, z.literal('')]).default(''),
});
export type OrganisationFilters = z.input<typeof organisationFiltersSchema>;

export const auditSummarySchema = z.object({
  id: idSchema,
  at: isoDateTimeSchema,
  title: z.string(),
  context: z.string(),
  operator: z.boolean(),
});

export const organisationDetailSchema = z.object({
  organisation: organisationRowSchema,
  holder: z.object({ name: z.string(), email: z.email() }),
  contactEmail: z.email(),
  headquarters: z.string(),
  activity: z.string(),
  creation: z.string(),
  planMonthlyMinor: minorSchema,
  includedUsers: count.nullable(),
  modules: z.object({
    enabled: count,
    total: count,
    disabled: z.array(z.object({ id: idSchema, name: z.string(), reason: z.string() })),
  }),
  usage: z.array(z.object({ id: z.string(), label: z.string(), value: count, max: count.nullable(), text: z.string() })),
  users: z.array(
    z.object({
      id: idSchema,
      name: z.string(),
      role: z.string(),
      lastLoginAt: isoDateTimeSchema,
    }),
  ),
  lastActivity: z.object({ at: isoDateTimeSchema, by: z.string() }),
  recentActions: z.array(auditSummarySchema),
  auditTotal: count,
  accesses: z.array(
    z.object({
      id: idSchema,
      ticket: z.string(),
      operator: z.string(),
      reason: z.string(),
      startedAt: isoDateTimeSchema,
      endsAt: isoDateTimeSchema,
      active: z.boolean(),
    }),
  ),
});
export type OrganisationDetail = z.infer<typeof organisationDetailSchema>;

export const createOrganisationInputSchema = z.object({
  name: z.string().trim().min(2, 'Indiquez le nom de l’organisation.').max(120),
  type: organisationTypeSchema,
  siren: z
    .string()
    .trim()
    .transform((value) => value.replace(/\s/g, ''))
    .refine((value) => value === '' || /^\d{9}$/.test(value), 'Le SIREN comporte 9 chiffres.'),
  headquarters: z.string().trim().min(5, 'Indiquez l’adresse du siège.').max(200),
  holderFirstName: z.string().trim().min(1, 'Indiquez le prénom.').max(60),
  holderLastName: z.string().trim().min(1, 'Indiquez le nom.').max(60),
  holderEmail: z.email('Adresse e-mail invalide.'),
  planId: idSchema,
  trial: z.boolean(),
});
export type CreateOrganisationInput = z.input<typeof createOrganisationInputSchema>;

export const updateOrganisationInputSchema = z.object({
  name: z.string().trim().min(2, 'Indiquez le nom de l’organisation.').max(120),
  contactEmail: z.email('Adresse e-mail invalide.'),
  headquarters: z.string().trim().min(2, 'Indiquez le siège.').max(200),
});
export type UpdateOrganisationInput = z.input<typeof updateOrganisationInputSchema>;

export const suspendInputSchema = z.object({ reason: z.string().trim().min(5, 'Précisez le motif (5 caractères minimum).').max(500) });
export type SuspendInput = z.input<typeof suspendInputSchema>;

export const accessRequestInputSchema = z.object({
  reason: z.string().trim().min(10, 'Le motif doit comporter au moins 10 caractères.').max(500),
  ticket: z
    .string()
    .trim()
    .refine((value) => value === '' || /^SUP-\d{3,6}$/.test(value), 'Référence attendue : SUP-2077.'),
});
export type AccessRequestInput = z.input<typeof accessRequestInputSchema>;
