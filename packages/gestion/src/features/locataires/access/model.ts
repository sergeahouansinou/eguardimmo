export const ACCESS_STATUSES = ['none', 'invited', 'linked'] as const;
export type AccessStatus = (typeof ACCESS_STATUSES)[number];

export interface TenantAccess {
  partyId: string;
  status: AccessStatus;
  emailHint: string | null;
  expiresAt: string | null;
  linkedAt: string | null;
}

export interface TenantChoice {
  id: string;
  name: string;
  email: string | null;
}

export interface TenantAccessPermissions {
  manage: boolean;
}

export type TenantAccessRole = 'owner' | 'admin' | 'manager' | 'accountant';

export function tenantAccessPermissions(role: TenantAccessRole | null): TenantAccessPermissions {
  return { manage: role === 'owner' || role === 'admin' || role === 'manager' };
}
