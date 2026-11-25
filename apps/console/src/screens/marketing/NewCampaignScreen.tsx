'use client';

import { useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { PlatformState } from '@/ui/PlatformState';
import { CampaignEditor } from './editor/CampaignEditor';
import { useMarketingOptions } from './hooks';
import { unknownRecipientsKey } from './unknownRecipients';

export function NewCampaignScreen() {
  const options = useMarketingOptions();
  const router = useRouter();
  const client = useQueryClient();
  const [generation, setGeneration] = useState(0);
  if (options.data === undefined) {
    return <PlatformState query={options} label="Le formulaire de campagne">{() => null}</PlatformState>;
  }
  return (
    <CampaignEditor
      key={generation}
      campaign={null}
      options={options.data}
      initialUnknown={[]}
      onCreated={(campaign, unknownRecipients) => {
        client.setQueryData(unknownRecipientsKey(campaign.id), unknownRecipients);
        setGeneration((current) => current + 1);
        router.replace(`/marketing/${encodeURIComponent(campaign.id)}`);
      }}
    />
  );
}
