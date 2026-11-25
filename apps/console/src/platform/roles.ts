import { z } from 'zod';

export const OPERATOR_ROLES = ['admin', 'support', 'compliance', 'billing', 'engineering'] as const;
export const operatorRoleSchema = z.enum(OPERATOR_ROLES);
export type OperatorRole = z.infer<typeof operatorRoleSchema>;

export const ROLE_LABELS: Record<OperatorRole, string> = {
  admin: 'Administrateur',
  support: 'Support',
  compliance: 'Conformité',
  billing: 'Facturation',
  engineering: 'Ingénierie',
};

export const SECTIONS = [
  'accueil',
  'organisations',
  'comptes',
  'abonnements',
  'marketing',
  'rappels',
  'audit',
  'rgpd',
  'support',
  'approbations',
  'sante',
  'sauvegardes',
  'parametres',
  'equipe',
] as const;
export type Section = (typeof SECTIONS)[number];

/** Miroir des gardes `operator:` des routes de la console : le serveur reste l'autorité, ceci ne fait que masquer. */
export const SECTION_ROLES: Record<Section, readonly OperatorRole[]> = {
  accueil: ['admin', 'support', 'compliance', 'billing'],
  organisations: ['admin', 'support', 'compliance', 'billing'],
  comptes: ['admin', 'support', 'compliance'],
  abonnements: ['admin', 'billing'],
  marketing: ['admin'],
  rappels: ['admin'],
  audit: ['admin', 'support', 'compliance'],
  rgpd: ['admin', 'compliance'],
  support: ['admin', 'support'],
  approbations: ['admin', 'support', 'compliance', 'billing'],
  sante: ['admin', 'support', 'engineering'],
  sauvegardes: ['admin', 'support', 'engineering'],
  parametres: ['admin', 'support', 'engineering'],
  equipe: ['admin'],
};

export function canAccess(roles: readonly OperatorRole[], section: Section): boolean {
  return SECTION_ROLES[section].some((role) => roles.includes(role));
}

export function hasRole(roles: readonly OperatorRole[], ...wanted: readonly OperatorRole[]): boolean {
  return wanted.some((role) => roles.includes(role));
}

export function roleLabels(roles: readonly OperatorRole[]): string {
  return roles.length === 0 ? 'Aucun rôle' : roles.map((role) => ROLE_LABELS[role]).join(', ');
}
