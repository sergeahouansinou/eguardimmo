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
  administrateur: "Tout, sauf l'abonnement et la clôture",
  gestionnaire: 'Biens, locataires, baux, documents',
  comptable: 'Finances et rapports, le reste en lecture',
};

export const BUILDINGS = ['Les Tilleuls', 'Résidence du Parc', 'Maison Rivière'] as const;

export const scopeSchema = z.union([
  z.object({ type: z.literal('all') }),
  z.object({ type: z.literal('selected'), buildings: z.array(z.enum(BUILDINGS)).min(1, 'Choisissez au moins un bien.') }),
]);
export type Scope = z.infer<typeof scopeSchema>;

export const STATUSES = ['actif', 'invite', 'desactive'] as const;
export type MemberStatus = (typeof STATUSES)[number];

export const memberSchema = z.object({
  id: z.string().min(1),
  firstName: z.string().min(1),
  lastName: z.string().min(1),
  email: z.email(),
  role: z.enum(ROLES),
  scope: scopeSchema,
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

export type RightLevel = 'modifier' | 'lecture' | 'aucun';

export const RIGHT_AREAS = [
  'Finances, paiements, dépenses',
  'Rapports et exports',
  'Biens, locataires, baux',
  'Documents et quittances',
  'Messages aux locataires',
  'Équipe et réglages',
] as const;

export const ROLE_RIGHTS: Record<Role, readonly RightLevel[]> = {
  titulaire: ['modifier', 'modifier', 'modifier', 'modifier', 'modifier', 'modifier'],
  administrateur: ['modifier', 'modifier', 'modifier', 'modifier', 'modifier', 'modifier'],
  gestionnaire: ['lecture', 'lecture', 'modifier', 'modifier', 'modifier', 'aucun'],
  comptable: ['modifier', 'modifier', 'lecture', 'lecture', 'aucun', 'aucun'],
};
