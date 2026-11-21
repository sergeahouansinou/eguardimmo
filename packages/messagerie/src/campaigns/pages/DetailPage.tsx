'use client';

import { Pencil, Undo2 } from 'lucide-react';
import { useState } from 'react';
import { Alert, Button, ConfirmDialog, Icon } from '@eguardimmo/ui';
import { ErrorBlock, LoadingBlock } from '../../components/parts';
import { formatDateTime } from '../../lib/dates';
import { campaignErrorMessage } from '../api/errors';
import { AttachmentsPanel } from '../components/AttachmentsPanel';
import { MetricsPanel } from '../components/MetricsPanel';
import { CampaignHeader, CampaignsGuard, StatusBadge } from '../components/parts';
import { useCampaignsConfig } from '../context';
import { CAMPAIGNS_TITLE } from '../copy';
import { isCancellable, isEditable } from '../model';
import type { Campaign } from '../model';
import { useCampaign, useCancelCampaign } from '../queries';

function Facts({ campaign }: { campaign: Campaign }) {
  const rows: [string, string | null][] = [
    ['Destinataires', campaign.recipientCount > 0 ? `${campaign.audienceLabel} (${String(campaign.recipientCount)})` : campaign.audienceLabel],
    ['Programmée pour', campaign.scheduledAt ? formatDateTime(campaign.scheduledAt) : null],
    ['Envoi commencé le', campaign.sendingStartedAt ? formatDateTime(campaign.sendingStartedAt) : null],
    ['Terminée le', campaign.sentAt ? formatDateTime(campaign.sentAt) : null],
    ['Annulée le', campaign.cancelledAt ? formatDateTime(campaign.cancelledAt) : null],
    ['Dans l’espace des destinataires', campaign.copyToHistory ? 'Oui' : 'Non'],
  ];
  return (
    <dl className="flex min-w-0 flex-col gap-1.5 text-body">
      {rows.flatMap(([label, value]) =>
        value === null
          ? []
          : [
              <div key={label} className="flex min-w-0 flex-col sm:flex-row sm:gap-4">
                <dt className="text-fg-subtle sm:w-56 sm:shrink-0">{label}</dt>
                <dd className="min-w-0 break-words text-fg">{value}</dd>
              </div>,
            ],
      )}
    </dl>
  );
}

function DetailBody({ campaign }: { campaign: Campaign }) {
  const { routes, Link } = useCampaignsConfig();
  const cancel = useCancelCampaign();
  const [cancelling, setCancelling] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);
  const tracked = campaign.status === 'sending' || campaign.status === 'sent' || campaign.recipientCount > 0;

  return (
    <div className="flex min-w-0 flex-col gap-4">
      <CampaignHeader
        title={campaign.subject}
        breadcrumb={[{ label: 'Messages', href: routes.messages }, { label: CAMPAIGNS_TITLE, href: routes.list }, { label: campaign.subject }]}
        actions={
          <>
            <StatusBadge status={campaign.status} />
            {isEditable(campaign) ? (
              <Button asChild>
                <Link href={routes.edit(campaign.id)}>
                  <Icon icon={Pencil} />
                  Reprendre le brouillon
                </Link>
              </Button>
            ) : null}
            {isCancellable(campaign) ? (
              <Button variant="secondary" onClick={() => { setFailure(null); setCancelling(true); }}>
                <Icon icon={Undo2} />
                Annuler la programmation
              </Button>
            ) : null}
          </>
        }
      />
      {failure ? <Alert tone="danger" title="Annulation impossible">{failure}</Alert> : null}
      <div className="flex max-w-3xl min-w-0 flex-col gap-4">
        <section aria-label="Message" className="flex min-w-0 flex-col gap-2 rounded-lg border border-line bg-surface p-4">
          <Facts campaign={campaign} />
          {campaign.contentPurged ? (
            <Alert tone="info" title="Contenu effacé">Le texte de cette campagne a été effacé à l’échéance de sa durée de conservation.</Alert>
          ) : (
            <div className="flex min-w-0 flex-col gap-1 rounded-md border border-line bg-muted p-3">
              <span className="text-caption text-fg-subtle">Objet</span>
              <p className="text-body font-semibold break-words text-fg">{campaign.subject}</p>
              <span className="mt-2 text-caption text-fg-subtle">Message</span>
              <p className="text-body break-words whitespace-pre-wrap text-fg">{campaign.body}</p>
            </div>
          )}
        </section>
        {tracked ? <MetricsPanel campaign={campaign} /> : null}
        <AttachmentsPanel campaignId={campaign.id} attachments={campaign.attachments} editable={false} />
      </div>
      <ConfirmDialog
        open={cancelling}
        onOpenChange={setCancelling}
        title="Annuler la programmation ?"
        description="La campagne ne partira pas. Elle ne pourra plus être modifiée ni envoyée : créez-en une nouvelle si besoin."
        confirmLabel="Annuler la programmation"
        tone="danger"
        loading={cancel.isPending}
        onConfirm={() => {
          cancel.mutate(campaign.id, {
            onError: (error) => { setFailure(campaignErrorMessage(error)); },
            onSettled: () => { setCancelling(false); },
          });
        }}
      />
    </div>
  );
}

function DetailLoader({ campaignId }: { campaignId: string }) {
  const campaign = useCampaign(campaignId);
  if (campaign.data === undefined) {
    return campaign.isError ? (
      <ErrorBlock message={campaignErrorMessage(campaign.error)} onRetry={() => { void campaign.refetch(); }} />
    ) : (
      <LoadingBlock label="Chargement de la campagne" />
    );
  }
  return <DetailBody campaign={campaign.data} />;
}

export function CampaignDetailPage({ campaignId }: { campaignId: string }) {
  return (
    <CampaignsGuard>
      <DetailLoader campaignId={campaignId} />
    </CampaignsGuard>
  );
}
