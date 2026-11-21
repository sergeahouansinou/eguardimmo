import type { RecoveryPermissions } from './model';

export type RecoveryRole = 'owner' | 'admin' | 'manager' | 'accountant';

export function recoveryPermissions(role: RecoveryRole | null): RecoveryPermissions {
  return { write: role === 'owner' || role === 'admin' || role === 'manager' };
}
