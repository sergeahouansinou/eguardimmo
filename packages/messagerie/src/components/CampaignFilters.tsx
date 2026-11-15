'use client';

import { Select, TextField } from '@eguardimmo/ui';
import { ALL_BUILDINGS } from '../data/inputs';
import { useCampaignBuildings } from '../data/queries';
import type { CampaignPeriod } from '../data/schemas';
import { campaignPeriodSchema } from '../data/schemas';

const PERIOD_OPTIONS: { value: CampaignPeriod; label: string }[] = [
  { value: 'all', label: 'Toutes les périodes' },
  { value: 'month', label: 'Ce mois-ci' },
  { value: 'quarter', label: '3 derniers mois' },
  { value: 'year', label: 'Cette année' },
];

export interface CampaignFiltersProps {
  search: string;
  searchPlaceholder: string;
  building: string;
  period: CampaignPeriod;
  showBuilding: boolean;
  showPeriod: boolean;
  onSearchChange: (search: string) => void;
  onBuildingChange: (building: string) => void;
  onPeriodChange: (period: CampaignPeriod) => void;
}

export function CampaignFilters({
  search,
  searchPlaceholder,
  building,
  period,
  showBuilding,
  showPeriod,
  onSearchChange,
  onBuildingChange,
  onPeriodChange,
}: CampaignFiltersProps) {
  const buildings = useCampaignBuildings();
  const buildingOptions = [
    { value: ALL_BUILDINGS, label: 'Tous les immeubles' },
    ...(buildings.data ?? []).map((item) => ({ value: item.id, label: item.name })),
  ];

  return (
    <div className="flex min-w-0 flex-wrap items-end gap-2">
      <div className="min-w-0 flex-1 basis-56 md:max-w-md">
        <TextField
          label="Rechercher une campagne"
          hideLabel
          type="search"
          placeholder={searchPlaceholder}
          value={search}
          onChange={(event) => { onSearchChange(event.target.value); }}
        />
      </div>
      {showBuilding ? (
        <Select
          label="Immeuble"
          hideLabel
          placeholder="Tous les immeubles"
          value={building}
          options={buildingOptions}
          onValueChange={onBuildingChange}
          className="w-full sm:w-52"
        />
      ) : null}
      {showPeriod ? (
        <Select
          label="Période"
          hideLabel
          placeholder="Toutes les périodes"
          value={period}
          options={PERIOD_OPTIONS}
          onValueChange={(value) => {
            const parsed = campaignPeriodSchema.safeParse(value);
            if (parsed.success) onPeriodChange(parsed.data);
          }}
          className="w-full sm:w-48"
        />
      ) : null}
    </div>
  );
}
