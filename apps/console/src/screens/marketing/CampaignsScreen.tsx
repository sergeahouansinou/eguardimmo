'use client';

import { Badge, Button, EmptyState, Select } from '@eguardimmo/ui';
import { Megaphone } from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';
import { formatDateTime, formatInteger } from '@/lib/format';
import { CAMPAIGN_STATUSES } from '@/platform/marketing/marketing';
import type { CampaignStatus, CampaignSummary } from '@/platform/marketing/marketing';
import { CursorPager } from '@/screens/abonnements/CursorPager';
import { useCursorPaging } from '@/screens/abonnements/useCursorPaging';
import { DataTable } from '@/ui/DataTable';
import type { Column } from '@/ui/DataTable';
import { FilterBar } from '@/ui/FilterBar';
import { PageHeader } from '@/ui/PageHeader';
import { PlatformState } from '@/ui/PlatformState';
import { useCampaigns } from './hooks';
import { CATEGORY_LABELS, CHANNEL_LABELS, STATUS_LABELS, STATUS_TONES } from './labels';

const PER_PAGE = 25;
const ALL = 'all';

const STATUS_OPTIONS = [{ value: ALL, label: 'Statut : tous' }, ...CAMPAIGN_STATUSES.map((value) => ({ value, label: STATUS_LABELS[value] }))];

function results(row: CampaignSummary): string {
  if (row.status === 'draft') return '—';
  return `${formatInteger(row.sent_count)} envoyés sur ${formatInteger(row.recipient_count)} · ${formatInteger(row.failed_count)} en échec · ${formatInteger(row.skipped_count)} écartés`;
}

const columns: Column<CampaignSummary>[] = [
  { id: 'title', header: 'Campagne', primary: true, cell: (row) => <span className="break-words">{row.title || 'Sans titre'}</span> },
  { id: 'channel', header: 'Canal', cell: (row) => CHANNEL_LABELS[row.channel] },
  { id: 'category', header: 'Catégorie', cell: (row) => CATEGORY_LABELS[row.category] },
  { id: 'audience', header: 'Destinataires', cell: (row) => row.audience_label },
  { id: 'status', header: 'Statut', cell: (row) => <Badge tone={STATUS_TONES[row.status]}>{STATUS_LABELS[row.status]}</Badge> },
  { id: 'results', header: 'Résultats', cell: results },
  { id: 'date', header: 'Date', cell: (row) => <span className="tabular-nums">{formatDateTime(row.sent_at ?? row.created_at)}</span> },
];

export function CampaignsScreen() {
  const paging = useCursorPaging();
  const [status, setStatus] = useState<CampaignStatus | null>(null);
  const query = useCampaigns({ perPage: PER_PAGE, cursor: paging.cursor, ...(status === null ? {} : { status }) });

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        Link={Link}
        title="Marketing"
        subtitle="Campagnes de la plateforme envoyées aux comptes, par e-mail ou par notification push."
        breadcrumb={[{ label: 'Vue d’ensemble', href: '/' }, { label: 'Marketing' }]}
        actions={
          <Button asChild>
            <Link href="/marketing/nouvelle">Nouvelle campagne</Link>
          </Button>
        }
      />
      <FilterBar label="Filtrer les campagnes">
        <Select
          label="Statut"
          hideLabel
          placeholder="Statut"
          className="w-full sm:w-64"
          options={STATUS_OPTIONS}
          value={status ?? ALL}
          onValueChange={(value) => {
            setStatus(CAMPAIGN_STATUSES.find((candidate) => candidate === value) ?? null);
            paging.reset();
          }}
        />
      </FilterBar>
      <PlatformState query={query} label="Le suivi des campagnes">
        {(page) =>
          page.rows.length === 0 ? (
            <EmptyState
              icon={Megaphone}
              title="Aucune campagne"
              description={status === null ? 'Créez la première campagne de la plateforme.' : 'Aucune campagne n’a ce statut.'}
            />
          ) : (
            <>
              <DataTable
                label="Campagnes"
                Link={Link}
                columns={columns}
                rows={page.rows}
                rowKey={(row) => row.id}
                rowLink={(row) => ({ href: `/marketing/${encodeURIComponent(row.id)}`, label: `Ouvrir la campagne ${row.title}` })}
              />
              <CursorPager paging={paging} hasMore={page.hasMore} nextCursor={page.nextCursor} />
            </>
          )
        }
      </PlatformState>
    </div>
  );
}
