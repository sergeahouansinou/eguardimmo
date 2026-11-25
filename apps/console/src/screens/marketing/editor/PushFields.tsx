'use client';

import { TextField, Textarea } from '@eguardimmo/ui';
import type { MarketingOptions } from '@/platform/marketing/marketing';
import { textLength } from '../campaignDraft';
import type { CampaignDraft, DraftErrors } from '../campaignDraft';
import { PushPreview } from './PushPreview';

export interface PushFieldsProps {
  draft: CampaignDraft;
  options: MarketingOptions;
  errors: DraftErrors;
  onChange: (changes: Partial<CampaignDraft>) => void;
}

export function PushFields({ draft, options, errors, onChange }: PushFieldsProps) {
  const { limits } = options;
  const counter = (value: string, max: number) => `${String(textLength(value))} sur ${String(max)} caractères`;
  return (
    <div className="flex min-w-0 flex-col gap-4 py-2">
      <TextField
        label="Titre"
        placeholder="Titre de la notification"
        hint={counter(draft.pushTitle, limits.push_title)}
        error={errors.pushTitle}
        value={draft.pushTitle}
        onChange={(event) => { onChange({ pushTitle: event.target.value }); }}
      />
      <Textarea
        label="Message"
        placeholder="Texte de la notification"
        rows={3}
        hint={counter(draft.pushBody, limits.push_body)}
        error={errors.pushBody}
        value={draft.pushBody}
        onChange={(event) => { onChange({ pushBody: event.target.value }); }}
      />
      <TextField
        label="Lien (facultatif)"
        placeholder="/loyers"
        hint="Page ouverte au toucher, en chemin relatif."
        error={errors.link}
        value={draft.link}
        autoComplete="off"
        maxLength={255}
        onChange={(event) => { onChange({ link: event.target.value.trim() }); }}
      />
      <PushPreview title={draft.pushTitle} body={draft.pushBody} link={draft.link} />
    </div>
  );
}
