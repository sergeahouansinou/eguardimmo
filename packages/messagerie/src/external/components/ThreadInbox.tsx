'use client';

import { useEffect, useState } from 'react';
import { Alert, Button, Select, Tab, TabList, TabPanel, Tabs, TextField } from '@eguardimmo/ui';
import { EmptyBlock, ErrorBlock, LoadingBlock } from '../../components/parts';
import { threadErrorMessage } from '../api/errors';
import { useExternalConfig } from '../context';
import type { ThreadSummary } from '../model';
import { useMarkThread, useThreads, useUnreadMessages } from '../queries';
import { ThreadRow } from './ThreadRow';

type InboxTab = 'all' | 'unread' | 'archived';
const PAGE_SIZE = 25;
const SEARCH_DELAY_MS = 350;
const ALL = 'all';

export interface InboxScope {
  options: readonly { id: string; label: string }[];
  value: string | null;
  onChange: (id: string | null) => void;
}

export function ThreadInbox({ scope }: { scope?: InboxScope }) {
  const { copy } = useExternalConfig();
  const [tab, setTab] = useState<InboxTab>('all');
  const [input, setInput] = useState('');
  const [search, setSearch] = useState('');
  const [failure, setFailure] = useState<string | null>(null);
  const unread = useUnreadMessages();
  const mark = useMarkThread();
  const threads = useThreads({ search, archived: tab === 'archived', unread: tab === 'unread', scopeId: scope?.value ?? null, perPage: PAGE_SIZE });

  useEffect(() => {
    const timer = setTimeout(() => { setSearch(input); }, SEARCH_DELAY_MS);
    return () => { clearTimeout(timer); };
  }, [input]);

  const act = (thread: ThreadSummary, change: { read?: boolean; archived?: boolean }) => {
    setFailure(null);
    mark.mutate({ id: thread.id, ...change }, { onError: (error) => { setFailure(threadErrorMessage(error)); } });
  };

  const items = threads.data?.pages.flatMap((page) => page.items) ?? [];
  let content;
  if (threads.data === undefined) {
    content = threads.isError ? (
      <ErrorBlock message="Impossible de charger les messages." onRetry={() => { void threads.refetch(); }} />
    ) : (
      <LoadingBlock label="Chargement des messages" />
    );
  } else if (items.length === 0) {
    content = (
      <EmptyBlock
        title={search ? 'Aucune conversation ne correspond à votre recherche' : tab === 'all' ? copy.emptyInbox.title : 'Aucune conversation ici'}
        hint={search ? 'Essayez un autre mot-clé.' : tab === 'all' ? copy.emptyInbox.hint : undefined}
      />
    );
  } else {
    content = (
      <>
        <ul aria-label="Conversations" className="overflow-hidden rounded-lg border border-line bg-surface">
          {items.map((thread) => (
            <ThreadRow
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
      <Tabs value={tab} defaultValue={tab} onValueChange={(value) => { setTab(value === 'unread' || value === 'archived' ? value : 'all'); }}>
        <TabList aria-label="Filtrer les conversations">
          <Tab value="all">Toutes</Tab>
          <Tab value="unread" {...(unread === undefined ? {} : { count: unread })}>Non lues</Tab>
          <Tab value="archived">Archivées</Tab>
        </TabList>
        <div className="flex max-w-2xl flex-col gap-3 sm:flex-row sm:items-end">
          <div className="min-w-0 flex-1">
            <TextField
              label={copy.searchLabel}
              hideLabel
              type="search"
              placeholder={copy.searchPlaceholder}
              value={input}
              onChange={(event) => { setInput(event.target.value); }}
            />
          </div>
          {scope && scope.options.length > 1 ? (
            <div className="min-w-0 sm:w-64">
              <Select
                label={copy.scopeLabel}
                placeholder={copy.scopeAll}
                value={scope.value ?? ALL}
                onValueChange={(value) => { scope.onChange(value === ALL ? null : value); }}
                options={[{ value: ALL, label: copy.scopeAll }, ...scope.options.map((option) => ({ value: option.id, label: option.label }))]}
              />
            </div>
          ) : null}
        </div>
        {failure ? <Alert tone="danger" title="Action impossible">{failure}</Alert> : null}
        <TabPanel value={tab} className="flex min-w-0 flex-col gap-3">
          {content}
        </TabPanel>
      </Tabs>
    </div>
  );
}
