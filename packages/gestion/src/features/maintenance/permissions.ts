import type { MaintenancePermissions } from './model';

export type MaintenanceRole = 'owner' | 'admin' | 'manager' | 'accountant';
export type MaintenanceOrganizationKind = 'agency' | 'individual';

const NONE: MaintenancePermissions = { available: false, write: false, finance: false, settle: false };

export function maintenancePermissions(role: MaintenanceRole | null, kind: MaintenanceOrganizationKind | null): MaintenancePermissions {
  if (kind === null || role === null) return NONE;
  return { available: true, write: role !== 'accountant', finance: true, settle: role !== 'manager' };
}
