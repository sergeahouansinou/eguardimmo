'use client';

import { Alert } from '@eguardimmo/ui';
import type { ResolvedAudience } from '../data/audience';
import type { CampaignAudience } from '../data/schemas';
import { CampaignBuildingPicker } from './CampaignBuildingPicker';
import type { FieldErrors } from './formErrors';

export interface CampaignAudienceFieldsetProps {
  audiences: CampaignAudience[];
  audienceId: string;
  buildingIds: string[];
  resolved: ResolvedAudience | null;
  noun: string;
  errors: FieldErrors;
  onAudienceChange: (id: string) => void;
  onBuildingsChange: (ids: string[]) => void;
}

export function CampaignAudienceFieldset({
  audiences,
  audienceId,
  buildingIds,
  resolved,
  noun,
  errors,
  onAudienceChange,
  onBuildingsChange,
}: CampaignAudienceFieldsetProps) {
  const selected = audiences.find((candidate) => candidate.id === audienceId);
  const noEmail = resolved?.withoutEmail ?? 0;

  return (
    <fieldset className="flex min-w-0 flex-col gap-2">
      <legend className="mb-1 text-caption text-fg-muted">Destinataires</legend>
      {audiences.map((item) => {
        const active = item.id === audienceId && resolved !== null;
        const composable = item.buildings !== undefined;
        const count = active ? resolved.count : item.count;
        return (
          <label
            key={item.id}
            className="grid cursor-pointer grid-cols-[auto_1fr] gap-x-2 rounded-md border border-line px-3 py-2 text-body has-[:checked]:border-action has-[:checked]:bg-action-subtle"
          >
            <input
              type="radio"
              name="audience"
              value={item.id}
              checked={audienceId === item.id}
              className="row-span-2 mt-1"
              onChange={() => { onAudienceChange(item.id); }}
            />
            <span className="font-medium text-fg">{composable && !active ? item.label : `${item.label} (${String(count)})`}</span>
            <span className="text-caption text-fg-muted">
              {active && composable && resolved.buildingIds.length > 0 ? resolved.label : item.detail}
            </span>
          </label>
        );
      })}
      {selected?.buildings ? (
        <CampaignBuildingPicker
          buildings={selected.buildings}
          selectedIds={buildingIds}
          noun={noun}
          onChange={onBuildingsChange}
          error={errors.buildingIds}
        />
      ) : null}
      {errors.audienceId ? <p className="text-caption text-fg-danger">{errors.audienceId}</p> : null}
      {noEmail > 0 ? (
        <Alert tone="warning" title={`${String(noEmail)} destinataire${noEmail > 1 ? 's' : ''} sans e-mail valide ne recevr${noEmail > 1 ? 'ont' : 'a'} pas ce message.`}>
          {noEmail > 1 ? 'Ils sont exclus' : 'Il est exclu'} de l’envoi. Ajoutez {noEmail > 1 ? 'leur adresse sur leur fiche' : 'son adresse sur sa fiche'} pour {noEmail > 1 ? 'les' : 'l’'}inclure.
        </Alert>
      ) : null}
    </fieldset>
  );
}
