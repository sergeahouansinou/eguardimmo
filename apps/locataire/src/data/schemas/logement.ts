import { z } from 'zod';
import { cents, isoDate, isoDateTime, requiredText } from './common';

export const leaseSchema = z.object({
  id: z.string(),
  status: z.enum(['en_cours', 'conge_donne']),
  usage: z.string(),
  regime: z.string(),
  duration: z.string(),
  startOn: isoDate,
  endOn: isoDate,
  signedOn: isoDate,
  noticeLabel: z.string(),
  noticeMonths: z.number().int().positive(),
  noticeZoneLabel: z.string(),
  rentCents: cents,
  provisionsCents: cents,
  depositCents: cents,
  depositPaidOn: isoDate,
  dueLabel: z.string(),
  revision: z.object({ nextOn: isoDate, note: z.string(), rentLabel: z.string() }),
  renewal: z.string(),
  landlord: z.object({ name: z.string(), address: z.string() }),
  tenantName: z.string(),
  tenantInitials: z.string(),
  property: z.object({
    unit: z.string(),
    label: z.string(),
    street: z.string(),
    postalCode: z.string(),
    city: z.string(),
    type: z.string(),
    surface: z.string(),
    floor: z.string(),
    floorShort: z.string(),
  }),
  documentIds: z.array(z.string()),
  notice: z
    .object({
      reference: z.string(),
      sentOn: isoDate,
      departureOn: isoDate,
      reason: z.string(),
    })
    .nullable(),
});
export type Lease = z.infer<typeof leaseSchema>;

export const NOTICE_REASONS = [
  { value: 'achat', label: 'Achat d’un logement' },
  { value: 'mutation', label: 'Mutation professionnelle' },
  { value: 'perso', label: 'Raisons personnelles' },
  { value: 'autre', label: 'Autre motif' },
] as const;

export const noticeInputSchema = z.object({
  departureOn: isoDate,
  reason: z.string(),
  street: requiredText('L’adresse'),
  postalCode: z.string().trim().regex(/^\d{5}$/, 'Le code postal comporte 5 chiffres.'),
  city: requiredText('La ville', 80),
  confirm: z.literal(true, { error: 'Vous devez confirmer le congé.' }),
});
export type NoticeInput = z.infer<typeof noticeInputSchema>;

export const roomSchema = z.object({
  name: z.string(),
  condition: z.enum(['bon_etat', 'etat_usage']),
  notes: z.string(),
  photos: z.number().int().nonnegative(),
  reserve: z.boolean(),
});

export const inspectionSchema = z.object({
  id: z.string(),
  kind: z.enum(['entree', 'sortie']),
  status: z.enum(['signe', 'a_planifier', 'propose']),
  date: isoDate.nullable(),
  address: z.string(),
  caption: z.string(),
  photosCount: z.number().int().nonnegative(),
  rooms: z.array(roomSchema),
  reservesNote: z.string(),
  signatures: z.array(z.object({ name: z.string(), role: z.string(), signedAt: isoDateTime })),
  meters: z.array(z.object({ label: z.string(), value: z.string() })),
  surfaceLabel: z.string(),
});
export type Inspection = z.infer<typeof inspectionSchema>;

export const documentSchema = z.object({
  id: z.string(),
  name: z.string(),
  category: z.string(),
  group: z.enum(['contrat', 'quittances', 'autres']),
  issuedOn: isoDate,
  sizeBytes: z.number().int().positive(),
  detail: z.string(),
  homeDetail: z.string().nullable(),
  href: z.string().regex(/^\/[\w\-/]*$/).nullable(),
});
export type DemoDocument = z.infer<typeof documentSchema>;

export const attestationSchema = z.object({
  id: z.string(),
  label: z.string(),
  insurer: z.string(),
  contractNumber: z.string(),
  startOn: isoDate,
  endOn: isoDate,
  guarantees: z.string(),
  depositedOn: isoDate,
  fileName: z.string(),
});
export type Attestation = z.infer<typeof attestationSchema>;

export const attestationInputSchema = z
  .object({
    insurer: requiredText('L’assureur', 80),
    contractNumber: z
      .string()
      .trim()
      .regex(/^[A-Za-z0-9][A-Za-z0-9-]{3,29}$/, 'Le numéro de contrat comporte 4 à 30 lettres, chiffres ou tirets.'),
    startOn: isoDate,
    endOn: isoDate,
    fileName: requiredText('Le fichier', 160),
    fileSize: z.number().int().positive().max(10 * 1024 * 1024, 'Le fichier dépasse 10 Mo.'),
    fileType: z.enum(['application/pdf', 'image/jpeg', 'image/png'], { error: 'Format accepté : PDF, JPG ou PNG.' }),
  })
  .refine((value) => value.endOn > value.startOn, {
    path: ['endOn'],
    error: 'La date de fin doit suivre la date de début.',
  });
export type AttestationInput = z.infer<typeof attestationInputSchema>;
