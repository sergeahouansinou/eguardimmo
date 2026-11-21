import type { OwnerFundsPermissions } from './model';

export type OwnerFundsRole = 'owner' | 'admin' | 'manager' | 'accountant';
export type OwnerFundsOrganizationKind = 'agency' | 'individual';

const NONE: OwnerFundsPermissions = { available: false, prepare: false, sensitive: false, export: false };

export function ownerFundsPermissions(role: OwnerFundsRole | null, kind: OwnerFundsOrganizationKind | null): OwnerFundsPermissions {
  if (kind !== 'agency' || role === null) return NONE;
  const treasury = role !== 'manager';
  return { available: true, prepare: true, sensitive: treasury, export: treasury };
}
