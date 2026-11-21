'use client';

import { useEffect, useState } from 'react';
import { Alert, Button, Tab, TabList, TabPanel, Tabs, TextField } from '@eguardimmo/ui';
import { EmptyBlock, ErrorBlock, LoadingBlock } from '../../../components/parts';
import { staffErrorMessage } from '../api/errors';
import { staffKindCopy, staffTabLabels } from '../copy';
import { STAFF_TABS } from '../model';
import type { StaffKind, StaffTab, StaffThreadSummary } from '../model';
import { useStaffMarkThread, useStaffThreads } from '../queries';
import { StaffThreadRow } from './ThreadRow';

const PAGE_SIZE = 25;
const SEARCH_DELAY_MS = 350;

function isTab(value: string): value is StaffTab {
  return (STAFF_TABS as readonly string[]).includes(value);
}

export function StaffInbox({ kind }: { kind: StaffKind }) {
  const copy = staffKindCopy[kind];
  const [tab, setTab] = useState<StaffTab>('all');
  const [input, setInput] = useState('');
  const [search, setSearch] = useState('');
  const [failure, setFailure] = useState<string | null>(null);
  const mark = useStaffMarkThread();
  const threads = useStaffThreads({ kind, tab, search, perPage: PAGE_SIZE });
  const counts = threads.data?.pages[0]?.counts;

  useEffect(() => {
    const timer = setTimeout(() => { setSearch(input); }, SEARCH_DELAY_MS);
    return () => { clearTimeout(timer); };
  }, [input]);

  const act = (thread: StaffThreadSummary, change: { read?: boolean; archived?: boolean }) => {
    setFailure(null);
    mark.mutate({ id: thread.id, ...change }, { onError: (error) => { setFailure(staffErrorMessage(error)); } });
  };

  const items = threads.data?.pages.flatMap((page) => page.items) ?? [];
  let content;
  if (threads.data === undefined) {
    content = threads.isError ? (
      <ErrorBlock message={staffErrorMessage(threads.error)} onRetry={() => { void threads.refetch(); }} />
    ) : (
      <LoadingBlock label="Chargement des conversations" />
    );
  } else if (items.length === 0) {
    content = (
      <EmptyBlock
        title={search ? 'Aucune conversation ne correspond à votre recherche' : tab === 'all' ? copy.emptyTitle : 'Aucune conversation ici'}
        hint={search ? 'Essayez un autre mot-clé.' : tab === 'all' ? copy.emptyHint : undefined}
      />
    );
  } else {
    content = (
      <>
        <ul aria-label="Conversations" className="overflow-hidden rounded-lg border border-line bg-surface">
          {items.map((thread) => (
            <StaffThreadRow
              key={thread.id}
              thread={thread}
              onRead={(item) => { act(item, { read: true }); }}
              onArchive={(item) => { act(item, { archived: !item.archived }); }}
            />
          ))}
        </ul>
        {threads.hasNextPage ? (
          <div>
            <Button variant="secondary" loading={threads.isFetchingNextPage} onClick={() => { void threads.fetchNextPage(); }}>
              Afficher plus de conversations
            </Button>
          </div>
        ) : null}
      </>
    );
  }

  return (
    <div className="flex min-w-0 flex-col gap-3">
      <Tabs value={tab} defaultValue={tab} onValueChange={(value) => { if (isTab(value)) setTab(value); }}>
        <TabList aria-label="Filtrer les conversations">
          {STAFF_TABS.map((id) => (
            <Tab key={id} value={id} {...(counts && id !== 'all' ? { count: counts[id] } : {})}>
              {staffTabLabels[id]}
            </Tab>
          ))}
        </TabList>
        <div className="max-w-2xl">
          <TextField
            label="Rechercher une conversation"
            hideLabel
            type="search"
            placeholder="Objet de la conversation"
            value={input}
            onChange={(event) => { setInput(event.target.value); }}
          />
        </div>
        {failure ? <Alert tone="danger" title="Action impossible">{failure}</Alert> : null}
        <TabPanel value={tab} className="flex min-w-0 flex-col gap-3">
          {content}
        </TabPanel>
      </Tabs>
    </div>
  );
}
