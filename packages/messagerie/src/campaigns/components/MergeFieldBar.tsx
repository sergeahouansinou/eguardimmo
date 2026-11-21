'use client';

import { Button } from '@eguardimmo/ui';
import { MERGE_FIELDS } from '../mergeFields';
import type { CampaignAudienceKind } from '../model';

export interface MergeFieldBarProps {
  audience: CampaignAudienceKind;
  disabled: boolean;
  onInsert: (field: string) => void;
}

export function MergeFieldBar({ audience, disabled, onInsert }: MergeFieldBarProps) {
  return (
    <div role="group" aria-label="Champs de fusion" className="flex flex-wrap items-center gap-1.5">
      <span className="text-caption text-fg-subtle">Insérer</span>
      {MERGE_FIELDS[audience].map((field) => (
        <Button key={field} variant="secondary" size="sm" disabled={disabled} onClick={() => { onInsert(field); }}>
          {field}
        </Button>
      ))}
    </div>
  );
}
