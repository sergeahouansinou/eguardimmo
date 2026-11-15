'use client';

import { ArrowDown, ArrowUp, ArrowUpDown } from 'lucide-react';
import { Checkbox, Icon, Pagination, Select, Table, TableBody, TableCell, TableHead, TableHeaderCell, TableRow } from '@eguardimmo/ui';
import type { ReactNode } from 'react';
import type { ListState } from '../hooks/useListState';
import { clampPage, paginate, sortItems } from '../lib/list';

export interface Column<T> {
  id: string;
  header: string;
  cell: (row: T) => ReactNode;
  sortBy?: (row: T) => string | number | null;
  numeric?: boolean;
  strong?: boolean;
  hideHeader?: boolean;
}

export interface DataTableProps<T> {
  label: string;
  rows: readonly T[];
  columns: readonly Column<T>[];
  getId: (row: T) => string;
  list: ListState;
  empty: ReactNode;
  selected?: readonly string[];
  onSelectedChange?: (ids: string[]) => void;
  rowLabel?: (row: T) => string;
  pageSizes?: readonly number[];
  footer?: boolean;
}

const DEFAULT_SIZES = [5, 10, 25] as const;

function SortHeader<T>({ column, list }: { column: Column<T>; list: ListState }) {
  const active = list.sort?.key === column.id ? list.sort.direction : null;
  const next = active === 'asc' ? 'desc' : 'asc';
  return (
    <button
      type="button"
      onClick={() => { list.setSort({ key: column.id, direction: next }); }}
      className="inline-flex items-center gap-1 rounded-sm hover:text-fg focus-visible:outline-2 focus-visible:outline-focus"
    >
      {column.header}
      <Icon icon={active === 'asc' ? ArrowUp : active === 'desc' ? ArrowDown : ArrowUpDown} size={14} />
    </button>
  );
}

export function DataTable<T>({
  label,
  rows,
  columns,
  getId,
  list,
  empty,
  selected,
  onSelectedChange,
  rowLabel,
  pageSizes = DEFAULT_SIZES,
  footer = true,
}: DataTableProps<T>) {
  const sortColumn = columns.find((column) => column.id === list.sort?.key);
  const sortBy = sortColumn?.sortBy;
  const ordered = list.sort && sortBy ? sortItems(rows, sortBy, list.sort.direction) : [...rows];
  const page = clampPage(list.page, ordered.length, list.pageSize);
  const visible = paginate(ordered, page, list.pageSize);
  const selectable = selected !== undefined && onSelectedChange !== undefined;
  const visibleIds = visible.map(getId);
  const allSelected = selectable && visibleIds.length > 0 && visibleIds.every((id) => selected.includes(id));

  if (rows.length === 0) return <>{empty}</>;

  const toggleAll = (checked: boolean) => {
    if (!selectable) return;
    onSelectedChange(checked ? [...new Set([...selected, ...visibleIds])] : selected.filter((id) => !visibleIds.includes(id)));
  };
  const toggleOne = (id: string, checked: boolean) => {
    if (!selectable) return;
    onSelectedChange(checked ? [...selected, id] : selected.filter((entry) => entry !== id));
  };

  return (
    <div className="flex flex-col gap-2">
      <Table aria-label={label}>
        <TableHead>
          <TableRow>
            {selectable ? (
              <TableHeaderCell className="w-8">
                <Checkbox label="Tout sélectionner sur la page" hideLabel checked={allSelected} onChange={(event) => { toggleAll(event.target.checked); }} />
              </TableHeaderCell>
            ) : null}
            {columns.map((column) => (
              <TableHeaderCell
                key={column.id}
                numeric={column.numeric}
                aria-sort={list.sort?.key === column.id ? (list.sort.direction === 'asc' ? 'ascending' : 'descending') : undefined}
              >
                {column.hideHeader ? (
                  <span className="sr-only">{column.header}</span>
                ) : column.sortBy ? (
                  <SortHeader column={column} list={list} />
                ) : (
                  column.header
                )}
              </TableHeaderCell>
            ))}
          </TableRow>
        </TableHead>
        <TableBody>
          {visible.map((row) => {
            const id = getId(row);
            const isSelected = selectable && selected.includes(id);
            return (
              <TableRow key={id} selected={isSelected}>
                {selectable ? (
                  <TableCell>
                    <Checkbox
                      label={rowLabel ? `Sélectionner ${rowLabel(row)}` : 'Sélectionner la ligne'}
                      hideLabel
                      checked={isSelected}
                      onChange={(event) => { toggleOne(id, event.target.checked); }}
                    />
                  </TableCell>
                ) : null}
                {columns.map((column) => (
                  <TableCell key={column.id} numeric={column.numeric} strong={column.strong}>
                    {column.cell(row)}
                  </TableCell>
                ))}
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
      {footer ? (
        <div className="flex flex-wrap items-end justify-between gap-3">
          <Select
            label="Lignes par page"
            placeholder="10"
            options={pageSizes.map((size) => ({ value: String(size), label: String(size) }))}
            value={String(list.pageSize)}
            onValueChange={(value) => { list.setPageSize(Number(value)); }}
            className="w-36"
          />
          <Pagination
            page={page}
            pageSize={list.pageSize}
            total={ordered.length}
            onPageChange={list.setPage}
            label={`Pagination, ${label}`}
            className="min-w-full flex-1 border-t-0 pt-0 sm:min-w-0"
          />
        </div>
      ) : null}
    </div>
  );
}
