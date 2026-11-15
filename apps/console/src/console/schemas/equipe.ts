import { z } from 'zod';
import { count, idSchema, isoDateSchema, isoDateTimeSchema } from './common';

export const operatorRoleSchema = z.enum(['administrateur', 'ingenierie', 'support', 'conformite', 'finance']);
export type OperatorRole = z.infer<typeof operatorRoleSchema>;
export const operatorStateSchema = z.enum(['actif', 'invitation', 'desactive']);
export type OperatorState = z.infer<typeof operatorStateSchema>;

export const ROLE_LABELS: Record<OperatorRole, string> = {
  administrateur: 'Administrateur',
  ingenierie: 'Ingénierie',
  support: 'Support',
  conformite: 'Conformité',
  finance: 'Finance',
};

export const ROLE_DESCRIPTIONS: Record<OperatorRole, string> = {
  administrateur: "Tout, y compris l'équipe et les paramètres",
  ingenierie: 'Modules, santé, sauvegardes et incidents',
  support: 'Tickets et accès justifiés',
  conformite: 'RGPD et journal d’audit',
  finance: 'Abonnements et facturation, en lecture',
};

export const rightLevelSchema = z.enum(['modifier', 'lecture', 'aucun']);
export type RightLevel = z.infer<typeof rightLevelSchema>;

export const ROLE_RIGHTS: Record<OperatorRole, { area: string; level: RightLevel }[]> = {
  administrateur: [
    { area: 'Organisations, comptes et modules', level: 'modifier' },
    { area: 'Tickets et support', level: 'modifier' },
    { area: "Journal d'audit", level: 'lecture' },
    { area: 'Santé et sauvegardes', level: 'modifier' },
    { area: 'Abonnements', level: 'modifier' },
    { area: 'Équipe et paramètres', level: 'modifier' },
  ],
  ingenierie: [
    { area: 'Organisations, comptes et modules', level: 'lecture' },
    { area: 'Tickets et support', level: 'aucun' },
    { area: "Journal d'audit", level: 'lecture' },
    { area: 'Santé et sauvegardes', level: 'modifier' },
    { area: 'Abonnements', level: 'aucun' },
    { area: 'Équipe et paramètres', level: 'aucun' },
  ],
  support: [
    { area: 'Organisations, comptes et modules', level: 'modifier' },
    { area: 'Tickets et support', level: 'modifier' },
    { area: "Journal d'audit", level: 'lecture' },
    { area: 'Santé et sauvegardes', level: 'lecture' },
    { area: 'Abonnements', level: 'aucun' },
    { area: 'Équipe et paramètres', level: 'aucun' },
  ],
  conformite: [
    { area: 'Organisations, comptes et modules', level: 'lecture' },
    { area: 'Tickets et support', level: 'aucun' },
    { area: "Journal d'audit", level: 'lecture' },
    { area: 'Santé et sauvegardes', level: 'aucun' },
    { area: 'Abonnements', level: 'aucun' },
    { area: 'Équipe et paramètres', level: 'aucun' },
  ],
  finance: [
    { area: 'Organisations, comptes et modules', level: 'lecture' },
    { area: 'Tickets et support', level: 'aucun' },
    { area: "Journal d'audit", level: 'aucun' },
    { area: 'Santé et sauvegardes', level: 'aucun' },
    { area: 'Abonnements', level: 'lecture' },
    { area: 'Équipe et paramètres', level: 'aucun' },
  ],
};

export const operatorSchema = z.object({
  id: idSchema,
  name: z.string(),
  email: z.email(),
  role: operatorRoleSchema,
  twoFactor: z.boolean(),
  lastLoginAt: isoDateTimeSchema.nullable(),
  invitedOn: isoDateSchema.nullable(),
  state: operatorStateSchema,
  self: z.boolean(),
});
export type Operator = z.infer<typeof operatorSchema>;

export const equipeSchema = z.object({
  operators: z.array(operatorSchema),
  counts: z.object({ all: count, actif: count, invitation: count }),
});
export type Equipe = z.infer<typeof equipeSchema>;

export const inviteInputSchema = z.object({
  firstName: z.string().trim().min(1, 'Indiquez le prénom.').max(60),
  lastName: z.string().trim().min(1, 'Indiquez le nom.').max(60),
  email: z.email('Adresse e-mail invalide.'),
  role: operatorRoleSchema,
});
export type InviteInput = z.input<typeof inviteInputSchema>;

export const changeRoleInputSchema = z.object({ role: operatorRoleSchema });
export type ChangeRoleInput = z.infer<typeof changeRoleInputSchema>;
