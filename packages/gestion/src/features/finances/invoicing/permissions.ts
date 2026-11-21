import type { InvoicingPermissions } from './model';

export type InvoicingRole = 'owner' | 'admin' | 'manager' | 'accountant';
export type InvoicingOrganizationKind = 'agency' | 'individual';

const NONE: InvoicingPermissions = { available: false, write: false, credit: false };

export function invoicingPermissions(role: InvoicingRole | null, kind: InvoicingOrganizationKind | null): InvoicingPermissions {
  if (kind !== 'agency' || role === null) return NONE;
  return { available: true, write: true, credit: role !== 'manager' };
}
