import { z } from 'zod';
import { count, idSchema, isoDateSchema, isoDateTimeSchema, pageOf } from './common';

export const accountStateSchema = z.enum(['actif', 'invite', 'suspendu']);
export type AccountState = z.infer<typeof accountStateSchema>;
export const profileKindSchema = z.enum(['bailleur', 'proprietaire', 'locataire', 'agence']);
export type ProfileKind = z.infer<typeof profileKindSchema>;

export const PROFILE_LABELS: Record<ProfileKind, string> = {
  bailleur: 'Bailleur',
  proprietaire: 'Propriétaire',
  locataire: 'Locataire',
  agence: 'Agence',
};

export const accountRowSchema = z.object({
  id: idSchema,
  name: z.string().min(1),
  email: z.email(),
  profiles: z.array(profileKindSchema).min(1),
  twoFactor: z.boolean(),
  lastLoginAt: isoDateTimeSchema.nullable(),
  invitedOn: isoDateSchema.nullable(),
  state: accountStateSchema,
});
export type AccountRow = z.infer<typeof accountRowSchema>;

export const accountListSchema = pageOf(accountRowSchema).extend({
  counts: z.object({ all: count, actif: count, invite: count, suspendu: count }),
  stats: z.object({
    accounts: count,
    profiles: count,
    multiProfile: count,
    withThreeProfiles: count,
    invited: count,
    suspended: count,
  }),
});
export type AccountList = z.infer<typeof accountListSchema>;

export const accountFiltersSchema = z.object({
  profile: z.union([profileKindSchema, z.literal('')]).default(''),
  twoFactor: z.enum(['', 'avec', 'sans']).default(''),
});
export type AccountFilters = z.input<typeof accountFiltersSchema>;

export const accountDetailSchema = z.object({
  account: accountRowSchema,
  createdOn: isoDateSchema,
  profileList: z.array(
    z.object({ id: idSchema, kind: profileKindSchema, title: z.string(), detail: z.string(), status: z.string(), organisationId: idSchema.nullable() }),
  ),
  logins: z.object({
    total: count,
    last30Days: count,
    failures: count,
    rows: z.array(
      z.object({
        id: idSchema,
        at: isoDateTimeSchema,
        profile: z.string(),
        device: z.string(),
        origin: z.string(),
        success: z.boolean(),
      }),
    ),
  }),
  contact: z.object({ mobile: z.string(), language: z.string(), passwordChangedOn: isoDateSchema }),
  security: z.object({
    method: z.string(),
    since: isoDateSchema.nullable(),
    backupCodesLeft: count,
    backupCodesTotal: count,
    sessions: count,
    lastFailure: z.string(),
  }),
});
export type AccountDetail = z.infer<typeof accountDetailSchema>;
