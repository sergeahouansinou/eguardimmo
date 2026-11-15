import type { ReactNode } from 'react';
import { cx } from '@eguardimmo/ui';
import { formatReportCell } from './engine/format';
import { DEMO_AGENCY } from './demo';
import { PAPER_HEIGHT, PAPER_WIDTH } from './ReportPaper';
import type { ColumnKind, ReportCell, ReportColumn, ReportView } from './engine/types';

export interface GenericPaperOptions {
  letterhead: boolean;
  hideZero: boolean;
}

export type PaperLine =
  | { kind: 'group'; key: string; cells: readonly ReportCell[]; label: string }
  | { kind: 'row'; key: string; cells: readonly ReportCell[]; tone: 'danger' | 'warning' | undefined }
  | { kind: 'total'; key: string; cells: readonly ReportCell[] };

const FIRST_PAGE_UNITS = 20;
const NEXT_PAGE_UNITS = 30;
const LONG_TEXT = 24;

const sheet = 'flex flex-col gap-3 border border-black/25 bg-white p-9 text-[11px] leading-4 text-black';
const small = 'text-[10px] leading-[14px] text-black/60';
const isNumeric = (kind: ColumnKind): boolean => kind === 'money' || kind === 'cents' || kind === 'int' || kind === 'percent';

export function paperLines(view: ReportView): PaperLine[] {
  const named = view.groups.some((group) => group.label !== null);
  const lines: PaperLine[] = [];
  for (const group of view.groups) {
    if (named && group.label) lines.push({ kind: 'group', key: `g-${group.key}`, cells: group.subtotals, label: group.label });
    for (const row of group.rows) lines.push({ kind: 'row', key: row.id, cells: row.cells, tone: row.tone });
  }
  if (view.totals.some((cell) => cell !== null)) lines.push({ kind: 'total', key: 'total', cells: view.totals });
  return lines;
}

const unitsOf = (line: PaperLine): number => (line.cells.some((cell) => typeof cell === 'string' && cell.length > LONG_TEXT) ? 2 : 1);

export function paginate(lines: readonly PaperLine[]): PaperLine[][] {
  const pages: PaperLine[][] = [[]];
  let used = 0;
  let capacity = FIRST_PAGE_UNITS;
  for (const line of lines) {
    const cost = unitsOf(line);
    if (used + cost > capacity && (pages.at(-1)?.length ?? 0) > 0) {
      pages.push([]);
      used = 0;
      capacity = NEXT_PAGE_UNITS;
    }
    pages.at(-1)?.push(line);
    used += cost;
  }
  return pages;
}

function Frame({ number, pages, visible, generated, children }: { number: number; pages: number; visible: boolean; generated: string; children: ReactNode }) {
  return (
    <article data-print-page="" data-paper="" aria-label={`Page ${String(number)} sur ${String(pages)}`} style={{ width: PAPER_WIDTH, height: PAPER_HEIGHT }} className={cx(sheet, 'shrink-0', !visible && 'hidden')}>
      {children}
      <div className="mt-auto flex justify-between border-t border-black/15 pt-2 text-[9px] leading-3 text-black/60">
        <span>{`eGuardImmo, rapport généré le ${generated}`}</span>
        <span>{`Page ${String(number)} sur ${String(pages)}`}</span>
      </div>
    </article>
  );
}

function Letterhead({ title, period, scope, show }: { title: string; period: string; scope: string; show: boolean }) {
  return (
    <div className="flex items-start justify-between gap-4">
      <div className={cx('flex flex-col gap-0.5', !show && 'invisible')}>
        <span className="flex items-center gap-2 text-xs leading-4 font-bold">
          <span className="inline-flex size-6 items-center justify-center rounded-md bg-black text-[10px] leading-3 font-bold text-white">{DEMO_AGENCY.initials}</span>
          {DEMO_AGENCY.name}
        </span>
        <span className={small}>{DEMO_AGENCY.address}</span>
        <span className={small}>{DEMO_AGENCY.email}</span>
      </div>
      <div className="flex flex-col gap-0.5 text-right">
        <span className="text-[15px] leading-5 font-bold tracking-wide">{title}</span>
        <span className={small}>{period}</span>
        <span className={small}>{scope}</span>
      </div>
    </div>
  );
}

function PaperTable({ columns, lines, dense }: { columns: readonly ReportColumn[]; lines: readonly PaperLine[]; dense: boolean }) {
  const head = cx('border-b border-black py-1 pr-2 text-left font-semibold text-black/60 last:pr-0', dense ? 'text-[8px] leading-3' : 'text-[10px] leading-[14px]');
  const cell = cx('border-b border-black/15 py-[3px] pr-2 align-top last:pr-0', dense ? 'text-[8px] leading-3' : 'text-[10px] leading-[14px]');
  return (
    <table className="w-full border-collapse" aria-label="Détail du rapport">
      <thead>
        <tr>
          {columns.map((column) => (
            <th key={column.id} scope="col" className={cx(head, isNumeric(column.kind) && 'text-right')}>
              {column.label}
            </th>
          ))}
        </tr>
      </thead>
      <tbody className="tabular-nums">
        {lines.map((line) => (
          <tr key={line.key} className={cx(line.kind !== 'row' && 'bg-black/5 font-bold', line.kind === 'row' && line.tone === 'danger' && 'font-semibold')}>
            {columns.map((column, index) => {
              const value = line.cells[index] ?? null;
              const text = line.kind === 'group' && index === 0 ? line.label : line.kind === 'total' && index === 0 ? 'Total' : formatReportCell(column.kind, value);
              return (
                <td key={column.id} className={cx(cell, isNumeric(column.kind) && 'text-right whitespace-nowrap')}>
                  {text}
                </td>
              );
            })}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

export interface GenericPaperProps {
  view: ReportView;
  scope: string;
  generated: string;
  options: GenericPaperOptions;
  current: number;
}

export function GenericPaper({ view, scope, generated, options, current }: GenericPaperProps) {
  const { definition } = view;
  const pages = paginate(paperLines(view));
  const dense = definition.columns.length > 6;
  const period = definition.periods ? `Du ${view.period.start} au ${view.period.end}` : view.period.title.charAt(0).toUpperCase() + view.period.title.slice(1);
  return (
    <>
      {pages.map((lines, index) => (
        <Frame key={lines[0]?.key ?? String(index)} number={index + 1} pages={pages.length} visible={current === index + 1} generated={generated}>
          {index === 0 ? (
            <>
              <Letterhead title={definition.title} period={period} scope={scope} show={options.letterhead} />
              <div className="flex gap-3">
                {view.kpis.slice(0, 4).map((kpi) => (
                  <div key={kpi.label} className="flex min-w-0 flex-1 flex-col rounded-sm border border-black/15 px-2 py-1.5">
                    <span className={small}>{kpi.label}</span>
                    <span className="font-semibold">{kpi.value}</span>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <div className="flex items-baseline justify-between gap-2 border-b border-black/15 pb-1">
              <span className="font-bold tracking-wide">{definition.title}</span>
              <span className={small}>{`${period}, suite`}</span>
            </div>
          )}
          <PaperTable columns={definition.columns} lines={lines} dense={dense} />
          {index === pages.length - 1 && definition.note ? <p className={small}>{definition.note}</p> : null}
        </Frame>
      ))}
    </>
  );
}

export const pageCountOf = (view: ReportView): number => paginate(paperLines(view)).length;
