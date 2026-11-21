import { Card, CardHeader, CardTitle, StatCard } from '@eguardimmo/ui';
import type { ReactNode } from 'react';
import { DataTable } from '@/components/DataTable';
import type { Column } from '@/components/DataTable';
import { PageHeader } from '@/components/PageHeader';
import { KeyValueList, TotalsList } from '@/components/Section';
import { StatusBadge } from '@/components/StatusBadge';
import type { ChargesLineView, ChargesView } from './chargesView';

interface Row extends ChargesLineView {
  total: boolean;
}

const Amount = ({ children }: { children: string | null }) => (children === null ? null : <span className="whitespace-nowrap">{children}</span>);

function columnsOf(view: ChargesView): Column<Row>[] {
  const detailed = view.lines.some((line) => line.base !== null);
  return [
    { id: 'poste', header: 'Poste', primary: true, cell: (row) => row.label },
    { id: 'repartition', header: 'Répartition', cell: (row) => row.split },
    ...(detailed
      ? [
          { id: 'base', header: 'Base du poste', numeric: true, cell: (row: Row) => <Amount>{row.base}</Amount> },
          { id: 'jours', header: 'Jours', numeric: true, cell: (row: Row) => (row.days === null ? '' : String(row.days)) },
        ]
      : []),
    { id: 'montant', header: view.amountHeader, numeric: true, cell: (row) => <Amount>{row.amount}</Amount> },
  ];
}

export function ChargesDocument({ view, actions, notice, aside }: { view: ChargesView; actions?: ReactNode; notice?: ReactNode; aside?: ReactNode }) {
  const rows: Row[] = [
    ...view.lines.map((line) => ({ ...line, total: false })),
    { id: 'total', label: view.totalLabel, split: '', base: null, days: null, amount: view.total, total: true },
  ];
  return (
    <>
      <PageHeader
        title={view.title}
        crumbs={view.crumbs}
        badge={<StatusBadge tone={view.badge.tone}>{view.badge.label}</StatusBadge>}
        subtitle={view.subtitle}
        actions={actions}
      />
      {notice}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {view.stats.map((stat) => (
          <StatCard key={stat.label} label={stat.label} value={stat.value}>
            <span className="text-caption text-fg-subtle">{stat.note}</span>
          </StatCard>
        ))}
      </div>
      <div className="grid grid-cols-1 items-start gap-3 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <Card role="region" aria-labelledby="rc-detail" className="px-4 py-3">
          <CardHeader>
            <CardTitle as="h2" id="rc-detail">{view.tableTitle}</CardTitle>
          </CardHeader>
          <DataTable
            label={view.tableTitle}
            rows={rows}
            rowKey={(row) => row.id}
            rowClassName={(row) => (row.total ? 'bg-page font-semibold' : undefined)}
            columns={columnsOf(view)}
          />
        </Card>
        <div className="flex min-w-0 flex-col gap-3">
          <Card role="region" aria-labelledby="rc-calcul" className="px-4 py-3">
            <CardHeader>
              <CardTitle as="h2" id="rc-calcul">Calcul du solde</CardTitle>
            </CardHeader>
            <TotalsList items={view.calculation} />
          </Card>
          {view.extra ? (
            <Card role="region" aria-labelledby="rc-extra" className="px-4 py-3">
              <CardHeader>
                <CardTitle as="h2" id="rc-extra">{view.extra.title}</CardTitle>
              </CardHeader>
              <KeyValueList labelWidth="5rem" items={view.extra.items} />
            </Card>
          ) : null}
          {aside}
        </div>
      </div>
    </>
  );
}
