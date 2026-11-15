'use client';

import { ChevronDown, ChevronUp, Download, FileText, KeyRound, LogIn, ShieldAlert, Wallet } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { Fragment } from 'react';
import type { ReactNode } from 'react';
import { Avatar, Badge, Icon, IconButton } from '@eguardimmo/ui';
import type { BadgeTone } from '@eguardimmo/ui';
import { DataTable, Td, Th } from '../../outils/kit';
import { formatDate, formatDateTimeOffset, formatTime, isoDay } from '../shared/dates';
import { EVENT_TYPE_LABELS } from './schemas';
import type { EventType, JournalEvent } from './schemas';

const TYPE_STYLE: Record<EventType, { tone: BadgeTone; icon: LucideIcon }> = {
  connexion: { tone: 'neutral', icon: LogIn },
  droits: { tone: 'warning', icon: KeyRound },
  paiement: { tone: 'success', icon: Wallet },
  document: { tone: 'info', icon: FileText },
  export: { tone: 'info', icon: Download },
  securite: { tone: 'danger', icon: ShieldAlert },
};

export function dayLabel(day: string, today: string): string {
  const label = formatDate(day);
  if (day === today) return `Aujourd'hui, ${label}`;
  const yesterday = isoDay(new Date(new Date(`${today}T12:00:00Z`).getTime() - 86_400_000).toISOString());
  return day === yesterday ? `Hier, ${label}` : label;
}

export function TypeBadge({ type }: { type: EventType }) {
  const style = TYPE_STYLE[type];
  return (
    <Badge tone={style.tone}>
      <Icon icon={style.icon} size={14} />
      {EVENT_TYPE_LABELS[type]}
    </Badge>
  );
}

function Detail({ item }: { item: JournalEvent }) {
  const pairs: [string, ReactNode][] = [];
  if (item.before !== undefined) pairs.push(['Avant', <Badge key="avant">{item.before}</Badge>]);
  if (item.after !== undefined) pairs.push(['Après', <Badge key="apres">{item.after}</Badge>]);
  pairs.push(['Horodatage', formatDateTimeOffset(item.at)], ['Appareil', item.device], ['Identifiant', item.id], ['Empreinte', item.fingerprint]);
  return (
    <dl className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-3 gap-y-1 text-[13px] sm:grid-cols-[140px_minmax(0,1fr)_140px_minmax(0,1fr)]">
      {pairs.map(([term, value]) => (
        <Fragment key={term}>
          <dt className="text-fg-subtle">{term}</dt>
          <dd className="text-fg">{value}</dd>
        </Fragment>
      ))}
    </dl>
  );
}

export interface JournalTableProps {
  rows: readonly JournalEvent[];
  today: string;
  expanded: ReadonlySet<string>;
  onToggle: (id: string) => void;
}

export function JournalTable({ rows, today, expanded, onToggle }: JournalTableProps) {
  return (
    <DataTable caption="Événements du journal d'activité">
      <thead>
        <tr>
          <Th>Heure</Th>
          <Th>Membre</Th>
          <Th>Type</Th>
          <Th>Action</Th>
          <Th>Détail</Th>
          <Th>Origine</Th>
          <Th>Voir</Th>
        </tr>
      </thead>
      <tbody>
        {rows.map((item, index) => {
          const day = isoDay(item.at);
          const startsDay = index === 0 || isoDay(rows[index - 1]?.at ?? item.at) !== day;
          const open = expanded.has(item.id);
          return (
            <Fragment key={item.id}>
              {startsDay ? (
                <tr>
                  <td colSpan={7} className="h-8 border-b border-line bg-muted px-2 text-caption font-medium text-fg-muted">
                    {dayLabel(day, today)}
                  </td>
                </tr>
              ) : null}
              <tr className={open ? 'bg-action-subtle' : undefined}>
                <Td className="w-14 text-fg-subtle tabular-nums">{formatTime(item.at)}</Td>
                <Td strong>
                  <span className="flex items-center gap-2">
                    <Avatar initials={item.initials} />
                    {item.member}
                  </span>
                </Td>
                <Td>
                  <TypeBadge type={item.type} />
                </Td>
                <Td strong>{item.action}</Td>
                <Td className="text-[13px] text-fg-subtle">{item.detail}</Td>
                <Td className="text-[13px] text-fg-subtle">{item.origin}</Td>
                <Td>
                  <IconButton
                    label={open ? 'Masquer le détail' : 'Afficher le détail'}
                    icon={open ? ChevronUp : ChevronDown}
                    aria-expanded={open}
                    aria-controls={open ? `journal-detail-${item.id}` : undefined}
                    onClick={() => { onToggle(item.id); }}
                  />
                </Td>
              </tr>
              {open ? (
                <tr id={`journal-detail-${item.id}`} className="bg-action-subtle">
                  <td />
                  <td colSpan={6} className="border-b border-line p-2">
                    <Detail item={item} />
                  </td>
                </tr>
              ) : null}
            </Fragment>
          );
        })}
      </tbody>
    </DataTable>
  );
}
