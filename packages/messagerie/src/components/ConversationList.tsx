'use client';

import { stripRichText } from '../lib/richText';
import { Archive, ArchiveRestore, Ellipsis, MailCheck, MailOpen, Paperclip } from 'lucide-react';
import { useState } from 'react';
import {
  Alert,
  Avatar,
  Badge,
  Icon,
  IconButton,
  Menu,
  MenuContent,
  MenuItem,
  MenuTrigger,
  Pagination,
  Tab,
  TabList,
  TabPanel,
  Tabs,
  TextField,
  cx,
} from '@eguardimmo/ui';
import { useMessagerieConfig } from '../config';
import { useConversations, useSetConversationArchived, useSetConversationRead } from '../data/queries';
import type { ConversationSummary, ConversationTab } from '../data/schemas';
import { formatDayMonthTime } from '../lib/dates';
import { errorMessage } from '../lib/errors';
import { EmptyBlock, ErrorBlock, LoadingBlock, RoleBadge } from './parts';

export interface ConversationListProps {
  tab: ConversationTab;
  search: string;
  page: number;
  onTabChange: (tab: ConversationTab) => void;
  onSearchChange: (search: string) => void;
  onPageChange: (page: number) => void;
}

function ConversationRow({ item, onFailure }: { item: ConversationSummary; onFailure: (message: string) => void }) {
  const { Link, routes, profile } = useMessagerieConfig();
  const setRead = useSetConversationRead();
  const setArchived = useSetConversationArchived();
  const byCounterpart = profile.inbox.listTitle === 'counterpart';
  const title = byCounterpart ? item.counterpart.name : item.subject;

  return (
    <li className="flex min-w-0 items-stretch border-b border-line last:border-b-0">
      <Link
        href={routes.conversation(item.id)}
        className={cx(
          'flex min-w-0 flex-1 items-start gap-3 px-3 py-3 hover:bg-muted',
          'focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-focus',
        )}
      >
        <Avatar initials={item.counterpart.initials} size="md" />
        <span className="flex min-w-0 flex-1 flex-col gap-0.5">
          <span className="flex min-w-0 items-baseline justify-between gap-2">
            <span className={cx('min-w-0 truncate text-body', item.unread ? 'font-semibold text-fg' : 'text-fg')}>
              {item.unread ? <span className="sr-only">Non lu, </span> : null}
              {title}
            </span>
            <time dateTime={item.lastMessageAt} className="shrink-0 text-caption text-fg-subtle">
              {formatDayMonthTime(item.lastMessageAt)}
            </time>
          </span>
          <span className="truncate text-caption text-fg-muted">
            {byCounterpart ? `${item.subject} — ${stripRichText(item.preview)}` : `${item.counterpart.name} — ${stripRichText(item.preview)}`}
          </span>
          <span className="flex flex-wrap items-center gap-1.5">
            <RoleBadge role={item.counterpart.role} />
            {item.tag ? <Badge>{item.tag}</Badge> : null}
            {item.awaitingReply ? <Badge tone="warning">À répondre</Badge> : null}
            {item.hasAttachments ? (
              <span className="inline-flex items-center gap-1 text-caption text-fg-subtle">
                <Icon icon={Paperclip} size={14} label="Pièce jointe" />
              </span>
            ) : null}
          </span>
        </span>
        {item.unread ? <span aria-hidden="true" className="mt-2 size-2 shrink-0 rounded-full bg-action" /> : null}
      </Link>
      <div className="flex items-start px-1.5 py-3">
        <Menu>
          <MenuTrigger asChild>
            <IconButton label={`Actions pour ${item.subject}`} icon={Ellipsis} />
          </MenuTrigger>
          <MenuContent>
            <MenuItem
              icon={item.unread ? MailOpen : MailCheck}
              onSelect={() => {
                setRead.mutate({ id: item.id, read: item.unread }, { onError: (error) => { onFailure(errorMessage(error)); } });
              }}
            >
              {item.unread ? 'Marquer comme lu' : 'Marquer comme non lu'}
            </MenuItem>
            <MenuItem
              icon={item.archived ? ArchiveRestore : Archive}
              onSelect={() => {
                setArchived.mutate(
                  { id: item.id, archived: !item.archived },
                  { onError: (error) => { onFailure(errorMessage(error)); } },
                );
              }}
            >
              {item.archived ? 'Désarchiver' : 'Archiver'}
            </MenuItem>
          </MenuContent>
        </Menu>
      </div>
    </li>
  );
}

export function ConversationList({ tab, search, page, onTabChange, onSearchChange, onPageChange }: ConversationListProps) {
  const { profile } = useMessagerieConfig();
  const [failure, setFailure] = useState<string | null>(null);
  const query = useConversations({ tab, search, page, pageSize: profile.inbox.pageSize });
  const data = query.data;

  const handleTab = (value: string) => {
    const next = profile.inbox.tabs.find((candidate) => candidate.id === value);
    if (next) onTabChange(next.id);
  };

  let content;
  if (data === undefined) {
    content = query.isError ? (
      <ErrorBlock message="Impossible de charger les messages." onRetry={query.refetch} />
    ) : (
      <LoadingBlock label="Chargement des messages" />
    );
  } else if (data.items.length === 0) {
    content = (
      <EmptyBlock
        title={search ? 'Aucun message ne correspond à votre recherche' : 'Aucun message ici'}
        hint={search ? 'Essayez un autre mot-clé.' : profile.inbox.emptyHint}
      />
    );
  } else {
    content = (
      <>
        <ul aria-label="Conversations" className="overflow-hidden rounded-lg border border-line bg-surface">
          {data.items.map((item) => (
            <ConversationRow key={item.id} item={item} onFailure={setFailure} />
          ))}
        </ul>
        <Pagination page={data.page} pageSize={data.pageSize} total={data.total} onPageChange={onPageChange} label="Pagination des messages" />
      </>
    );
  }

  return (
    <div className="flex min-w-0 flex-col gap-3">
      <Tabs value={tab} defaultValue={tab} onValueChange={handleTab}>
        <TabList aria-label="Filtrer les messages">
          {profile.inbox.tabs.map((item) => (
            <Tab key={item.id} value={item.id} {...(data ? { count: data.counts[item.id] } : {})}>
              {item.label}
            </Tab>
          ))}
        </TabList>
        <div className="max-w-md">
          <TextField
            label={profile.inbox.searchLabel}
            hideLabel
            type="search"
            placeholder={profile.inbox.searchPlaceholder}
            value={search}
            onChange={(event) => { onSearchChange(event.target.value); }}
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
