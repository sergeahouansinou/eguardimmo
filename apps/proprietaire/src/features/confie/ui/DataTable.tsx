import { cx } from "@eguardimmo/ui";
import type { ReactNode } from "react";

export interface Column<T> {
  id: string;
  header: string;
  cell: (row: T) => ReactNode;
  align?: "end";
  primary?: boolean;
  action?: boolean;
}

export type TableRow<T> =
  | { kind?: "data"; key: string; value: T }
  | { kind: "group"; key: string; label: string }
  | { kind: "total"; key: string; label: string; cells: Readonly<Record<string, ReactNode>> };

const cellBase = "px-2 py-2 align-middle";
const cellMobile =
  "max-sm:flex max-sm:items-center max-sm:justify-between max-sm:gap-3 max-sm:p-0 max-sm:text-right max-sm:before:text-left max-sm:before:text-caption max-sm:before:text-fg-subtle";

export interface DataTableProps<T> {
  caption: string;
  columns: readonly Column<T>[];
  rows: readonly TableRow<T>[];
}

export function DataTable<T>({ caption, columns, rows }: DataTableProps<T>) {
  return (
    <table className="w-full text-body max-sm:block">
      <caption className="sr-only">{caption}</caption>
      <thead className="max-sm:hidden">
        <tr>
          {columns.map((column) => (
            <th
              key={column.id}
              scope="col"
              className={cx("h-8 border-b border-line px-2 text-left text-caption font-medium text-fg-subtle", column.align === "end" && "text-right")}
            >
              {column.action ? <span className="sr-only">{column.header}</span> : column.header}
            </th>
          ))}
        </tr>
      </thead>
      <tbody className="max-sm:flex max-sm:flex-col max-sm:gap-2">
        {rows.map((row) => {
          if (row.kind === "group") {
            return (
              <tr key={row.key} className="max-sm:pt-1">
                <th scope="colgroup" colSpan={columns.length} className="bg-page px-2 py-1.5 text-left text-caption font-semibold text-fg-muted max-sm:bg-transparent max-sm:px-0">
                  {row.label}
                </th>
              </tr>
            );
          }
          if (row.kind === "total") {
            const rest = columns.slice(1);
            return (
              <tr key={row.key} className="bg-page font-semibold text-fg max-sm:flex max-sm:flex-col max-sm:gap-1 max-sm:rounded-md max-sm:p-3">
                <td className={cx(cellBase, "max-sm:p-0")}>{row.label}</td>
                {rest.map((column) => (
                  <td
                    key={column.id}
                    data-label={column.header}
                    className={cx(cellBase, column.align === "end" && "text-right tabular-nums", cellMobile, "max-sm:before:content-[attr(data-label)]")}
                  >
                    {row.cells[column.id] ?? null}
                  </td>
                ))}
              </tr>
            );
          }
          return (
            <tr
              key={row.key}
              className="border-b border-line last:border-b-0 max-sm:flex max-sm:flex-col max-sm:gap-1 max-sm:rounded-md max-sm:border max-sm:bg-surface max-sm:p-3 max-sm:last:border-b"
            >
              {columns.map((column) => {
                const labelled = column.primary !== true && column.action !== true;
                return (
                  <td
                    key={column.id}
                    data-label={labelled ? column.header : undefined}
                    className={cx(
                      cellBase,
                      column.align === "end" && "text-right tabular-nums",
                      column.primary === true && "font-semibold text-fg",
                      cellMobile,
                      labelled && "max-sm:before:content-[attr(data-label)]",
                      !labelled && "max-sm:justify-start max-sm:text-left",
                    )}
                  >
                    {column.cell(row.value)}
                  </td>
                );
              })}
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}
