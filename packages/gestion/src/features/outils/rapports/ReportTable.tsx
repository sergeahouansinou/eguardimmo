import { cx } from '@eguardimmo/ui';
import { DataTable, Td, Th } from '../kit';
import { formatReportCell } from './engine/format';
import type { ColumnKind, ReportCell, ReportColumn, ReportRow, ReportView } from './engine/types';

const isNumeric = (kind: ColumnKind): boolean => kind === 'money' || kind === 'cents' || kind === 'int' || kind === 'percent';

function Cells({ columns, row }: { columns: readonly ReportColumn[]; row: ReportRow }) {
  return (
    <>
      {columns.map((column, index) => {
        const cell: ReportCell = row.cells[index] ?? null;
        const text = formatReportCell(column.kind, cell);
        const attention = index === 0 && row.tone ? <span className="sr-only">{row.tone === 'danger' ? 'À traiter : ' : 'À surveiller : '}</span> : null;
        const content = (
          <>
            {attention}
            {text === '' ? '–' : text}
          </>
        );
        if (index === 0) {
          return (
            <th key={column.id} scope="row" className="h-9 border-b border-line px-2 text-left font-medium whitespace-nowrap">
              {content}
            </th>
          );
        }
        return (
          <Td key={column.id} numeric={isNumeric(column.kind)} className={cx(row.tone === 'danger' && isNumeric(column.kind) && 'text-fg-danger')}>
            {content}
          </Td>
        );
      })}
    </>
  );
}

export function ReportTable({ view }: { view: ReportView }) {
  const { columns } = view.definition;
  const named = view.groups.some((group) => group.label !== null);
  const hasTotals = view.totals.some((cell) => cell !== null);
  return (
    <section aria-label="Détail du rapport" className="rounded-lg border border-line bg-surface">
      <DataTable caption={`${view.definition.title.toLowerCase()}, détail`}>
        <thead>
          <tr>
            {columns.map((column) => (
              <Th key={column.id} numeric={isNumeric(column.kind)}>
                {column.label}
              </Th>
            ))}
          </tr>
        </thead>
        <tbody>
          {view.groups.map((group) => (
            <GroupRows key={group.key} columns={columns} group={group} named={named} />
          ))}
          {hasTotals ? (
            <tr className="bg-muted font-semibold">
              {columns.map((column, index) =>
                index === 0 ? (
                  <th key={column.id} scope="row" className="h-9 px-2 text-left whitespace-nowrap">
                    Total
                  </th>
                ) : (
                  <Td key={column.id} numeric={isNumeric(column.kind)} strong className="border-b-0">
                    {formatReportCell(column.kind, view.totals[index] ?? null)}
                  </Td>
                ),
              )}
            </tr>
          ) : null}
        </tbody>
      </DataTable>
    </section>
  );
}

function GroupRows({ columns, group, named }: { columns: readonly ReportColumn[]; group: ReportView['groups'][number]; named: boolean }) {
  return (
    <>
      {named && group.label ? (
        <tr className="bg-muted/60 font-semibold">
          <th scope="rowgroup" className="h-9 px-2 text-left whitespace-nowrap">
            {group.label}
          </th>
          {columns.slice(1).map((column, offset) => (
            <Td key={column.id} numeric={isNumeric(column.kind)} strong>
              {group.subtotals[offset + 1] === null || group.subtotals[offset + 1] === undefined ? '' : formatReportCell(column.kind, group.subtotals[offset + 1] ?? null)}
            </Td>
          ))}
        </tr>
      ) : null}
      {group.rows.map((row) => (
        <tr key={row.id}>
          <Cells columns={columns} row={row} />
        </tr>
      ))}
    </>
  );
}
