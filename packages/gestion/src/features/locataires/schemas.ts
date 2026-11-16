import { toneSchema } from '@eguardimmo/shell';
import { z } from 'zod';
import { CURRENCIES } from '../../format/money';

const slug = z.string().regex(/^[a-z0-9]+(-[a-z0-9]+)*$/);
const minor = z.number().int();
const count = z.number().int().nonnegative();
const isoDate = z.iso.date();
const text = z.string().trim();
const required = (message: string) => text.min(1, message);

export const unitSchema = z.object({
  id: slug,
  label: z.string().min(1),
  building: z.string().min(1),
  vacant: z.boolean(),
});
export type Unit = z.infer<typeof unitSchema>;
export const unitFullLabel = (unit: Pick<Unit, 'label' | 'building'>): string => `${unit.label}, ${unit.building}`;

export const TENANT_KINDS = ['particulier', 'societe'] as const;
export const tenantKindSchema = z.enum(TENANT_KINDS);
export const tenantStatusSchema = z.enum(['actif', 'invite', 'archive']);
export const tenantStateSchema = z.enum(['a_jour', 'retard', 'preavis', 'invitation', 'en_cours', 'sans_bail']);
export const ID_DOC_TYPES = ['passeport', 'cni', 'titre_sejour'] as const;
export const idDocTypeSchema = z.enum(ID_DOC_TYPES);
export const CIVILITIES = ['M.', 'Mme'] as const;

export const tenantSchema = z.object({
  id: slug,
  kind: tenantKindSchema,
  civility: z.enum(['M.', 'Mme', '']),
  firstName: z.string(),
  lastName: z.string(),
  companyName: z.string(),
  phone: z.string(),
  email: z.string(),
  address: z.string(),
  profession: z.string(),
  birthDate: isoDate.nullable(),
  idDocType: idDocTypeSchema.nullable(),
  idExpiry: isoDate.nullable(),
  idFileName: z.string().nullable(),
  ibanLast4: z.string().nullable(),
  idLast4: z.string().nullable(),
  since: isoDate.or(z.literal('')),
  unitId: slug.nullable(),
  status: tenantStatusSchema,
  state: tenantStateSchema,
  balance: minor,
  portalActive: z.boolean(),
  portalInvitedOn: isoDate.nullable(),
  lateSince: isoDate.nullable(),
});
export type Tenant = z.infer<typeof tenantSchema>;
export type TenantState = z.infer<typeof tenantStateSchema>;

export const tenantNameOf = (tenant: Pick<Tenant, 'kind' | 'firstName' | 'lastName' | 'companyName'>): string =>
  tenant.kind === 'societe' ? tenant.companyName : `${tenant.firstName} ${tenant.lastName}`.trim();

export const initialsOf = (name: string): string =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join('');

const PHONE = /^\+?[0-9][0-9 .-]{7,17}$/;
const emailField = text.min(1, 'Renseignez l’adresse e-mail').pipe(z.email('Adresse e-mail incomplète'));
const phoneField = text.min(1, 'Renseignez le téléphone').regex(PHONE, 'Numéro de téléphone invalide, ex. +33 6 00 00 00 01');

export const tenantInputSchema = z
  .object({
    kind: tenantKindSchema,
    civility: z.enum(['M.', 'Mme', '']),
    firstName: text,
    lastName: text,
    companyName: text,
    birthDate: z.union([isoDate, z.literal('')]),
    email: emailField,
    phone: phoneField,
    idDocType: z.union([idDocTypeSchema, z.literal('')]),
    idExpiry: z.union([isoDate, z.literal('')]),
    idFileName: z.string(),
    idNumber: text,
  })
  .superRefine((value, context) => {
    if (value.kind === 'particulier') {
      if (value.firstName === '') context.addIssue({ code: 'custom', path: ['firstName'], message: 'Renseignez le prénom' });
      if (value.lastName === '') context.addIssue({ code: 'custom', path: ['lastName'], message: 'Renseignez le nom' });
      if (value.birthDate !== '' && value.birthDate > new Date().toISOString().slice(0, 10)) {
        context.addIssue({ code: 'custom', path: ['birthDate'], message: 'La date de naissance est dans le futur' });
      }
    } else if (value.companyName === '') {
      context.addIssue({ code: 'custom', path: ['companyName'], message: 'Renseignez la raison sociale' });
    }
    if (value.idNumber !== '' && value.idDocType === '') {
      context.addIssue({ code: 'custom', path: ['idDocType'], message: 'Choisissez le type de pièce' });
    }
  });
export type TenantInput = z.infer<typeof tenantInputSchema>;

export const tenantInviteSchema = z.object({
  email: emailField,
  firstName: required('Renseignez le prénom'),
  lastName: required('Renseignez le nom'),
  unitId: z.union([slug, z.literal('')]),
});
export type TenantInvite = z.infer<typeof tenantInviteSchema>;

const tenantDetailRow = z.object({ id: slug, title: required('Titre requis'), detail: z.string() });
const detailTone = toneSchema;

export const tenantDetailSchema = z.object({
  tenantId: slug,
  rent: minor,
  rentCurrency: z.enum(CURRENCIES).optional(),
  nextNoticeOn: isoDate.nullable(),
  leaseEnd: isoDate.nullable(),
  onTime: z.object({ onTime: count, total: count }),
  dueSince: isoDate.nullable(),
  lateSettled: count,
  payments: z.array(
    z.object({
      id: slug,
      date: isoDate,
      label: z.string().min(1),
      amount: minor.nullable(),
      status: z.enum(['impaye', 'paye', 'partiel']),
    }),
  ),
  paymentsCount: count,
  activities: z.array(tenantDetailRow.extend({ tone: detailTone, badge: z.object({ label: z.string(), tone: detailTone }).optional() })),
  activitiesCount: count,
  documents: z.array(tenantDetailRow.extend({ tone: detailTone })),
  documentsCount: count,
  guarantors: z.array(tenantDetailRow.extend({ tone: detailTone })),
  leases: z.array(tenantDetailRow.extend({ tone: detailTone, badge: z.object({ label: z.string(), tone: detailTone }), href: z.string() })),
  messages: z.array(tenantDetailRow.extend({ tone: detailTone, badge: z.object({ label: z.string(), tone: detailTone }).optional() })),
  messagesCount: count,
});
export type TenantDetail = z.infer<typeof tenantDetailSchema>;

export const CANDIDATE_STATUSES = ['en_attente', 'preselection', 'confirme', 'refuse'] as const;
export const candidateStatusSchema = z.enum(CANDIDATE_STATUSES);
export type CandidateStatus = z.infer<typeof candidateStatusSchema>;

export const candidateSchema = z.object({
  id: slug,
  firstName: z.string().min(1),
  lastName: z.string().min(1),
  email: z.string().min(1),
  phone: z.string(),
  unitId: slug,
  monthlyIncome: minor,
  receivedOn: isoDate,
  status: candidateStatusSchema,
  message: z.string(),
  requestedDocuments: z.array(z.string()),
  tenantId: slug.nullable(),
});
export type Candidate = z.infer<typeof candidateSchema>;

export const REQUESTED_DOCUMENTS = ['Pièce d’identité', 'Trois derniers bulletins de salaire', 'Avis d’imposition'] as const;

export const candidateInviteSchema = z.object({
  firstName: required('Renseignez le prénom'),
  lastName: required('Renseignez le nom'),
  email: emailField,
  phone: z.union([z.literal(''), phoneField]),
  unitId: slug.or(z.literal('')).refine((value) => value !== '', 'Choisissez le bien concerné'),
  message: z.string(),
  requestedDocuments: z.array(z.string()),
});
export type CandidateInvite = z.infer<typeof candidateInviteSchema>;
