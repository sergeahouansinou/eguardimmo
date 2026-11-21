import type { BankingPermissions } from './model';

export type BankingRole = 'owner' | 'admin' | 'manager' | 'accountant';

export function bankingPermissions(role: string | null): BankingPermissions {
  if (role === 'owner' || role === 'admin') return { available: true, manageAccounts: true };
  if (role === 'accountant') return { available: true, manageAccounts: false };
  return { available: false, manageAccounts: false };
}
