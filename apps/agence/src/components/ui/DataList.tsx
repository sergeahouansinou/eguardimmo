"use client";

import {
  EmptyState,
  Pagination,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeaderCell,
  TableRow,
} from "@eguardimmo/ui";
import { SearchX } from "lucide-react";
import { useState } from "react";
import type { ReactNode } from "react";

export interface DataColumn<T> {
  id: string;
  header: string;
  numeric?: boolean;
  strong?: boolean;
  cell: (row: T) => ReactNode;
}

export interface DataListProps<T> {
  label: string;
  rows: readonly T[];
  columns: readonly DataColumn<T>[];
  rowKey: (row: T) => string;
  pageSize?: number;
  emptyTitle?: string;
  emptyDescription?: string;
  resetKey?: string;
}

export function DataList<T>({
  label,
  rows,
  columns,
  rowKey,
  pageSize = 15,
  emptyTitle = "Aucun résultat",
  emptyDescription = "Modifiez la recherche ou les filtres.",
  resetKey = "",
}: DataListProps<T>) {
  const [pageState, setPageState] = useState({ key: resetKey, page: 1 });
  const page = pageState.key === resetKey ? pageState.page : 1;
  const visible = rows.slice((page - 1) * pageSize, page * pageSize);

  if (rows.length === 0) {
    return <EmptyState icon={SearchX} title={emptyTitle} description={emptyDescription} />;
  }
  return (
    <div className="flex min-w-0 flex-col gap-2">
      <Table aria-label={label}>
        <TableHead>
          <TableRow>
            {columns.map((column) => (
              <TableHeaderCell key={column.id} numeric={column.numeric ?? false}>
                {column.header}
              </TableHeaderCell>
            ))}
          </TableRow>
        </TableHead>
        <TableBody>
          {visible.map((row) => (
            <TableRow key={rowKey(row)}>
              {columns.map((column) => (
                <TableCell key={column.id} numeric={column.numeric ?? false} strong={column.strong ?? false}>
                  {column.cell(row)}
                </TableCell>
              ))}
            </TableRow>
          ))}
        </TableBody>
      </Table>
      <Pagination
        page={page}
        pageSize={pageSize}
        total={rows.length}
        label={`Pagination, ${label}`}
        onPageChange={(next) => { setPageState({ key: resetKey, page: next }); }}
      />
    </div>
  );
}
