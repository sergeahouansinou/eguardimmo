'use client';

import { Plus } from 'lucide-react';
import { useState } from 'react';
import { Button, Icon } from '@eguardimmo/ui';
import { CampaignForm } from '../components/CampaignForm';
import { CampaignList } from '../components/CampaignList';
import { EmptyBlock, PageHeader } from '../components/parts';
import { useMessagerieConfig } from '../config';
import type { CampaignQuery } from '../data/inputs';

function Unavailable() {
  return <EmptyBlock title="Les campagnes ne sont pas disponibles dans cet espace" />;
}

export function CampaignsPage() {
  const { profile, routes, Link } = useMessagerieConfig();
  const [tab, setTab] = useState<CampaignQuery['tab']>('all');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);

  if (!profile.campaigns) return <Unavailable />;

  return (
    <div className="flex min-w-0 flex-col gap-4">
      <PageHeader
        title="Campagnes"
        subtitle={profile.campaigns.subtitle}
        breadcrumb={[{ label: profile.inbox.title, href: routes.inbox }, { label: 'Campagnes' }]}
        actions={
          <Button asChild>
            <Link href={routes.newCampaign}>
              <Icon icon={Plus} />
              Nouvelle campagne
            </Link>
          </Button>
        }
      />
      <CampaignList
        tab={tab}
        search={search}
        page={page}
        onTabChange={(next) => {
          setTab(next);
          setPage(1);
        }}
        onSearchChange={(next) => {
          setSearch(next);
          setPage(1);
        }}
        onPageChange={setPage}
      />
    </div>
  );
}

export function NewCampaignPage({ campaignId = null }: { campaignId?: string | null }) {
  const { profile, routes } = useMessagerieConfig();
  if (!profile.campaigns) return <Unavailable />;
  return (
    <div className="flex min-w-0 flex-col gap-4">
      <PageHeader
        title={campaignId ? 'Modifier la campagne' : 'Nouvelle campagne'}
        subtitle="Le même message est envoyé par e-mail à tous les destinataires choisis."
        breadcrumb={[
          { label: profile.inbox.title, href: routes.inbox },
          { label: 'Campagnes', href: routes.campaigns },
          { label: campaignId ? 'Modifier' : 'Nouvelle campagne' },
        ]}
      />
      <CampaignForm campaignId={campaignId} />
    </div>
  );
}
