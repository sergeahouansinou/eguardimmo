import { z } from 'zod';
import { oneOf, pageOf, timestamp } from './apiKit';

export const profileSchema = oneOf(
  z
    .object({
      id: z.uuid(),
      name: z.string(),
      email: z.email(),
      email_verified_at: timestamp.nullable(),
      phone: z.string().nullable(),
      last_login_at: timestamp.nullable(),
      previous_login_at: timestamp.nullable(),
    })
    .transform((item) => ({ id: item.id, name: item.name, email: item.email, emailVerifiedAt: item.email_verified_at, phone: item.phone })),
);
export type AccountProfile = z.output<typeof profileSchema>['data'];

export const emailChangeSchema = oneOf(z.object({ status: z.literal('code_sent'), expires_in_minutes: z.number().int().positive() }));

export const CONTACT_FIELDS = ['email', 'phone'] as const;
export type ContactField = (typeof CONTACT_FIELDS)[number];

const contactUpdate = z
  .object({
    id: z.uuid(),
    organization_id: z.uuid(),
    status: z.enum(['pending', 'applied', 'dismissed']),
    created_at: timestamp,
    decided_at: timestamp.nullable(),
  })
  .transform((item) => ({ id: item.id, organizationId: item.organization_id, status: item.status, createdAt: item.created_at, decidedAt: item.decided_at }));

export type ContactUpdate = z.output<typeof contactUpdate>;
export const contactUpdateSchema = oneOf(contactUpdate);
export const contactUpdatePageSchema = pageOf(contactUpdate);
