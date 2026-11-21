'use client';

import { Select, TextField } from '@eguardimmo/ui';
import { periodLabels } from '../copy';
import { ALL_BUILDINGS, CAMPAIGN_PERIODS } from '../model';
import type { AudienceBuilding, CampaignPeriod } from '../model';

export interface FilterBarProps {
  search: string;
  building: string;
  period: CampaignPeriod;
  buildings: readonly AudienceBuilding[];
  onSearchChange: (search: string) => void;
  onBuildingChange: (building: string) => void;
  onPeriodChange: (period: CampaignPeriod) => void;
}

export function FilterBar({ search, building, period, buildings, onSearchChange, onBuildingChange, onPeriodChange }: FilterBarProps) {
  return (
    <div className="flex min-w-0 flex-wrap items-end gap-2">
      <div className="min-w-0 flex-1 basis-56 md:max-w-md">
        <TextField
          label="Rechercher une campagne"
          hideLabel
          type="search"
          placeholder="Ex. Coupure d’eau"
          value={search}
          onChange={(event) => { onSearchChange(event.target.value); }}
        />
      </div>
      {buildings.length > 0 ? (
        <Select
          label="Immeuble"
          hideLabel
          placeholder="Tous les immeubles"
          value={building}
          options={[{ value: ALL_BUILDINGS, label: 'Tous les immeubles' }, ...buildings.map((item) => ({ value: item.id, label: item.name }))]}
          onValueChange={onBuildingChange}
          className="w-full sm:w-52"
        />
      ) : null}
      <Select
        label="Période"
        hideLabel
        placeholder="Toutes les périodes"
        value={period}
        options={CAMPAIGN_PERIODS.map((value) => ({ value, label: periodLabels[value] }))}
        onValueChange={(value) => {
          const next = CAMPAIGN_PERIODS.find((candidate) => candidate === value);
          if (next) onPeriodChange(next);
        }}
        className="w-full sm:w-48"
      />
    </div>
  );
}
