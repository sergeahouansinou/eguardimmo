import type { ChargesPermissions, ExpenseSettlement } from './model';

export type ChargesRole = 'owner' | 'admin' | 'manager' | 'accountant';
export type ChargesOrganizationKind = 'agency' | 'individual';

const NONE: ChargesPermissions = { available: false, agency: false, write: false, thirdParty: false, issue: false, export: false };

export function chargesPermissions(role: string | null, kind: ChargesOrganizationKind | null): ChargesPermissions {
  if (kind === null || (role !== 'owner' && role !== 'admin' && role !== 'manager' && role !== 'accountant')) return NONE;
  const treasury = role !== 'manager';
  return { available: true, agency: kind === 'agency', write: true, thirdParty: kind === 'agency' && treasury, issue: role !== 'accountant', export: treasury };
}

export function allowedSettlements(permissions: ChargesPermissions): ExpenseSettlement[] {
  if (!permissions.agency) return ['bank', 'cash', 'none'];
  return permissions.thirdParty ? ['trust', 'own_funds_advance', 'paid_by_owner', 'none'] : ['paid_by_owner', 'none'];
}

export function canApprove(permissions: ChargesPermissions): boolean {
  return permissions.thirdParty;
}
