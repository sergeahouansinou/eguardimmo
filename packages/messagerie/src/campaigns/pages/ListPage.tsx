'use client';

import { Plus } from 'lucide-react';
import { useState } from 'react';
import { Button, Icon, Tab, TabList, TabPanel, Tabs } from '@eguardimmo/ui';
import { ErrorBlock, LoadingBlock } from '../../components/parts';
import { campaignErrorMessage } from '../api/errors';
import { CampaignList } from '../components/CampaignList';
import { FilterBar } from '../components/FilterBar';
import { CampaignHeader, CampaignsGuard } from '../components/parts';
import { StatsRow } from '../components/StatsRow';
import { useCampaignsConfig } from '../context';
import { CAMPAIGNS_SUBTITLE, CAMPAIGNS_TITLE, tabLabels } from '../copy';
import { ALL_BUILDINGS, CAMPAIGN_TABS } from '../model';
import type { CampaignPeriod, CampaignTab } from '../model';
import { useAudiences, useCampaigns } from '../queries';
import { useDebounced } from '../useDebounced';

const PAGE_SIZE = 25;
const SEARCH_DELAY_MS = 300;

function ListBody() {
  const { routes, Link } = useCampaignsConfig();
  const [tab, setTab] = useState<CampaignTab>('all');
  const [search, setSearch] = useState('');
  const [building, setBuilding] = useState(ALL_BUILDINGS);
  const [period, setPeriod] = useState<CampaignPeriod>('all');
  const needle = useDebounced(search, SEARCH_DELAY_MS);
  const campaigns = useCampaigns({ tab, search: needle, building, period, perPage: PAGE_SIZE });
  const audiences = useAudiences();
  const buildings = audiences.data?.find((option) => option.audience === 'tenants')?.buildings ?? [];
  const first = campaigns.data?.pages[0];
  const items = campaigns.data?.pages.flatMap((page) => page.items) ?? [];
  const filtered = needle !== '' || building !== ALL_BUILDINGS || period !== 'all';

  let content;
  if (first === undefined) {
    content = campaigns.isError ? (
      <ErrorBlock message={campaignErrorMessage(campaigns.error)} onRetry={() => { void campaigns.refetch(); }} />
    ) : (
      <LoadingBlock label="Chargement des campagnes" />
    );
  } else {
    content = (
      <CampaignList
        items={items}
        filtered={filtered}
        hasMore={campaigns.hasNextPage}
        loadingMore={campaigns.isFetchingNextPage}
        onLoadMore={() => { void campaigns.fetchNextPage(); }}
      />
    );
  }

  return (
    <div className="flex min-w-0 flex-col gap-4">
      <CampaignHeader
        title={CAMPAIGNS_TITLE}
        subtitle={CAMPAIGNS_SUBTITLE}
        actions={
          <Button asChild>
            <Link href={routes.newCampaign}>
              <Icon icon={Plus} />
              Nouvelle campagne
            </Link>
          </Button>
        }
      />
      {first ? <StatsRow stats={first.stats} /> : null}
      <Tabs value={tab} defaultValue={tab} onValueChange={(value) => { setTab(CAMPAIGN_TABS.find((candidate) => candidate === value) ?? 'all'); }}>
        <TabList aria-label="Filtrer les campagnes">
          {CAMPAIGN_TABS.map((item) => (
            <Tab key={item} value={item} {...(first ? { count: first.counts[item] } : {})}>
              {tabLabels[item]}
            </Tab>
          ))}
        </TabList>
        <FilterBar
          search={search}
          building={building}
          period={period}
          buildings={buildings}
          onSearchChange={setSearch}
          onBuildingChange={setBuilding}
          onPeriodChange={setPeriod}
        />
        <TabPanel value={tab} className="flex min-w-0 flex-col gap-3">
          {content}
        </TabPanel>
      </Tabs>
    </div>
  );
}

export function CampaignsListPage() {
  return (
    <CampaignsGuard>
      <ListBody />
    </CampaignsGuard>
  );
}
