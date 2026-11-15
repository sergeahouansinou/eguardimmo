import type { ReactNode } from 'react';
import { cx } from '@eguardimmo/ui';
import { formatDecimal, formatPercentValue, formatRoundedEuros, formatWholeEuros } from '../analytique/format';
import { monthAxisLabel } from '../analytique/months';
import { DEMO_AGENCY } from './demo';
import type { LoyersView } from './loyers';

export const PAPER_WIDTH = 540;
export const PAPER_HEIGHT = 764;

export interface PaperOptions {
  annex: boolean;
  letterhead: boolean;
  hideZero: boolean;
}

interface PaperProps {
  view: LoyersView;
  scope: string;
  generated: string;
  options: PaperOptions;
  pages: number;
  current: number;
}

const withCents = (minor: number): string => `${formatDecimal(minor / 100, 2)}\u00a0€`;

const sheet = 'flex flex-col gap-3 border border-black/25 bg-white p-9 text-[11px] leading-4 text-black';
const small = 'text-[10px] leading-[14px] text-black/60';
const head = 'border-b border-black py-1 text-left text-[10px] leading-[14px] font-semibold text-black/60';
const cell = 'border-b border-black/15 py-[5px] whitespace-nowrap';

function Frame({ number, pages, visible, generated, children }: { number: number; pages: number; visible: boolean; generated: string; children: ReactNode }) {
  return (
    <article
      data-print-page=""
      data-paper=""
      aria-label={`Page ${String(number)} sur ${String(pages)}`}
      style={{ width: PAPER_WIDTH, height: PAPER_HEIGHT }}
      className={cx(sheet, 'shrink-0', !visible && 'hidden')}
    >
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

function FirstPage({ view, scope, generated, options, pages, current }: PaperProps) {
  const { totals, period } = view;
  const groups = view.groups
    .map((group) => ({ ...group, rows: options.hideZero ? group.rows.filter((row) => row.due !== 0) : group.rows }))
    .filter((group) => group.rows.length > 0);
  const named = view.groups.some((group) => group.label !== null);
  const overpaid = view.rows.filter((row) => row.due < 0);
  return (
    <Frame number={1} pages={pages} visible={current === 1} generated={generated}>
      <Letterhead title="LOYERS ENCAISSÉS" period={`Du ${period.start} au ${period.end}`} scope={scope} show={options.letterhead} />
      <div className="flex gap-4">
        {[
          ['Appelé', withCents(totals.called)],
          ['Encaissé', withCents(totals.collected)],
          ['Taux', formatPercentValue(totals.rate)],
        ].map(([label, value]) => (
          <div key={label} className="flex flex-1 flex-col rounded-sm border border-black/15 px-2.5 py-2">
            <span className={small}>{label}</span>
            <span className="font-semibold">{value}</span>
          </div>
        ))}
      </div>
      <table className="w-full border-collapse" aria-label="Loyers par bien">
        <thead>
          <tr>
            <th className={head}>Bien</th>
            <th className={head}>Locataire</th>
            <th className={cx(head, 'text-right')}>Appelé</th>
            <th className={cx(head, 'text-right')}>Encaissé</th>
            <th className={cx(head, 'text-right')}>Reste dû</th>
          </tr>
        </thead>
        <tbody className="tabular-nums">
          {groups.map((group) => (
            <GroupBody key={group.key} group={group} named={named} />
          ))}
          <tr className="font-bold">
            <td colSpan={2} className="border-t border-black py-[5px]">Total</td>
            <td className="border-t border-black py-[5px] text-right">{formatRoundedEuros(totals.called)}</td>
            <td className="border-t border-black py-[5px] text-right">{formatRoundedEuros(totals.collected)}</td>
            <td className="border-t border-black py-[5px] text-right">{formatRoundedEuros(totals.dueNet)}</td>
          </tr>
        </tbody>
      </table>
      {overpaid.length > 0 ? (
        <p className={small}>
          {`Reste dû net du trop perçu de ${overpaid.map((row) => `${row.lot.tenantName} (${formatRoundedEuros(-row.due)})`).join(', ')}.`}
          {options.annex ? ' Détail mensuel par locataire en page 2.' : ''}
        </p>
      ) : null}
    </Frame>
  );
}

function GroupBody({ group, named }: { group: LoyersView['groups'][number]; named: boolean }) {
  return (
    <>
      {named && group.label ? (
        <tr className="bg-black/5 text-[10px] font-semibold">
          <td colSpan={2} className={cell}>{group.label}</td>
          <td className={cx(cell, 'text-right')}>{formatRoundedEuros(group.called)}</td>
          <td className={cx(cell, 'text-right')}>{formatRoundedEuros(group.collected)}</td>
          <td className={cx(cell, 'text-right')}>{formatRoundedEuros(group.due)}</td>
        </tr>
      ) : null}
      {group.rows.map((row) => (
        <tr key={row.lot.id}>
          <td className={cell}>{row.lot.name}</td>
          <td className={cell}>{row.lot.tenantName}</td>
          <td className={cx(cell, 'text-right')}>{formatRoundedEuros(row.called)}</td>
          <td className={cx(cell, 'text-right')}>{formatRoundedEuros(row.collected)}</td>
          <td className={cx(cell, 'text-right')}>{formatRoundedEuros(row.due)}</td>
        </tr>
      ))}
    </>
  );
}

function Annex({ view, scope, generated, options, pages, current }: PaperProps) {
  const months = [...new Set(view.rows.flatMap((row) => row.lines.map((line) => line.month)))].sort();
  const rows = options.hideZero ? view.rows.filter((row) => row.due !== 0) : view.rows;
  return (
    <Frame number={2} pages={pages} visible={current === 2} generated={generated}>
      <Letterhead title="DÉTAIL MENSUEL" period={`Du ${view.period.start} au ${view.period.end}`} scope={scope} show={options.letterhead} />
      <p className={small}>Montants encaissés par mois, en euros. Les mois en gras sont inférieurs au loyer appelé.</p>
      <table className="w-full table-fixed border-collapse text-[9px] leading-3" aria-label="Encaissements mensuels">
        <thead>
          <tr>
            <th className={cx(head, 'w-[92px]')}>Locataire</th>
            {months.map((month) => (
              <th key={month} className={cx(head, 'text-right')}>{monthAxisLabel(month)}</th>
            ))}
          </tr>
        </thead>
        <tbody className="tabular-nums">
          {rows.map((row) => (
            <tr key={row.lot.id}>
              <td className={cx(cell, 'truncate')}>{row.lot.tenantName}</td>
              {months.map((month) => {
                const line = row.lines.find((item) => item.month === month);
                return (
                  <td key={month} className={cx(cell, 'text-right', line && line.collected < line.called && 'font-bold')}>
                    {line ? formatWholeEuros(line.collected) : '–'}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </Frame>
  );
}

export function ReportPaper(props: PaperProps) {
  return (
    <>
      <FirstPage {...props} />
      {props.options.annex ? <Annex {...props} /> : null}
    </>
  );
}
