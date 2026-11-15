import type { ComponentProps } from 'react';
import { cx } from '../../lib/cx';

export function Table({ className, ...props }: ComponentProps<'table'>) {
  return (
    <div className="relative min-w-0 overflow-x-auto">
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
        'h-9 px-2 whitespace-nowrap',
        numeric && 'text-right tabular-nums',
        strong && 'font-medium text-fg',
        className,
      )}
    />
  );
}
