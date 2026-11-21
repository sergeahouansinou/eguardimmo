import type { ComponentProps } from 'react';
import { cx } from '../../lib/cx';

export function Table({ className, scrollLabel, ...props }: ComponentProps<'table'> & { scrollLabel?: string }) {
  const scroll = scrollLabel === undefined ? {} : { role: 'region', 'aria-label': scrollLabel, tabIndex: 0 };
  return (
    <div {...scroll} className="relative min-w-0 overflow-x-auto focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus">
      <table {...props} className={cx('w-full border-collapse text-body text-fg-muted', className)} />
    </div>
  );
}

export function TableHead(props: ComponentProps<'thead'>) {
  return <thead {...props} />;
}

export function TableBody(props: ComponentProps<'tbody'>) {
  return <tbody {...props} />;
}

export function TableRow({ selected = false, className, ...props }: ComponentProps<'tr'> & { selected?: boolean }) {
  return (
    <tr
      {...props}
      data-selected={selected ? true : undefined}
      className={cx('border-b border-line last:border-b-0', selected && 'bg-action-subtle', className)}
    />
  );
}

export function TableHeaderCell({
  numeric = false,
  className,
  ...props
}: ComponentProps<'th'> & { numeric?: boolean }) {
  return (
    <th
      scope="col"
      {...props}
      className={cx(
        'h-7 border-b border-line px-2 text-caption font-medium whitespace-nowrap text-fg-subtle',
        numeric ? 'text-right' : 'text-left',
        className,
      )}
    />
  );
}

export function TableCell({
  numeric = false,
  strong = false,
  className,
  ...props
}: ComponentProps<'td'> & { numeric?: boolean; strong?: boolean }) {
  return (
    <td
      {...props}
      className={cx(
        'h-9 px-2 whitespace-nowrap [&_a]:min-h-6 [&_a]:py-1.5',
        numeric && 'text-right tabular-nums',
        strong && 'font-medium text-fg',
        className,
      )}
    />
  );
}
