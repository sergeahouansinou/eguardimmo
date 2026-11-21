import type { PlanLimits } from '@/console/schemas';

export function usersLabel(users: PlanLimits['users']): string {
  if (users === null) return 'plusieurs utilisateurs';
  return `${String(users)} ${users > 1 ? 'utilisateurs' : 'utilisateur'}`;
}
