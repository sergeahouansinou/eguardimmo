'use client';

import { CalendarClock, ChartPie, Mail, TriangleAlert } from 'lucide-react';
import {
  Badge,
  Button,
  Pagination,
  StatCard,
  Tab,
  TabList,
  TabPanel,
  Tabs,
  TextField,
} from '@eguardimmo/ui';
import type { BadgeTone } from '@eguardimmo/ui';
import { useMessagerieConfig } from '../config';
import type { CampaignQuery } from '../data/inputs';
import { useCampaigns } from '../data/queries';
import type { Campaign, CampaignStatus } from '../data/schemas';
import { formatDateTime } from '../lib/dates';
import { CampaignTracking } from './CampaignTracking';
import { EmptyBlock, ErrorBlock, LoadingBlock } from './parts';

type CampaignTab = CampaignQuery['tab'];

const tabs: { id: CampaignTab; label: string }[] = [
  { id: 'all', label: 'Toutes' },
  { id: 'envoyee', label: 'Envoyées' },
  { id: 'programmee', label: 'Programmées' },
  { id: 'brouillon', label: 'Brouillons' },
];

const statusLabels: Record<CampaignStatus, string> = {
  envoyee: 'Envoyée',
  programmee: 'Programmée',
  brouillon: 'Brouillon',
};

const statusTones: Record<CampaignStatus, BadgeTone> = {
  envoyee: 'success',
  programmee: 'info',
  brouillon: 'neutral',
};

export interface CampaignListProps {
  tab: CampaignTab;
  search: string;
  page: number;
  onTabChange: (tab: CampaignTab) => void;
  onSearchChange: (search: string) => void;
  onPageChange: (page: number) => void;
}

function whenLabel(campaign: Campaign): string {
  if (campaign.status === 'envoyee' && campaign.sentAt) return `Envoyée le ${formatDateTime(campaign.sentAt)}`;
  if (campaign.status === 'programmee' && campaign.scheduledAt) return `Prévue le ${formatDateTime(campaign.scheduledAt)}`;
  return 'Non envoyée';
}

function CampaignRow({ campaign }: { campaign: Campaign }) {
  const { Link, routes } = useMessagerieConfig();
  return (
    <li className="flex min-w-0 flex-wrap items-center justify-between gap-3 border-b border-line px-3 py-3 last:border-b-0">
      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="flex min-w-0 flex-wrap items-center gap-2">
          <span className="min-w-0 truncate text-body font-semibold text-fg">{campaign.title}</span>
          <Badge tone={statusTones[campaign.status]}>{statusLabels[campaign.status]}</Badge>
        </span>
        <span className="text-caption text-fg-muted">
          {campaign.audienceLabel}, {campaign.recipientCount} · {whenLabel(campaign)}
        </span>
        {campaign.status === 'envoyee' ? (
          <span className="text-caption text-fg-subtle">
            {campaign.readCount ?? 0} lus sur {campaign.recipientCount}
            {campaign.failedCount > 0 ? ` · ${String(campaign.failedCount)} échec${campaign.failedCount > 1 ? 's' : ''}` : ''}
          </span>
        ) : null}
      </div>
      {campaign.status === 'envoyee' ? (
        <CampaignTracking campaign={campaign} />
      ) : (
        <Button asChild variant="secondary" size="sm">
          <Link href={routes.editCampaign(campaign.id)} aria-label={`${campaign.status === 'brouillon' ? 'Reprendre' : 'Modifier'} ${campaign.title}`}>
            {campaign.status === 'brouillon' ? 'Reprendre' : 'Modifier'}
          </Link>
        </Button>
      )}
    </li>
  );
}

export function CampaignList({ tab, search, page, onTabChange, onSearchChange, onPageChange }: CampaignListProps) {
  const { profile } = useMessagerieConfig();
  const query = useCampaigns({ tab, search, page, pageSize: 8 });
  const data = query.data;

  const handleTab = (value: string) => {
    const next = tabs.find((candidate) => candidate.id === value);
    if (next) onTabChange(next.id);
  };

  let content;
  if (data === undefined) {
    content = query.isError ? (
      <ErrorBlock message="Impossible de charger les campagnes." onRetry={query.refetch} />
    ) : (
      <LoadingBlock label="Chargement des campagnes" />
    );
  } else if (data.items.length === 0) {
    content = (
      <EmptyBlock
        title={search ? 'Aucune campagne ne correspond à votre recherche' : 'Aucune campagne ici'}
        hint={search ? 'Essayez un autre mot-clé.' : 'Créez une campagne pour écrire à plusieurs personnes à la fois.'}
      />
    );
  } else {
    content = (
      <>
        <ul aria-label="Campagnes" className="overflow-hidden rounded-lg border border-line bg-surface">
          {data.items.map((campaign) => (
            <CampaignRow key={campaign.id} campaign={campaign} />
          ))}
        </ul>
        <Pagination page={data.page} pageSize={data.pageSize} total={data.total} onPageChange={onPageChange} label="Pagination des campagnes" />
      </>
    );
  }

  return (
    <div className="flex min-w-0 flex-col gap-4">
      {data ? (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard label="Envoyées ce mois" value={data.stats.thisMonth} icon={Mail} />
          <StatCard label="Programmées" value={data.stats.scheduled} icon={CalendarClock} />
          <StatCard
            label="Taux de lecture"
            value={data.stats.readRatePercent === null ? '—' : `${String(data.stats.readRatePercent)} %`}
            icon={ChartPie}
          >
            <span className="text-caption text-fg-subtle">{data.stats.readSummary}</span>
          </StatCard>
          <StatCard label="Échecs d’envoi" value={data.stats.failures} icon={TriangleAlert} tone={data.stats.failures > 0 ? 'danger' : 'default'}>
            {data.stats.failureDetail ? <span className="text-caption text-fg-subtle">{data.stats.failureDetail}</span> : null}
          </StatCard>
        </div>
      ) : null}
      <Tabs value={tab} defaultValue={tab} onValueChange={handleTab}>
        <TabList aria-label="Filtrer les campagnes">
          {tabs.map((item) => (
            <Tab key={item.id} value={item.id} {...(data ? { count: data.counts[item.id] } : {})}>
              {item.label}
            </Tab>
          ))}
        </TabList>
        <div className="max-w-md">
          <TextField
            label="Rechercher une campagne"
            hideLabel
            type="search"
            placeholder={profile.campaigns?.searchPlaceholder ?? 'Ex. Coupure d’eau'}
            value={search}
            onChange={(event) => { onSearchChange(event.target.value); }}
          />
        </div>
        <TabPanel value={tab} className="flex min-w-0 flex-col gap-3">
          {content}
        </TabPanel>
      </Tabs>
    </div>
  );
}
