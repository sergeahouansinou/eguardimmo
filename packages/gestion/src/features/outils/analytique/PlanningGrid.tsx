'use client';

import { useState } from 'react';
import { cx } from '@eguardimmo/ui';
import { ChartTip } from './charts';
import type { TipData } from './charts';
import { OCCUPANCY_LABELS } from './constants';
import type { OccupancyStatus } from './constants';
import type { PlanningRow } from './compute/occupation';
import { formatRoundedEuros } from './format';
import { monthColumnLabel, monthLongLowerLabel } from './months';

const STATUS_CLASS: Record<OccupancyStatus, string> = {
  O: 'bg-chart-collected',
  P: 'bg-warning-line',
  T: 'bg-nav',
  V: 'bg-[repeating-linear-gradient(135deg,var(--eg-chart-called)_0_2px,transparent_2px_5px)]',
};

export const STATUS_ORDER: readonly OccupancyStatus[] = ['O', 'P', 'V', 'T'];

export const statusSwatchClass = (status: OccupancyStatus): string => STATUS_CLASS[status];

const LABEL_COLUMNS = 'minmax(0,96px) minmax(0,132px)';
const TOTAL_COLUMN = '64px';
const ROW_PITCH = 30;
const HEAD_HEIGHT = 28;

interface Hovered {
  row: number;
  col: number;
}

function cellTip(row: PlanningRow, col: number): TipData {
  const cell = row.cells[col];
  const month = cell?.month ?? '';
  const title = `${row.lot.name}, ${monthLongLowerLabel(month)}`;
  if (!cell) return { title, rows: [] };
  if (cell.status === 'V') {
    return {
      title,
      rows: [
        { label: 'Vacant depuis', value: `${String(cell.vacantDays ?? 0)} jours`, tone: 'muted' },
        { label: 'Loyer visé', value: formatRoundedEuros(row.lot.monthlyRent) },
        { label: 'Candidats', value: String(row.lot.candidates) },
      ],
    };
  }
  return { title, rows: [{ label: OCCUPANCY_LABELS[cell.status], value: '' }] };
}

export function PlanningGrid({ rows, months }: { rows: readonly PlanningRow[]; months: readonly string[] }) {
  const [hovered, setHovered] = useState<Hovered | null>(null);
  const columns = `${LABEL_COLUMNS} repeat(${String(months.length)}, minmax(0,1fr)) ${TOTAL_COLUMN}`;
  const target = hovered ? rows[hovered.row] : undefined;
  const fraction = hovered ? (hovered.col + 0.5) / months.length : 0;
  const rightSide = hovered ? hovered.col >= months.length / 2 : false;

  return (
    <div className="overflow-x-auto">
      <div role="grid" aria-label="Planning d'occupation" className="relative flex min-w-[720px] flex-col">
        <div
          role="row"
          style={{ gridTemplateColumns: columns }}
          className="mb-1 grid h-6 items-center gap-0.5 border-b border-line text-center text-[11px] leading-4 font-semibold whitespace-nowrap text-fg-subtle"
        >
          <span role="columnheader" className="text-left">Lot</span>
          <span role="columnheader" className="text-left">Immeuble</span>
          {months.map((month) => (
            <span key={month} role="columnheader">
              {monthColumnLabel(month)}
            </span>
          ))}
          <span role="columnheader" className="text-right">Loués</span>
        </div>
        {rows.map((row, rowIndex) => {
          const short = row.rented < row.cells.length;
          return (
            <div key={row.lot.id} role="row" style={{ gridTemplateColumns: columns }} className="grid h-7 items-center gap-0.5 text-body text-fg">
              <b role="rowheader" className="truncate font-medium">
                {row.lot.name}
              </b>
              <span role="gridcell" className="truncate text-caption text-fg-subtle">
                {row.buildingName}
              </span>
              {row.cells.map((cell, col) => {
                const label = `${monthColumnLabel(cell.month)} : ${OCCUPANCY_LABELS[cell.status]}${cell.vacantDays === null ? '' : ` depuis ${String(cell.vacantDays)} jours`}`;
                const interactive = cell.status !== 'O';
                const active = hovered?.row === rowIndex && hovered.col === col;
                return (
                  <i
                    key={cell.month}
                    role="gridcell"
                    aria-label={`${row.lot.name}, ${label}`}
                    tabIndex={interactive ? 0 : undefined}
                    onPointerEnter={() => { setHovered({ row: rowIndex, col }); }}
                    onPointerLeave={() => { setHovered(null); }}
                    onFocus={() => { setHovered({ row: rowIndex, col }); }}
                    onBlur={() => { setHovered(null); }}
                    className={cx(
                      'block h-[18px] rounded-sm outline-offset-1 focus-visible:outline-2 focus-visible:outline-focus',
                      STATUS_CLASS[cell.status],
                      active && 'outline-2 outline-nav',
                    )}
                  />
                );
              })}
              <span role="gridcell" className={cx('text-right tabular-nums', short && 'font-semibold text-warning-fg')}>
                {`${String(row.rented)} / ${String(row.cells.length)}`}
              </span>
            </div>
          );
        })}
        {hovered && target ? (
          <ChartTip
            tip={cellTip(target, hovered.col)}
            left={`calc(228px + (100% - 292px) * ${String(fraction)}${rightSide ? ' - 184px' : ' + 4px'})`}
            top={HEAD_HEIGHT + (hovered.row + 1) * ROW_PITCH}
          />
        ) : null}
      </div>
    </div>
  );
}
