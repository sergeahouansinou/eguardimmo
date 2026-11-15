'use client';

import { Megaphone, PenLine } from 'lucide-react';
import { useState } from 'react';
import { Button, Icon } from '@eguardimmo/ui';
import { ConversationList } from '../components/ConversationList';
import { InboxStats } from '../components/InboxStats';
import { PageHeader } from '../components/parts';
import { useMessagerieConfig } from '../config';
import type { ConversationTab } from '../data/schemas';

export function InboxPage() {
  const { profile, routes, Link } = useMessagerieConfig();
  const [tab, setTab] = useState<ConversationTab>(profile.inbox.tabs[0]?.id ?? 'all');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);

  return (
    <div className="flex min-w-0 flex-col gap-4">
      <PageHeader
        title={profile.inbox.title}
        subtitle={profile.inbox.subtitle}
        actions={
          <>
            {profile.campaigns ? (
              <Button asChild variant="secondary">
                <Link href={routes.campaigns}>
                  <Icon icon={Megaphone} />
                  Campagnes
                </Link>
              </Button>
            ) : null}
            <Button asChild>
              <Link href={routes.newMessage}>
                <Icon icon={PenLine} />
                Nouveau message
              </Link>
            </Button>
          </>
        }
      />
      {profile.inbox.showStats ? <InboxStats /> : null}
      <ConversationList
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
