'use client';

import { Badge, Button } from '@eguardimmo/ui';
import { useState } from 'react';
import { CursorPager } from '../finances/rent/CursorPager';
import type { CursorPages } from '../finances/rent/CursorPager';
import { NoRows, useGestionNavigation } from '../locataires/kit';
import { QueryState } from '../orgapi/QueryState';
import { useOrgTimezone } from '../orgapi/hooks';
import { formatDateTimeFr } from '../orgapi/zone';
import { ActivityDetailDialog } from './ActivityDetailDialog';
import { useActivityEntries, useActivityRetry } from './hooks';
import { actorText, subjectHref, subjectTypeLabel, typeBadge } from './labels';
import type { ActivityEntry, ActivityFilters } from './model';

export interface ActivityEntryListProps {
  filters: ActivityFilters;
  pages: CursorPages;
  canOpenDetail: boolean;
  emptyMessage: string;
  label: string;
}

export function ActivityEntryList({ filters, pages, canOpenDetail, emptyMessage, label }: ActivityEntryListProps) {
  const timezone = useOrgTimezone();
  const entries = useActivityEntries({ ...filters, cursor: pages.cursor });
  const retry = useActivityRetry();
  const [openId, setOpenId] = useState<string | null>(null);

  const rows = entries.data;
  const zone = timezone.data;
  if (rows === undefined || zone === undefined) {
    const failing = rows === undefined ? entries : timezone;
    const title = rows === undefined ? 'Impossible de charger le journal d’activité' : 'Impossible de charger le fuseau horaire de l’organisation';
    return <QueryState query={failing} label="Chargement du journal d’activité" title={title} onRetry={retry} />;
  }
  if (rows.items.length === 0) return <NoRows>{emptyMessage}</NoRows>;

  return (
    <>
      <ol aria-label={label} className="m-0 flex list-none flex-col p-0">
        {rows.items.map((entry) => (
          <EntryRow key={entry.id} entry={entry} timezone={zone} onOpen={canOpenDetail ? () => { setOpenId(entry.id); } : null} />
        ))}
      </ol>
      <CursorPager pages={pages} nextCursor={rows.nextCursor} label="Pagination du journal d’activité" />
      <ActivityDetailDialog id={openId} timezone={zone} onClose={() => { setOpenId(null); }} />
    </>
  );
}

function EntryRow({ entry, timezone, onOpen }: { entry: ActivityEntry; timezone: string; onOpen: (() => void) | null }) {
  const { Link } = useGestionNavigation();
  const badge = typeBadge[entry.type];
  const href = entry.subject === null ? null : subjectHref(entry.subject);
  const origin = [entry.ip, entry.device].filter((part): part is string => part !== null && part !== '');
  return (
    <li className="flex flex-col gap-1 border-b border-line py-2 last:border-b-0 sm:flex-row sm:items-start sm:justify-between sm:gap-3">
      <div className="flex min-w-0 flex-col gap-0.5">
        <div className="flex flex-wrap items-center gap-2">
          <Badge tone={badge.tone}>{badge.label}</Badge>
          <span className="text-body-strong text-fg [overflow-wrap:anywhere]">{entry.label}</span>
        </div>
        <p className="m-0 text-caption text-fg-muted [overflow-wrap:anywhere]">
          <time dateTime={entry.occurredAt}>{formatDateTimeFr(entry.occurredAt, timezone)}</time>
          {` · ${actorText(entry.actor)}`}
          {entry.subject === null ? null : ` · ${subjectTypeLabel(entry.subject.type)}`}
          {href === null ? null : (
            <>
              {' · '}
              <Link href={href} className="text-action-on-subtle underline underline-offset-2">Ouvrir la fiche</Link>
            </>
          )}
        </p>
        {origin.length === 0 ? null : <p className="m-0 text-caption text-fg-subtle [overflow-wrap:anywhere]">{`Origine : ${origin.join(' · ')}`}</p>}
      </div>
      {onOpen === null ? null : (
        <Button variant="ghost" size="sm" onClick={onOpen} aria-label={`Détails : ${entry.label}`}>Détails</Button>
      )}
    </li>
  );
}
