import { z } from 'zod';

export const ROLES = ['titulaire', 'administrateur', 'gestionnaire', 'comptable'] as const;
export type Role = (typeof ROLES)[number];
export const INVITABLE_ROLES = ['administrateur', 'gestionnaire', 'comptable'] as const;
export type InvitableRole = (typeof INVITABLE_ROLES)[number];

export const ROLE_LABELS: Record<Role, string> = {
  titulaire: 'Titulaire',
  administrateur: 'Administrateur',
  gestionnaire: 'Gestionnaire',
  comptable: 'Comptable',
};

export const ROLE_SUMMARIES: Record<Role, string> = {
  titulaire: "Tout le compte, y compris l'abonnement",
  administrateur: 'Mêmes droits que le titulaire, clôture comprise',
  gestionnaire: 'Biens, locataires, baux, loyers ; prépare les reversements',
  comptable: 'Finances, banque et reversements ; le reste en lecture',
};

export const scopeSchema = z.object({ type: z.literal('all') });
export type Scope = z.infer<typeof scopeSchema>;

export const memberScopeSchema = z.union([scopeSchema, z.object({ type: z.literal('selected'), buildings: z.array(z.string().min(1)) })]);
export type MemberScope = z.infer<typeof memberScopeSchema>;

export const STATUSES = ['actif', 'invite', 'desactive'] as const;
export type MemberStatus = (typeof STATUSES)[number];

export const memberSchema = z.object({
  id: z.string().min(1),
  firstName: z.string().min(1),
  lastName: z.string().min(1),
  email: z.email(),
  role: z.enum(ROLES),
  scope: memberScopeSchema,
  twoFactor: z.enum(['activee', 'non-activee', 'a-l-acceptation']),
  lastLogin: z.iso.datetime({ offset: true }).nullable(),
  online: z.boolean(),
  status: z.enum(STATUSES),
  self: z.boolean(),
  message: z.string().optional(),
  invitedAt: z.iso.datetime({ offset: true }).optional(),
});
export type Member = z.infer<typeof memberSchema>;

export const teamSchema = z.object({
  members: z.array(memberSchema),
  seatLimit: z.number().int().positive().nullable(),
  planName: z.string().min(1),
  twoFactorRequired: z.boolean(),
});
export type TeamData = z.infer<typeof teamSchema>;

export const inviteSchema = z.object({
  firstName: z.string().trim().min(1, 'Saisissez le prénom.').max(60, '60 caractères au maximum.'),
  lastName: z.string().trim().min(1, 'Saisissez le nom.').max(60, '60 caractères au maximum.'),
  email: z.email("Saisissez une adresse e-mail valide, par exemple fatou.ndiaye@example.com.").max(120, '120 caractères au maximum.'),
  role: z.enum(INVITABLE_ROLES, 'Choisissez un rôle.'),
  scope: scopeSchema,
  message: z.string().trim().max(500, '500 caractères au maximum.'),
});
export type InviteInput = z.infer<typeof inviteSchema>;

export const roleChangeSchema = z.enum(INVITABLE_ROLES);

export type RightLevel = 'modifier' | 'modifier-2fa' | 'preparation' | 'lecture' | 'aucun';

export const RIGHT_AREAS = [
  'Loyers, encaissements, dépenses',
  'Reversements, banque, clôture',
  'Comptes rendus : publication',
  'Biens, locataires, baux',
  'Documents et quittances',
  'Messages aux locataires',
  'Équipe et réglages',
] as const;

export const ROLE_RIGHTS: Record<Role, readonly RightLevel[]> = {
  titulaire: ['modifier', 'modifier-2fa', 'modifier', 'modifier', 'modifier', 'modifier', 'modifier'],
  administrateur: ['modifier', 'modifier-2fa', 'modifier', 'modifier', 'modifier', 'modifier', 'modifier'],
  gestionnaire: ['modifier', 'preparation', 'modifier', 'modifier', 'modifier', 'modifier', 'lecture'],
  comptable: ['modifier', 'modifier-2fa', 'aucun', 'lecture', 'lecture', 'aucun', 'lecture'],
};
