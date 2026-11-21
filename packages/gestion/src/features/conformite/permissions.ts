import type { ConformitePermissions } from './model';

export type ConformiteRole = 'owner' | 'admin' | 'manager' | 'accountant';

export function conformitePermissions(role: ConformiteRole | null): ConformitePermissions {
  return { write: role === 'owner' || role === 'admin' || role === 'manager' };
}
