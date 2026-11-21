'use client';

import { useState } from 'react';
import { Alert, Button } from '@eguardimmo/ui';
import { ErrorBlock, LoadingBlock } from '../../components/parts';
import { campaignErrorMessage } from '../api/errors';
import { EditorForm } from '../components/EditorForm';
import { CampaignHeader, CampaignsGuard } from '../components/parts';
import { useCampaignsConfig } from '../context';
import { CAMPAIGNS_TITLE } from '../copy';
import { isEditable } from '../model';
import { useAudiences, useCampaign } from '../queries';

function EditorBody({ campaignId }: { campaignId: string | null }) {
  const { routes, Link } = useCampaignsConfig();
  const audiences = useAudiences();
  const campaign = useCampaign(campaignId);
  const [generation, setGeneration] = useState(0);
  const title = campaignId === null ? 'Nouvelle campagne' : 'Modifier la campagne';
  const header = (
    <CampaignHeader
      title={title}
      subtitle="Le même message est envoyé par e-mail à tous les destinataires choisis."
      breadcrumb={[{ label: 'Messages', href: routes.messages }, { label: CAMPAIGNS_TITLE, href: routes.list }, { label: title }]}
    />
  );

  const failed = audiences.isError ? audiences.error : campaign.isError ? campaign.error : null;
  let content;
  if (audiences.data === undefined || (campaignId !== null && campaign.data === undefined)) {
    content =
      failed !== null ? (
        <ErrorBlock
          message={campaignErrorMessage(failed)}
          onRetry={() => {
            void audiences.refetch();
            if (campaignId !== null) void campaign.refetch();
          }}
        />
      ) : (
        <LoadingBlock label="Chargement de la campagne" />
      );
  } else if (campaign.data && !isEditable(campaign.data)) {
    content = (
      <Alert tone="warning" title="Cette campagne n’est plus modifiable">
        Seul un brouillon se modifie : une campagne programmée s’annule, une campagne envoyée ne change plus.
        <Button asChild variant="secondary" size="sm" className="mt-2">
          <Link href={routes.detail(campaign.data.id)}>Voir la campagne</Link>
        </Button>
      </Alert>
    );
  } else {
    content = (
      <EditorForm
        key={generation}
        existing={campaignId === null ? null : (campaign.data ?? null)}
        audiences={audiences.data}
        onReload={() => { void campaign.refetch().then(() => { setGeneration((value) => value + 1); }); }}
      />
    );
  }

  return (
    <div className="flex min-w-0 flex-col gap-4">
      {header}
      {content}
    </div>
  );
}

export function CampaignEditorPage({ campaignId = null }: { campaignId?: string | null }) {
  return (
    <CampaignsGuard>
      <EditorBody campaignId={campaignId} />
    </CampaignsGuard>
  );
}
