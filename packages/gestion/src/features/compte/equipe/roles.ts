import { z } from 'zod';
import { ROLES } from './schemas';

export const ACCESS_LEVELS = ['none', 'read', 'prepare', 'write', 'write_two_factor'] as const;
export type AccessLevel = (typeof ACCESS_LEVELS)[number];

export const ACCESS_LEVEL_LABELS: Record<AccessLevel, string> = {
  none: 'Aucun',
  read: 'Lecture',
  prepare: 'Préparation',
  write: 'Modifier',
  write_two_factor: 'Modifier, 2FA',
};

const levelSchema = z.enum(ACCESS_LEVELS);

export const roleDomainSchema = z.object({
  key: z.string().min(1),
  label: z.string().min(1),
  note: z.string().min(1).optional(),
  levels: z.object({ titulaire: levelSchema, administrateur: levelSchema, gestionnaire: levelSchema, comptable: levelSchema }),
  twoFactor: z.boolean(),
  highlighted: z.boolean(),
});
export type RoleDomain = z.infer<typeof roleDomainSchema>;

export const roleMatrixSchema = z.object({ currentRole: z.enum(ROLES), domains: z.array(roleDomainSchema) });
export type RoleMatrix = z.infer<typeof roleMatrixSchema>;
