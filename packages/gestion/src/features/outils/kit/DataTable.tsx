'use client';

import { ArrowDown, ArrowUp } from 'lucide-react';
import type { ComponentProps, ReactNode } from 'react';
import { Icon, cx } from '@eguardimmo/ui';

export type SortDirection = 'asc' | 'desc';

export function DataTable({ caption, className, children, ...props }: Omit<ComponentProps<'table'>, 'children'> & { caption: string; children: ReactNode }) {
  return (
    <div className="max-w-full overflow-x-auto">
      <table {...props} className={cx('w-full border-collapse text-body text-fg-muted', className)}>
        <caption className="sr-only">{caption}</caption>
        {children}
      </table>
    </div>
  );
}

export function Th({ numeric = false, className, ...props }: ComponentProps<'th'> & { numeric?: boolean }) {
  return (
    <th
      scope="col"
      {...props}
      className={cx('h-7 border-b border-line px-2 text-caption font-medium whitespace-nowrap text-fg-subtle', numeric ? 'text-right' : 'text-left', className)}
    />
  );
}

export function SortTh({
  label,
  active,
  direction,
  onSort,
  numeric = false,
}: {
  label: string;
  active: boolean;
  direction: SortDirection;
  onSort: () => void;
  numeric?: boolean;
}) {
  return (
    <Th numeric={numeric} aria-sort={active ? (direction === 'asc' ? 'ascending' : 'descending') : 'none'}>
      <button
        type="button"
        onClick={onSort}
        className={cx(
          'inline-flex items-center gap-1 rounded-sm text-caption font-medium hover:text-fg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus',
          active && 'text-action-on-subtle',
        )}
      >
        {label}
        {active ? <Icon icon={direction === 'asc' ? ArrowUp : ArrowDown} size={14} /> : null}
      </button>
    </Th>
  );
}

export function Td({ numeric = false, strong = false, className, ...props }: ComponentProps<'td'> & { numeric?: boolean; strong?: boolean }) {
  return (
    <td
      {...props}
      className={cx(
        'h-9 border-b border-line px-2 whitespace-nowrap',
        numeric && 'text-right tabular-nums',
        strong && 'font-medium text-fg',
        className,
      )}
    />
  );
}
