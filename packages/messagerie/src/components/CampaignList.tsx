'use client';

import { useState } from 'react';
import { CalendarClock, ChartPie, Mail, TriangleAlert } from 'lucide-react';
import {
  Badge,
  Button,
  Pagination,
  Select,
  StatCard,
  Tab,
  TabList,
  TabPanel,
  Tabs,
  cx,
} from '@eguardimmo/ui';
import type { BadgeTone } from '@eguardimmo/ui';
import { useMessagerieConfig } from '../config';
import { ALL_BUILDINGS } from '../data/inputs';
import type { CampaignQuery } from '../data/inputs';
import { useCampaigns } from '../data/queries';
import type { Campaign, CampaignPeriod, CampaignStatus } from '../data/schemas';
import { formatDateTime } from '../lib/dates';
import { CampaignFilters } from './CampaignFilters';
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
  building: string;
  period: CampaignPeriod;
  page: number;
  onTabChange: (tab: CampaignTab) => void;
  onSearchChange: (search: string) => void;
  onBuildingChange: (building: string) => void;
  onPeriodChange: (period: CampaignPeriod) => void;
  onPageChange: (page: number) => void;
}

const ROW_GRID = 'md:grid-cols-[minmax(0,2fr)_minmax(0,1.3fr)_150px_80px_150px_auto]';
const PAGE_SIZES = [5, 10, 25].map((size) => ({ value: String(size), label: String(size) }));

function sendLabel(campaign: Campaign): string {
  if (campaign.status === 'envoyee' && campaign.sentAt) return formatDateTime(campaign.sentAt);
  if (campaign.status === 'programmee' && campaign.scheduledAt) return formatDateTime(campaign.scheduledAt);
  return '—';
}

function stateLabel(campaign: Campaign): string {
  const base = statusLabels[campaign.status];
  if (campaign.status !== 'envoyee' || campaign.failedCount === 0) return base;
  return `${base}, ${String(campaign.failedCount)} échec${campaign.failedCount > 1 ? 's' : ''}`;
}

function CampaignRow({ campaign }: { campaign: Campaign }) {
  const { Link, routes, profile } = useMessagerieConfig();
  const noun = profile.campaigns?.audienceNoun ?? 'destinataires';
  const sent = campaign.status === 'envoyee';
  return (
    <li
      className={cx(
        'grid min-w-0 grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 gap-y-0.5 border-b border-line px-3 py-3 last:border-b-0',
        ROW_GRID,
      )}
    >
      <span className="col-start-1 row-start-1 min-w-0 truncate text-body font-semibold text-fg md:col-auto md:row-auto">{campaign.title}</span>
      <span className="col-span-2 min-w-0 truncate text-caption text-fg-muted md:col-auto md:text-body">
        {campaign.audienceLabel}
        <span className="md:hidden">, </span>
        <span className="text-fg-subtle md:block md:text-caption">{`${String(campaign.recipientCount)} ${noun}`}</span>
      </span>
      <span className="col-span-2 text-caption text-fg-muted md:col-auto md:text-body">
        <span className="md:hidden">Envoi : </span>
        {sendLabel(campaign)}
      </span>
      <span className="col-span-2 text-caption text-fg-muted md:col-auto md:text-body">
        <span className="md:hidden">Lus : </span>
        {sent ? `${String(campaign.readCount ?? 0)} sur ${String(campaign.recipientCount)}` : '—'}
      </span>
      <span className="col-span-2 justify-self-start md:col-auto">
        <Badge tone={statusTones[campaign.status]}>{stateLabel(campaign)}</Badge>
      </span>
      <span className="col-start-2 row-start-1 justify-self-end md:col-auto md:row-auto">
        {sent ? (
          <CampaignTracking campaign={campaign} />
        ) : (
          <Button asChild variant="secondary" size="sm">
            <Link href={routes.editCampaign(campaign.id)} aria-label={`${campaign.status === 'brouillon' ? 'Reprendre' : 'Modifier'} ${campaign.title}`}>
              {campaign.status === 'brouillon' ? 'Reprendre' : 'Modifier'}
            </Link>
          </Button>
        )}
      </span>
    </li>
  );
}

export function CampaignList({
  tab,
  search,
  building,
  period,
  page,
  onTabChange,
  onSearchChange,
  onBuildingChange,
  onPeriodChange,
  onPageChange,
}: CampaignListProps) {
  const { profile } = useMessagerieConfig();
  const filters = profile.campaigns?.filters ?? { building: false, period: false };
  const filtered = (filters.building && building !== ALL_BUILDINGS) || (filters.period && period !== 'all');
  const [pageSize, setPageSize] = useState(10);
  const query = useCampaigns({
    tab,
    search,
    building: filters.building ? building : ALL_BUILDINGS,
    period: filters.period ? period : 'all',
    page,
    pageSize,
  });
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
    const narrowed = search !== '' || filtered;
    content = (
      <EmptyBlock
        title={
          filtered
            ? 'Aucune campagne ne correspond à ces filtres'
            : search
              ? 'Aucune campagne ne correspond à votre recherche'
              : 'Aucune campagne ici'
        }
        hint={
          filtered
            ? 'Modifiez l’immeuble ou la période.'
            : narrowed
              ? 'Essayez un autre mot-clé.'
              : 'Créez une campagne pour écrire à plusieurs personnes à la fois.'
        }
      />
    );
  } else {
    content = (
      <>
        <div className="overflow-hidden rounded-lg border border-line bg-surface">
          <div aria-hidden="true" className={cx('hidden gap-x-3 border-b border-line bg-muted px-3 py-2 text-caption text-fg-subtle md:grid', ROW_GRID)}>
            <span>Campagne</span>
            <span>Destinataires</span>
            <span>Envoi</span>
            <span>Lus</span>
            <span>État</span>
            <span />
          </div>
          <ul aria-label="Campagnes">
            {data.items.map((campaign) => (
              <CampaignRow key={campaign.id} campaign={campaign} />
            ))}
          </ul>
        </div>
        <div className="flex flex-wrap items-end justify-between gap-3">
          <Select
            label="Lignes par page"
            placeholder="10"
            value={String(pageSize)}
            onValueChange={(value) => {
              setPageSize(Number(value));
              onPageChange(1);
            }}
            options={PAGE_SIZES}
            className="w-36"
          />
          <Pagination
            page={data.page}
            pageSize={data.pageSize}
            total={data.total}
            onPageChange={onPageChange}
            label="Pagination des campagnes"
            className="min-w-full flex-1 border-t-0 pt-0 sm:min-w-0"
          />
        </div>
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
        <CampaignFilters
          search={search}
          searchPlaceholder={profile.campaigns?.searchPlaceholder ?? 'Ex. Coupure d’eau'}
          building={building}
          period={period}
          showBuilding={filters.building}
          showPeriod={filters.period}
          onSearchChange={onSearchChange}
          onBuildingChange={onBuildingChange}
          onPeriodChange={onPeriodChange}
        />
        <TabPanel value={tab} className="flex min-w-0 flex-col gap-3">
          {content}
        </TabPanel>
      </Tabs>
    </div>
  );
}
