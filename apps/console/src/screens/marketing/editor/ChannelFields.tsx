'use client';

import { useId } from 'react';
import { CAMPAIGN_CATEGORIES, CAMPAIGN_CHANNELS } from '@/platform/marketing/marketing';
import type { MarketingOptions } from '@/platform/marketing/marketing';
import { RadioCards } from '@/ui/RadioCards';
import type { CampaignDraft } from '../campaignDraft';
import { CHANNEL_LABELS, CONSENT_NOTES } from '../labels';

export interface ChannelFieldsProps {
  draft: CampaignDraft;
  options: MarketingOptions;
  channelLocked: boolean;
  onChange: (changes: Partial<CampaignDraft>) => void;
}

export function ChannelFields({ draft, options, channelLocked, onChange }: ChannelFieldsProps) {
  const channelId = useId();
  const categoryId = useId();
  return (
    <div className="grid gap-4 py-2 lg:grid-cols-2">
      <div className="flex min-w-0 flex-col gap-2">
        <span id={channelId} className="text-caption text-fg-muted">Canal</span>
        <RadioCards
          labelledBy={channelId}
          disabled={channelLocked}
          value={draft.channel}
          options={options.channels.map((entry) => ({
            value: entry.channel,
            label: CHANNEL_LABELS[entry.channel],
            description: entry.enabled ? undefined : `Envoi désactivé${entry.reason ? ` : ${entry.reason}` : ''}`,
          }))}
          onValueChange={(value) => {
            const channel = CAMPAIGN_CHANNELS.find((candidate) => candidate === value);
            if (channel) onChange({ channel });
          }}
        />
        {channelLocked ? <p className="text-caption text-fg-subtle">Le canal ne change plus après le premier enregistrement.</p> : null}
      </div>
      <div className="flex min-w-0 flex-col gap-2">
        <span id={categoryId} className="text-caption text-fg-muted">Catégorie</span>
        <RadioCards
          labelledBy={categoryId}
          value={draft.category}
          options={options.categories.map((category) => ({ value: category.code, label: category.label, description: category.description }))}
          onValueChange={(value) => {
            const category = CAMPAIGN_CATEGORIES.find((candidate) => candidate === value);
            if (category) onChange({ category });
          }}
        />
        <p className="text-caption text-fg-subtle">{CONSENT_NOTES[draft.category]}</p>
      </div>
    </div>
  );
}
