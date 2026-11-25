'use client';

import { useQueryClient } from '@tanstack/react-query';
import { PlatformState } from '@/ui/PlatformState';
import { CampaignDetailView } from './CampaignDetailView';
import { CampaignEditor } from './editor/CampaignEditor';
import { useCampaign, useMarketingOptions } from './hooks';
import { unknownRecipientsKey } from './unknownRecipients';

const NOT_FOUND = {
  title: 'Campagne introuvable',
  description: 'Cette campagne n’existe pas ou n’existe plus.',
  backHref: '/marketing',
  backLabel: 'Retour aux campagnes',
};

/** Les données déjà lues restent affichées : un rafraîchissement en échec ne doit pas effacer une saisie en cours. */
export function CampaignScreen({ id }: { id: string }) {
  const campaign = useCampaign(id);
  const options = useMarketingOptions();
  const client = useQueryClient();
  const data = campaign.data;
  if (data === undefined) {
    return <PlatformState query={campaign} label="Le détail de la campagne" notFound={NOT_FOUND}>{() => null}</PlatformState>;
  }
  if (data.status !== 'draft') return <CampaignDetailView campaign={data} onRefresh={campaign.refetch} />;
  if (options.data === undefined) {
    return <PlatformState query={options} label="Le formulaire de campagne">{() => null}</PlatformState>;
  }
  return (
    <CampaignEditor
      key={data.id}
      campaign={data}
      options={options.data}
      initialUnknown={client.getQueryData<string[]>(unknownRecipientsKey(data.id)) ?? []}
      onCreated={() => undefined}
    />
  );
}
