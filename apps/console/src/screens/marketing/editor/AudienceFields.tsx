'use client';

import { Chip, Select, TextField } from '@eguardimmo/ui';
import { SELECTED_AUDIENCE } from '@/platform/marketing/campaignBody';
import type { MarketingOptions } from '@/platform/marketing/marketing';
import { INACTIVITY_MAX, INACTIVITY_MIN, INACTIVITY_PRESETS, acceptsInactivity } from '../campaignDraft';
import type { CampaignDraft, DraftErrors } from '../campaignDraft';
import { RecipientsField } from './RecipientsField';

export interface AudienceFieldsProps {
  draft: CampaignDraft;
  options: MarketingOptions;
  errors: DraftErrors;
  onChange: (changes: Partial<CampaignDraft>) => void;
}

export function AudienceFields({ draft, options, errors, onChange }: AudienceFieldsProps) {
  const selected = options.audiences.find((audience) => audience.code === draft.audience);
  return (
    <div className="flex min-w-0 flex-col gap-3 py-2">
      <Select
        label="Destinataires"
        placeholder="Choisir un groupe"
        className="max-w-xl"
        hint={selected?.description}
        error={errors.audience}
        options={options.audiences.map((audience) => ({ value: audience.code, label: audience.label }))}
        value={draft.audience}
        onValueChange={(audience) => { onChange({ audience }); }}
      />
      {acceptsInactivity(draft, options) ? (
        <div className="flex min-w-0 flex-col gap-2">
          <div role="group" aria-label="Délais d’inactivité courants" className="flex flex-wrap gap-2">
            {INACTIVITY_PRESETS.map((days) => (
              <Chip key={days} pressed={draft.inactivityDays === String(days)} onClick={() => { onChange({ inactivityDays: String(days) }); }}>
                {days} jours
              </Chip>
            ))}
          </div>
          <div className="max-w-56">
            <TextField
              label="Délai d’inactivité (jours)"
              placeholder="30"
              type="number"
              min={INACTIVITY_MIN}
              max={INACTIVITY_MAX}
              hint={`De ${String(INACTIVITY_MIN)} à ${String(INACTIVITY_MAX)} jours.`}
              error={errors.inactivityDays}
              value={draft.inactivityDays}
              onChange={(event) => { onChange({ inactivityDays: event.target.value }); }}
            />
          </div>
        </div>
      ) : null}
      {draft.audience === SELECTED_AUDIENCE ? (
        <RecipientsField
          value={draft.recipients}
          max={options.limits.selected_recipients}
          error={errors.recipients}
          onChange={(recipients) => { onChange({ recipients }); }}
        />
      ) : null}
    </div>
  );
}
