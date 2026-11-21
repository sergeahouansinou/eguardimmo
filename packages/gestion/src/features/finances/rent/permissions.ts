import type { RentPermissions } from './model';

export type RentRole = 'owner' | 'admin' | 'manager' | 'accountant';

const NONE: RentPermissions = { recordPayment: false, manage: false };

export function rentPermissions(role: RentRole | null): RentPermissions {
  if (role === 'owner' || role === 'admin' || role === 'manager') return { recordPayment: true, manage: true };
  if (role === 'accountant') return { recordPayment: true, manage: false };
  return NONE;
}
