'use client';

import { X } from 'lucide-react';
import { IconButton, Select } from '@eguardimmo/ui';
import type { CampaignBuilding } from '../data/schemas';

export interface CampaignBuildingPickerProps {
  buildings: CampaignBuilding[];
  selectedIds: string[];
  noun: string;
  onChange: (ids: string[]) => void;
  error?: string | undefined;
}

export function CampaignBuildingPicker({ buildings, selectedIds, noun, onChange, error }: CampaignBuildingPickerProps) {
  const chosen = selectedIds.flatMap((id) => buildings.find((building) => building.id === id) ?? []);
  const remaining = buildings.filter((building) => !selectedIds.includes(building.id));

  return (
    <div role="group" aria-label="Immeubles" className="flex min-w-0 flex-col gap-2 rounded-md border border-line bg-muted p-3">
      <span aria-hidden="true" className="text-caption text-fg-muted">Immeubles</span>
      {chosen.length > 0 ? (
        <ul aria-label="Immeubles choisis" className="flex flex-wrap gap-1.5">
          {chosen.map((building) => (
            <li key={building.id} className="flex max-w-full min-w-0">
              <span className="inline-flex max-w-full min-w-0 items-center gap-1.5 rounded-md border border-line bg-surface py-0.5 pr-1 pl-2 text-caption text-fg">
                <span className="min-w-0 truncate font-medium">{building.name}</span>
                <span className="shrink-0 text-fg-subtle">{`${String(building.count)} ${noun}`}</span>
                <IconButton
                  label={`Retirer ${building.name}`}
                  icon={X}
                  size="xs"
                  onClick={() => { onChange(selectedIds.filter((id) => id !== building.id)); }}
                />
              </span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-caption text-fg-subtle">Aucun immeuble ajouté.</p>
      )}
      <Select
        label="Immeubles à ajouter"
        hideLabel
        placeholder="Ajouter un immeuble"
        value=""
        disabled={remaining.length === 0}
        options={remaining.map((building) => ({ value: building.id, label: building.name, description: `${String(building.count)} ${noun}` }))}
        onValueChange={(id) => { onChange([...selectedIds, id]); }}
        className="max-w-xs"
        {...(error ? { error } : {})}
      />
    </div>
  );
}
