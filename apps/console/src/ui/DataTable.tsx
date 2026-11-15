import { ChevronRight } from 'lucide-react';
import { Fragment } from 'react';
import type { ReactNode } from 'react';
import { Icon, Tooltip, cx } from '@eguardimmo/ui';
import type { LinkComponent } from '@eguardimmo/ui';

export interface Column<T> {
  id: string;
  header: string;
  cell: (row: T) => ReactNode;
  align?: 'right';
  primary?: boolean;
  className?: string;
}

export interface RowLink {
  href: string;
  label: string;
}

export interface DataTableProps<T> {
  label: string;
  columns: readonly Column<T>[];
  rows: readonly T[];
  rowKey: (row: T) => string;
  rowLink?: (row: T) => RowLink;
  rowActions?: (row: T) => ReactNode;
  groupLabel?: (row: T, previous: T | undefined) => string | null;
  Link: LinkComponent;
}

export function DataTable<T>({ label, columns, rows, rowKey, rowLink, rowActions, groupLabel, Link }: DataTableProps<T>) {
  const hasAction = rowLink !== undefined || rowActions !== undefined;
  return (
    <div className="overflow-x-auto max-sm:overflow-visible">
      <table aria-label={label} className="w-full border-collapse text-left text-body max-sm:block">
        <thead className="max-sm:sr-only">
          <tr className="border-b border-line">
            {columns.map((column) => (
              <th
                key={column.id}
                scope="col"
                className={cx(
                  'h-9 px-2 text-caption font-medium whitespace-nowrap text-fg-subtle',
                  column.align === 'right' && 'text-right',
                )}
              >
                {column.header}
              </th>
            ))}
            {hasAction ? (
              <th scope="col" className="w-10 px-2">
                <span className="sr-only">Actions</span>
              </th>
            ) : null}
          </tr>
        </thead>
        <tbody className="max-sm:flex max-sm:flex-col max-sm:gap-2">
          {rows.map((row, index) => {
            const group = groupLabel?.(row, rows[index - 1]) ?? null;
            const link = rowLink?.(row);
            return (
              <Fragment key={rowKey(row)}>
                {group ? (
                  <tr className="max-sm:block">
                    <th
                      scope="colgroup"
                      colSpan={columns.length + (hasAction ? 1 : 0)}
                      className="h-8 bg-muted px-2 text-left text-caption font-semibold text-fg-muted max-sm:block max-sm:rounded-sm max-sm:py-1.5"
                    >
                      {group}
                    </th>
                  </tr>
                ) : null}
                <tr
                  className={cx(
                    'border-b border-line last:border-b-0',
                    'max-sm:relative max-sm:flex max-sm:flex-col max-sm:gap-1 max-sm:rounded-md max-sm:border max-sm:p-3',
                  )}
                >
                  {columns.map((column) => (
                    <td
                      key={column.id}
                      data-label={column.primary ? undefined : column.header}
                      className={cx(
                        'min-h-11 px-2 py-2 align-middle',
                        column.align === 'right' && 'text-right max-sm:text-left',
                        column.primary && 'font-medium text-fg max-sm:pr-10',
                        'max-sm:flex max-sm:min-h-0 max-sm:items-center max-sm:gap-2 max-sm:p-0',
                        'max-sm:before:w-28 max-sm:before:shrink-0 max-sm:before:text-caption max-sm:before:text-fg-subtle max-sm:before:content-[attr(data-label)]',
                        column.className,
                      )}
                    >
                      {column.cell(row)}
                    </td>
                  ))}
                  {hasAction ? (
                    <td className="w-10 px-1 align-middle max-sm:absolute max-sm:top-2 max-sm:right-2 max-sm:w-auto max-sm:p-0">
                      <div className="flex items-center justify-end gap-1">
                        {rowActions?.(row)}
                        {link ? (
                          <Tooltip content={link.label}>
                            <Link
                              href={link.href}
                              aria-label={link.label}
                              className="inline-flex size-7 items-center justify-center rounded-sm text-fg-muted hover:bg-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
                            >
                              <Icon icon={ChevronRight} size={16} />
                            </Link>
                          </Tooltip>
                        ) : null}
                      </div>
                    </td>
                  ) : null}
                </tr>
              </Fragment>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
