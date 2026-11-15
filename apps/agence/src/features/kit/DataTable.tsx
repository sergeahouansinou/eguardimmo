import { Checkbox, Table, TableBody, TableCell, TableHead, TableHeaderCell, TableRow, cx } from "@eguardimmo/ui";
import type { ReactNode } from "react";

export interface Column<T> {
  id: string;
  header: string;
  cell: (row: T) => ReactNode;
  numeric?: boolean;
  role?: "title" | "status" | "action";
  hideHeader?: boolean;
}

export interface TableSelection<T> {
  selected: ReadonlySet<string>;
  onToggle: (id: string) => void;
  onToggleAll: (selectAll: boolean) => void;
  rowLabel: (row: T) => string;
}

export interface DataTableProps<T> {
  caption: string;
  columns: readonly Column<T>[];
  rows: readonly T[];
  getRowId: (row: T) => string;
  footer?: Readonly<Record<string, ReactNode>>;
  footerLabel?: string;
  selection?: TableSelection<T>;
  empty?: ReactNode;
}

const rowClass =
  "max-sm:grid max-sm:grid-cols-[minmax(0,1fr)_auto] max-sm:gap-x-3 max-sm:gap-y-0.5 max-sm:rounded-md max-sm:border max-sm:border-line max-sm:bg-surface max-sm:p-3 max-sm:last:border-b";

const cellBase =
  "h-10 whitespace-normal py-1.5 align-middle max-sm:col-span-full max-sm:flex max-sm:h-auto max-sm:items-center max-sm:gap-2 max-sm:p-0 max-sm:text-left";

function cellRole(column: { role?: string }): string {
  if (column.role === "title") return "max-sm:col-span-1 max-sm:row-start-1 max-sm:block";
  if (column.role === "status") return "max-sm:col-span-1 max-sm:col-start-2 max-sm:row-start-1 max-sm:self-start";
  if (column.role === "action") return "max-sm:mt-2";
  return "max-sm:before:w-28 max-sm:before:shrink-0 max-sm:before:text-caption max-sm:before:font-medium max-sm:before:text-fg-subtle max-sm:before:content-[attr(data-label)]";
}

export function DataTable<T>({ caption, columns, rows, getRowId, footer, footerLabel = "Total", selection, empty }: DataTableProps<T>) {
  if (rows.length === 0 && empty) return <>{empty}</>;
  const allSelected = selection !== undefined && rows.length > 0 && rows.every((row) => selection.selected.has(getRowId(row)));
  const titleIndex = Math.max(
    0,
    columns.findIndex((column) => column.role === "title"),
  );
  return (
    <Table aria-label={caption} className="max-sm:block">
      <TableHead className="max-sm:hidden">
        <TableRow>
          {selection ? (
            <TableHeaderCell className="w-8">
              <Checkbox
                label="Tout sélectionner"
                hideLabel
                checked={allSelected}
                onChange={(event) => {
                  selection.onToggleAll(event.target.checked);
                }}
              />
            </TableHeaderCell>
          ) : null}
          {columns.map((column) => (
            <TableHeaderCell key={column.id} numeric={column.numeric ?? false}>
              {column.hideHeader ? <span className="sr-only">{column.header}</span> : column.header}
            </TableHeaderCell>
          ))}
        </TableRow>
      </TableHead>
      <TableBody className="max-sm:flex max-sm:flex-col max-sm:gap-2">
        {rows.map((row) => {
          const id = getRowId(row);
          return (
            <TableRow key={id} selected={selection?.selected.has(id) ?? false} className={rowClass}>
              {selection ? (
                <TableCell className="w-8 max-sm:order-last max-sm:col-span-full max-sm:p-0">
                  <Checkbox
                    label={selection.rowLabel(row)}
                    hideLabel
                    checked={selection.selected.has(id)}
                    onChange={() => {
                      selection.onToggle(id);
                    }}
                  />
                </TableCell>
              ) : null}
              {columns.map((column, index) =>
                index === titleIndex ? (
                  <th key={column.id} scope="row" className={cx(cellBase, cellRole(column), "px-2 text-left text-body font-medium text-fg")}>
                    {column.cell(row)}
                  </th>
                ) : (
                  <TableCell
                    key={column.id}
                    numeric={column.numeric ?? false}
                    data-label={column.role ? undefined : column.header}
                    className={cx(cellBase, cellRole(column))}
                  >
                    {column.cell(row)}
                  </TableCell>
                ),
              )}
            </TableRow>
          );
        })}
      </TableBody>
      {footer ? (
        <tfoot className="max-sm:block">
          <TableRow className={cx(rowClass, "bg-muted max-sm:mt-2")}>
            {selection ? <TableCell className="max-sm:hidden" /> : null}
            {columns.map((column, index) => (
              <TableCell
                key={column.id}
                numeric={column.numeric ?? false}
                data-label={index === titleIndex ? undefined : column.header}
                strong
                className={cx(cellBase, cellRole(column), "border-t border-fg", footer[column.id] === undefined && index !== titleIndex && "max-sm:hidden")}
              >
                {index === titleIndex ? footerLabel : footer[column.id]}
              </TableCell>
            ))}
          </TableRow>
        </tfoot>
      ) : null}
    </Table>
  );
}
