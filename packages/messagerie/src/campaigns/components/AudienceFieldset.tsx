'use client';

import { Alert, RadioGroup } from '@eguardimmo/ui';
import { CampaignBuildingPicker } from '../../components/CampaignBuildingPicker';
import { reachLabel, reachOf } from '../audience';
import type { BuildingScope } from '../editorValidation';
import type { AudienceOption, CampaignAudienceKind } from '../model';

export interface AudienceFieldsetProps {
  options: readonly AudienceOption[];
  audience: CampaignAudienceKind;
  buildingIds: string[];
  scope: BuildingScope;
  disabled: boolean;
  error: string | undefined;
  onAudienceChange: (audience: CampaignAudienceKind) => void;
  onBuildingsChange: (ids: string[]) => void;
  onScopeChange: (scope: BuildingScope) => void;
}

export function AudienceFieldset({ options, audience, buildingIds, scope, disabled, error, onAudienceChange, onBuildingsChange, onScopeChange }: AudienceFieldsetProps) {
  const selected = options.find((option) => option.audience === audience);
  const reach = selected ? reachOf(selected, buildingIds) : null;

  return (
    <fieldset className="flex min-w-0 flex-col gap-2" disabled={disabled}>
      <legend className="mb-1 text-caption text-fg-muted">Destinataires</legend>
      {options.map((option) => (
        <label
          key={option.audience}
          className="grid cursor-pointer grid-cols-[auto_1fr] gap-x-2 rounded-md border border-line px-3 py-2 text-body has-[:checked]:border-action has-[:checked]:bg-action-subtle"
        >
          <input
            type="radio"
            name="audience"
            value={option.audience}
            checked={option.audience === audience}
            className="row-span-2 mt-1"
            onChange={() => {
              onScopeChange('all');
              onAudienceChange(option.audience);
            }}
          />
          <span className="font-medium text-fg">{`${option.label} (${String(option.count)})`}</span>
          <span className="text-caption text-fg-muted">{option.detail}</span>
        </label>
      ))}
      {selected?.audience === 'tenants' && selected.buildings.length > 0 ? (
        <div className="flex min-w-0 flex-col gap-2">
          <RadioGroup
            label="Immeubles concernés"
            options={[
              { value: 'all', label: 'Tous les immeubles' },
              { value: 'some', label: 'Certains immeubles' },
            ]}
            value={scope}
            onValueChange={(value) => {
              onScopeChange(value === 'some' ? 'some' : 'all');
              if (value !== 'some') onBuildingsChange([]);
            }}
          />
          {scope === 'some' ? (
            <CampaignBuildingPicker buildings={selected.buildings} selectedIds={buildingIds} noun="locataires" onChange={onBuildingsChange} error={error} />
          ) : null}
        </div>
      ) : null}
      {reach && reach.count > 0 ? <p className="text-caption text-fg-muted">{`${reachLabel(reach)} (calculé par le serveur à l’envoi).`}</p> : null}
      {reach && reach.withoutEmail > 0 ? (
        <Alert tone="warning" title={`${String(reach.withoutEmail)} fiche${reach.withoutEmail > 1 ? 's' : ''} sans adresse e-mail ne recevr${reach.withoutEmail > 1 ? 'ont' : 'a'} pas ce message.`}>
          Ajoutez l’adresse sur la fiche pour l’inclure : elle est comptée comme ignorée à l’envoi.
        </Alert>
      ) : null}
      {error && scope === 'all' ? <p className="text-caption text-fg-danger">{error}</p> : null}
    </fieldset>
  );
}
