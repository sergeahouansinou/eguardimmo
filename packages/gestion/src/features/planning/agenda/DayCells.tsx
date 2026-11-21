'use client';

import { cx } from '@eguardimmo/ui';
import { useGestionNavigation } from '../../locataires/kit';
import { dayNumber, fullDayLabel, longDayLabel, weekdayShort } from './calendar';
import type { AgendaView } from './calendar';
import type { AgendaItem } from './items';

const MONTH_CELL_ITEMS = 3;

export interface DayCellsProps {
  view: AgendaView;
  days: readonly string[];
  items: ReadonlyMap<string, readonly AgendaItem[]>;
  today: string;
  anchor: string;
  onOpenDay: (day: string) => void;
}

function ItemLink({ item, view, hiddenOnWide }: { item: AgendaItem; view: AgendaView; hiddenOnWide: boolean }) {
  const { Link } = useGestionNavigation();
  return (
    <li className={cx(hiddenOnWide && 'md:hidden')}>
      <Link
        href={item.href}
        className={cx(
          'flex min-h-6 min-w-0 flex-wrap items-baseline gap-x-1.5 rounded-sm px-1 py-0.5 text-caption text-fg hover:bg-muted focus-visible:outline-2 focus-visible:outline-focus',
          item.alert && 'border-l-2 border-danger-fg',
        )}
      >
        {item.time ? <span className="tabular-nums text-fg-muted">{item.time}</span> : null}
        <span className={cx('min-w-0 font-medium [overflow-wrap:anywhere]', view === 'mois' && 'md:truncate')}>{item.title}</span>
        <span className={cx(item.alert ? 'text-danger-fg' : 'text-fg-subtle', view !== 'jour' && 'md:sr-only')}>
          <span className="sr-only"> — </span>
          {item.label}
        </span>
      </Link>
    </li>
  );
}

function DayCell({ day, entries, view, today, anchor, onOpenDay }: { day: string; entries: readonly AgendaItem[]; view: AgendaView; today: string; anchor: string; onOpenDay: (day: string) => void }) {
  const outsideMonth = view === 'mois' && day.slice(0, 7) !== anchor.slice(0, 7);
  const hiddenOnMobile = view === 'mois' && entries.length === 0;
  const hidden = entries.length > MONTH_CELL_ITEMS && view === 'mois' ? entries.length - MONTH_CELL_ITEMS : 0;
  return (
    <li
      aria-current={day === today ? 'date' : undefined}
      className={cx(
        'min-w-0 flex-col gap-1 rounded-md border border-line bg-surface p-2 md:rounded-none',
        view === 'mois' ? 'md:min-h-28' : 'md:min-h-40',
        day === today && 'border-action',
        outsideMonth && 'md:bg-muted',
        hiddenOnMobile ? 'hidden md:flex' : 'flex',
      )}
    >
      <h3 className="text-body-strong">
        {view === 'jour' ? (
          <time dateTime={day}>{fullDayLabel(day)}</time>
        ) : (
          <button
            type="button"
            onClick={() => { onOpenDay(day); }}
            className="inline-flex min-h-6 min-w-6 cursor-pointer items-center rounded-sm px-1 text-left hover:bg-muted focus-visible:outline-2 focus-visible:outline-focus"
          >
            <time dateTime={day}>
              <span className="md:sr-only">{longDayLabel(day)}</span>
              <span aria-hidden="true" className="hidden md:inline">{dayNumber(day)}</span>
            </time>
          </button>
        )}
      </h3>
      {entries.length === 0 ? (
        <p className={cx('text-caption text-fg-subtle', view === 'mois' && 'md:sr-only')}>Rien de prévu</p>
      ) : (
        <ul className="flex flex-col gap-0.5">
          {entries.map((item, index) => (
            <ItemLink key={item.key} item={item} view={view} hiddenOnWide={view === 'mois' && index >= MONTH_CELL_ITEMS} />
          ))}
        </ul>
      )}
      {hidden > 0 ? (
        <button
          type="button"
          onClick={() => { onOpenDay(day); }}
          className="hidden min-h-6 cursor-pointer items-center self-start rounded-sm px-1 text-caption text-action-on-subtle underline underline-offset-2 hover:bg-muted focus-visible:outline-2 focus-visible:outline-focus md:inline-flex"
        >
          {`+ ${String(hidden)} autre${hidden > 1 ? 's' : ''}`}
          <span className="sr-only">{` le ${longDayLabel(day)}`}</span>
        </button>
      ) : null}
    </li>
  );
}

export function DayCells({ view, days, items, today, anchor, onOpenDay }: DayCellsProps) {
  const weekdays = days.slice(0, 7);
  return (
    <div className="flex flex-col gap-2">
      {view === 'jour' ? null : (
        <div aria-hidden="true" className="hidden grid-cols-7 text-center text-caption text-fg-subtle md:grid">
          {weekdays.map((day) => (
            <span key={day} className="capitalize">{weekdayShort(day)}</span>
          ))}
        </div>
      )}
      <ol className={cx('grid grid-cols-1 gap-2 md:gap-px md:bg-line', view !== 'jour' && 'md:grid-cols-7')}>
        {days.map((day) => (
          <DayCell key={day} day={day} entries={items.get(day) ?? []} view={view} today={today} anchor={anchor} onOpenDay={onOpenDay} />
        ))}
      </ol>
    </div>
  );
}
