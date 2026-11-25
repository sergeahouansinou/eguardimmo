'use client';

import { Button } from '@eguardimmo/ui';
import { useState } from 'react';
import type { CampaignDetail, MarketingOptions } from '@/platform/marketing/marketing';
import { useNotify } from '@/ui/notify';
import { useTestCampaign } from '../hooks';
import { CHANNEL_LABELS, campaignProblem } from '../labels';
import type { CampaignProblem } from '../labels';
import { SendDialog } from './SendDialog';

export interface CampaignActionsProps {
  saved: CampaignDetail | null;
  options: MarketingOptions;
  dirty: boolean;
  saving: boolean;
  onSave: () => void;
  onReload: () => void;
  onFailure: (failure: CampaignProblem | null) => void;
}

function blockerOf(saved: CampaignDetail | null, options: MarketingOptions, dirty: boolean): string | null {
  if (saved === null) return 'Enregistrez la campagne avant de la tester ou de l’envoyer.';
  if (dirty) return 'Enregistrez vos modifications avant de tester ou d’envoyer.';
  const channel = options.channels.find((entry) => entry.channel === saved.channel);
  if (channel?.enabled !== false) return null;
  return `Envoi désactivé pour le canal « ${CHANNEL_LABELS[saved.channel]} »${channel.reason ? ` : ${channel.reason}` : '.'}`;
}

export function CampaignActions({ saved, options, dirty, saving, onSave, onReload, onFailure }: CampaignActionsProps) {
  const notify = useNotify();
  const test = useTestCampaign();
  const [sending, setSending] = useState(false);
  const blocker = blockerOf(saved, options, dirty);

  const sendTest = async (id: string) => {
    onFailure(null);
    try {
      const { sentTo } = await test.mutateAsync(id);
      notify.success('Test envoyé', `Envoyé à ${sentTo}`);
    } catch (error) {
      onFailure(campaignProblem(error));
    }
  };

  return (
    <div className="flex flex-col gap-2 border-t border-line pt-3">
      {blocker ? <p id="campaign-blocker" className="text-caption text-fg-subtle">{blocker}</p> : null}
      <div className="flex flex-wrap justify-end gap-2 max-sm:[&>*]:flex-1">
        <Button variant="secondary" loading={saving} disabled={saved !== null && !dirty} onClick={onSave}>
          Enregistrer
        </Button>
        <Button
          variant="secondary"
          loading={test.isPending}
          disabled={blocker !== null}
          aria-describedby={blocker ? 'campaign-blocker' : undefined}
          onClick={() => { if (saved) void sendTest(saved.id); }}
        >
          Envoyer un test
        </Button>
        <Button
          disabled={blocker !== null}
          aria-describedby={blocker ? 'campaign-blocker' : undefined}
          onClick={() => { onFailure(null); setSending(true); }}
        >
          Envoyer
        </Button>
      </div>
      {sending && saved ? <SendDialog campaign={saved} onClose={() => { setSending(false); }} onReload={onReload} /> : null}
    </div>
  );
}
