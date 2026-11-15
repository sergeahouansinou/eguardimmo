import type { CampaignAudience } from './schemas';

export interface ResolvedAudience {
  label: string;
  count: number;
  withoutEmail: number;
  buildingIds: string[];
}

export function resolveAudience(audience: CampaignAudience, selectedBuildingIds: readonly string[]): ResolvedAudience {
  if (!audience.buildings) {
    return {
      label: audience.label,
      count: audience.count,
      withoutEmail: audience.withoutEmail,
      buildingIds: audience.buildingIds ?? [],
    };
  }
  const chosen = audience.buildings.filter((building) => selectedBuildingIds.includes(building.id));
  return {
    label: chosen.length > 0 ? chosen.map((building) => building.name).join(', ') : audience.label,
    count: chosen.reduce((sum, building) => sum + building.count, 0),
    withoutEmail: chosen.reduce((sum, building) => sum + building.withoutEmail, 0),
    buildingIds: chosen.map((building) => building.id),
  };
}

export function hasUnknownBuilding(audience: CampaignAudience, buildingIds: readonly string[]): boolean {
  const known = audience.buildings ?? [];
  return buildingIds.some((id) => !known.some((building) => building.id === id));
}
