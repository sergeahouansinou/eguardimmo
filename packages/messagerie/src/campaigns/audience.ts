import type { AudienceOption } from './model';

export interface Reach {
  count: number;
  withoutEmail: number;
  exact: boolean;
}

export function reachOf(option: AudienceOption, buildingIds: readonly string[]): Reach {
  if (buildingIds.length === 0) return { count: option.count, withoutEmail: option.withoutEmail, exact: true };
  const chosen = option.buildings.filter((building) => buildingIds.includes(building.id));
  const count = Math.min(option.count, chosen.reduce((sum, building) => sum + building.count, 0));
  const withoutEmail = Math.min(option.withoutEmail, chosen.reduce((sum, building) => sum + building.withoutEmail, 0));
  return { count, withoutEmail, exact: chosen.length <= 1 };
}

export function reachLabel(reach: Reach): string {
  return `${reach.exact ? '' : 'Jusqu’à '}${String(reach.count)} destinataire${reach.count > 1 ? 's' : ''}`;
}
