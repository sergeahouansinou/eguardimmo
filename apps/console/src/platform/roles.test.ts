import { describe, expect, it } from 'vitest';
import { canAccess, hasRole, roleLabels, SECTIONS, SECTION_ROLES } from './roles';
import type { OperatorRole } from './roles';

describe('matrice des rôles d’opérateur', () => {
  it.each([
    ['admin', ['accueil', 'organisations', 'comptes', 'abonnements', 'audit', 'rgpd', 'support', 'approbations', 'sante', 'sauvegardes', 'parametres', 'equipe']],
    ['support', ['accueil', 'organisations', 'comptes', 'audit', 'support', 'approbations', 'sante', 'sauvegardes', 'parametres']],
    ['compliance', ['accueil', 'organisations', 'comptes', 'audit', 'rgpd', 'approbations']],
    ['billing', ['accueil', 'organisations', 'abonnements', 'approbations']],
    ['engineering', ['sante', 'sauvegardes', 'parametres']],
  ] as const)('%s accède exactement à ses sections', (role, allowed) => {
    expect(SECTIONS.filter((section) => canAccess([role], section)).sort()).toEqual([...allowed].sort());
  });

  it('un opérateur sans rôle n’accède à rien', () => {
    expect(SECTIONS.filter((section) => canAccess([], section))).toEqual([]);
  });

  it('cumule les rôles et réserve l’équipe à l’administrateur', () => {
    expect(canAccess(['billing', 'compliance'], 'rgpd')).toBe(true);
    expect(canAccess(['billing', 'compliance'], 'abonnements')).toBe(true);
    expect(canAccess(['support', 'billing', 'compliance', 'engineering'], 'equipe')).toBe(false);
    expect(Object.values(SECTION_ROLES).every((roles) => roles.length > 0)).toBe(true);
  });

  it('nomme les rôles en français', () => {
    expect(hasRole(['support'], 'admin', 'support')).toBe(true);
    expect(hasRole([], 'admin')).toBe(false);
    expect(roleLabels(['admin', 'billing'] satisfies OperatorRole[])).toBe('Administrateur, Facturation');
    expect(roleLabels([])).toBe('Aucun rôle');
  });
});
