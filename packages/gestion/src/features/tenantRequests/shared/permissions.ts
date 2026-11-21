export interface TenantRequestsPermissions {
  available: boolean;
  manage: boolean;
  readPayments: boolean;
  manageAccount: boolean;
}

const NONE: TenantRequestsPermissions = { available: false, manage: false, readPayments: false, manageAccount: false };

export function tenantRequestsPermissions(role: string | null): TenantRequestsPermissions {
  if (role === 'owner' || role === 'admin') return { available: true, manage: true, readPayments: true, manageAccount: true };
  if (role === 'manager') return { available: true, manage: true, readPayments: true, manageAccount: false };
  if (role === 'accountant') return { available: true, manage: false, readPayments: true, manageAccount: false };
  return NONE;
}
