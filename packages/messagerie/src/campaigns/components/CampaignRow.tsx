'use client';

import { cx } from '@eguardimmo/ui';
import { Button } from '@eguardimmo/ui';
import { useCampaignsConfig } from '../context';
import { formatDateTime } from '../../lib/dates';
import { isEditable } from '../model';
import type { Campaign } from '../model';
import { StatusBadge } from './parts';

export const ROW_GRID = 'md:grid-cols-[minmax(0,2fr)_minmax(0,1.3fr)_150px_90px_140px_auto]';

function whenLabel(campaign: Campaign): string {
  if (campaign.status === 'sent' && campaign.sentAt) return formatDateTime(campaign.sentAt);
  if (campaign.status === 'scheduled' && campaign.scheduledAt) return formatDateTime(campaign.scheduledAt);
  if (campaign.status === 'sending' && campaign.sendingStartedAt) return formatDateTime(campaign.sendingStartedAt);
  return '—';
}

function readLabel(campaign: Campaign): string {
  if (campaign.status !== 'sent' && campaign.status !== 'sending') return '—';
  return `${String(campaign.metrics.read)} sur ${String(campaign.metrics.sent)}`;
}

export function CampaignRow({ campaign }: { campaign: Campaign }) {
  const { Link, routes } = useCampaignsConfig();
  const editable = isEditable(campaign);
  return (
    <li className={cx('grid min-w-0 grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 gap-y-0.5 border-b border-line px-3 py-3 last:border-b-0', ROW_GRID)}>
      <Link
        href={routes.detail(campaign.id)}
        className="col-start-1 row-start-1 min-w-0 truncate text-body font-semibold text-fg underline-offset-2 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus md:col-auto md:row-auto"
      >
        {campaign.subject}
      </Link>
      <span className="col-span-2 min-w-0 truncate text-caption text-fg-muted md:col-auto md:text-body">
        {campaign.audienceLabel}
        {campaign.recipientCount > 0 ? <span className="text-fg-subtle">{` · ${String(campaign.recipientCount)} destinataires`}</span> : null}
      </span>
      <span className="col-span-2 text-caption text-fg-muted md:col-auto md:text-body">
        <span className="md:hidden">Envoi : </span>
        {whenLabel(campaign)}
      </span>
      <span className="col-span-2 text-caption text-fg-muted md:col-auto md:text-body">
        <span className="md:hidden">Lus : </span>
        {readLabel(campaign)}
      </span>
      <span className="col-span-2 justify-self-start md:col-auto">
        <StatusBadge status={campaign.status} />
      </span>
      <span className="col-start-2 row-start-1 justify-self-end md:col-auto md:row-auto">
        <Button asChild variant="secondary" size="sm">
          <Link href={editable ? routes.edit(campaign.id) : routes.detail(campaign.id)} aria-label={`${editable ? 'Reprendre' : 'Voir le suivi de'} ${campaign.subject}`}>
            {editable ? 'Reprendre' : 'Suivi'}
          </Link>
        </Button>
      </span>
    </li>
  );
}
