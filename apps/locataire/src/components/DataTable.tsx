import { cx } from '@eguardimmo/ui';
import type { ReactNode } from 'react';

export interface Column<Row> {
  id: string;
  header: string;
  cell: (row: Row) => ReactNode;
  numeric?: boolean;
  primary?: boolean;
  mobileLabel?: string;
}

export interface DataTableProps<Row> {
  label: string;
  columns: readonly Column<Row>[];
  rows: readonly Row[];
  rowKey: (row: Row) => string;
  rowClassName?: (row: Row) => string | undefined;
}

export function DataTable<Row>({ label, columns, rows, rowKey, rowClassName }: DataTableProps<Row>) {
  return (
    <div className="min-w-0 overflow-x-auto max-sm:overflow-visible">
      <table aria-label={label} className="w-full border-collapse text-body max-sm:block">
        <thead className="max-sm:hidden">
          <tr className="border-b border-line">
            {columns.map((column) => (
              <th
                key={column.id}
                scope="col"
                className={cx('h-8 px-2 text-caption font-medium text-fg-subtle', column.numeric ? 'text-right' : 'text-left')}
              >
                {column.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="max-sm:flex max-sm:flex-col max-sm:gap-2">
          {rows.map((row) => (
            <tr
              key={rowKey(row)}
              className={cx(
                'border-b border-line last:border-b-0',
                'max-sm:flex max-sm:flex-col max-sm:gap-1.5 max-sm:rounded-md max-sm:border max-sm:p-3',
                rowClassName?.(row),
              )}
            >
              {columns.map((column) => {
                const mobileLabel = column.primary ? '' : (column.mobileLabel ?? column.header);
                return (
                <td
                  key={column.id}
                  data-label={mobileLabel || undefined}
                  className={cx(
                    'min-h-11 px-2 py-1.5 align-middle',
                    column.numeric && 'text-right tabular-nums',
                    column.primary && 'font-semibold text-fg',
                    'max-sm:flex max-sm:min-h-0 max-sm:items-center max-sm:justify-between max-sm:gap-2 max-sm:p-0 max-sm:text-right',
                    column.primary && 'max-sm:block max-sm:text-left',
                    mobileLabel !== '' && 'max-sm:before:text-caption max-sm:before:font-medium max-sm:before:text-fg-subtle max-sm:before:content-[attr(data-label)]',
                  )}
                >
                  {column.cell(row)}
                </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
