'use client';

import { ChartColumn } from 'lucide-react';
import { Button, Dialog, DialogContent, DialogTrigger, Icon } from '@eguardimmo/ui';
import type { Campaign } from '../data/schemas';
import { formatDateTime } from '../lib/dates';

function percent(part: number, total: number): string {
  return total === 0 ? '0 %' : `${String(Math.round((part * 100) / total))} %`;
}

export function CampaignTracking({ campaign }: { campaign: Campaign }) {
  const read = campaign.readCount ?? 0;
  const rows: { label: string; value: string }[] = [
    { label: 'Destinataires', value: `${campaign.audienceLabel}, ${String(campaign.recipientCount)}` },
    { label: 'Envoyée le', value: campaign.sentAt ? formatDateTime(campaign.sentAt) : 'Pas encore envoyée' },
    { label: 'Lus', value: `${String(read)} sur ${String(campaign.recipientCount)} (${percent(read, campaign.recipientCount)})` },
    { label: 'Échecs', value: `${String(campaign.failedCount)} sans e-mail valide` },
  ];
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="secondary" size="sm" aria-label={`Voir le suivi de ${campaign.title}`}>
          <Icon icon={ChartColumn} />
          Voir le suivi
        </Button>
      </DialogTrigger>
      <DialogContent title={`Suivi : ${campaign.title}`} description="Lecture et échecs d’envoi de cette campagne.">
        <div className="flex flex-col gap-3 px-4 pt-3 pb-4">
          <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 text-body">
            {rows.map((row) => (
              <div key={row.label} className="contents">
                <dt className="text-fg-subtle">{row.label}</dt>
                <dd className="min-w-0 text-fg">{row.value}</dd>
              </div>
            ))}
          </dl>
          <div className="flex flex-col gap-1 rounded-md border border-line bg-muted p-3">
            <span className="text-caption text-fg-subtle">Objet : {campaign.subject}</span>
            <p className="text-body break-words whitespace-pre-wrap text-fg">{campaign.body}</p>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
