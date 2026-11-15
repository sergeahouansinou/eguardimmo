'use client';

import { Alert, Button, Card, Icon, Select, StatCard } from '@eguardimmo/ui';
import { CreditCard, Landmark, PiggyBank } from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';
import { DataTable } from '@/components/DataTable';
import { PageHeader } from '@/components/PageHeader';
import { Pagination } from '@/components/Pagination';
import { Async2 } from '@/components/ScreenState';
import { StatusBadge } from '@/components/StatusBadge';
import { useHome, useInstallments } from '@/data/queries';
import type { Installment } from '@/data/schemas/loyers';
import { formatDate, formatMonthYear, yearOf } from '@/lib/dates';
import { formatMoney } from '@/lib/money';
import { installmentStatus } from '../shared/status';

const PAGE_SIZE = 6;
const STATE_OPTIONS = [
  { value: 'tous', label: 'Tous' },
  { value: 'paye', label: 'Payé' },
  { value: 'impaye', label: 'Impayé' },
  { value: 'en_attente', label: 'Paiement en attente' },
] as const;

const total = (item: Installment) => item.rentCents + item.provisionsCents;

export function LoyersScreen() {
  const installments = useInstallments();
  const home = useHome();
  return (
    <Async2 a={installments} b={home} errorTitle="Vos loyers n’ont pas pu être chargés">
      {(items, homeData) => <LoyersContent items={items} today={homeData.today} />}
    </Async2>
  );
}

function LoyersContent({ items, today }: { items: Installment[]; today: string }) {
  const currentYear = String(yearOf(today));
  const [year, setYear] = useState(currentYear);
  const [state, setState] = useState<string>('tous');
  const [page, setPage] = useState(1);

  const due = items.filter((item) => item.status !== 'a_venir');
  const unpaid = due.filter((item) => item.status === 'impaye');
  const amountDue = unpaid.reduce((sum, item) => sum + total(item), 0);
  const thisYear = due.filter((item) => item.dueOn.startsWith(currentYear));
  const paidThisYear = thisYear.filter((item) => item.status === 'paye');
  const next = items.find((item) => item.status === 'a_venir');
  const years = Array.from(new Set(due.map((item) => item.dueOn.slice(0, 4)))).sort().reverse();
  const rows = due
    .filter((item) => item.dueOn.startsWith(year) && (state === 'tous' || item.status === state))
    .sort((a, b) => b.dueOn.localeCompare(a.dueOn));
  const visible = rows.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  return (
    <>
      <PageHeader
        title="Loyers et quittances"
        subtitle="Vos échéances, vos paiements et les quittances émises à chaque loyer soldé."
        actions={
          <>
            <Button variant="secondary" asChild>
              <Link href="/loyers/prelevement">
                <Icon icon={Landmark} />
                Prélèvement SEPA
              </Link>
            </Button>
            <Button variant="secondary" asChild>
              <Link href="/loyers/regularisation">
                <Icon icon={PiggyBank} />
                Charges 2025
              </Link>
            </Button>
            {amountDue > 0 ? (
              <Button asChild>
                <Link href="/loyers/payer">
                  <Icon icon={CreditCard} />
                  Payer {formatMoney(amountDue)}
                </Link>
              </Button>
            ) : null}
          </>
        }
      />
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <StatCard label="Reste à payer" value={formatMoney(amountDue)} tone={amountDue > 0 ? 'danger' : 'default'}>
          <span className="text-caption text-fg-subtle">
            {unpaid[0] ? `Échéance du ${formatDate(unpaid[0].dueOn)}` : 'Aucun loyer en attente'}
          </span>
        </StatCard>
        <StatCard label={`Payé en ${currentYear}`} value={formatMoney(paidThisYear.reduce((sum, item) => sum + total(item), 0))}>
          <span className="text-caption text-fg-subtle">
            {paidThisYear.length} échéances sur {thisYear.length}
          </span>
        </StatCard>
        <StatCard label="Prochaine échéance" value={next ? formatDate(next.dueOn) : '—'}>
          <span className="text-caption text-fg-subtle">{next ? `${formatMoney(total(next))} charges comprises` : 'Aucune échéance à venir'}</span>
        </StatCard>
      </div>
      <Card role="region" aria-label="Liste des échéances" className="px-4 py-3">
        <div className="flex flex-wrap gap-3">
          <Select
            label="Année"
            placeholder="Année"
            className="w-40"
            value={year}
            options={years.map((value) => ({ value, label: value }))}
            onValueChange={(value) => { setYear(value); setPage(1); }}
          />
          <Select
            label="État"
            placeholder="État"
            className="w-56"
            value={state}
            options={STATE_OPTIONS}
            onValueChange={(value) => { setState(value); setPage(1); }}
          />
        </div>
        {rows.length === 0 ? (
          <Alert tone="info" title="Aucune échéance">
            Aucune échéance ne correspond à ces filtres.
          </Alert>
        ) : (
          <>
            <DataTable
              label="Échéances de loyer"
              rows={visible}
              rowKey={(item) => item.id}
              columns={[
                {
                  id: 'echeance',
                  header: 'Échéance',
                  primary: true,
                  cell: (item) => (
                    <>
                      {formatMonthYear(item.id)}
                      <br />
                      <span className="text-caption font-normal text-fg-subtle">Échéance du {formatDate(item.dueOn)}</span>
                    </>
                  ),
                },
                { id: 'montant', header: 'Montant', numeric: true, cell: (item) => formatMoney(total(item)) },
                { id: 'paye', header: 'Payé le', cell: (item) => (item.paidOn ? formatDate(item.paidOn) : '—') },
                {
                  id: 'etat',
                  header: 'État',
                  cell: (item) => {
                    const view = installmentStatus(item.status);
                    return <StatusBadge tone={view.tone}>{view.label}</StatusBadge>;
                  },
                },
                {
                  id: 'actions',
                  header: 'Actions',
                  numeric: true,
                  mobileLabel: '',
                  cell: (item) =>
                    item.status === 'impaye' ? (
                      <Button size="sm" asChild>
                        <Link href={`/loyers/payer?echeance=${item.id}`} aria-label={`Payer ${formatMonthYear(item.id)}`}>
                          Payer
                        </Link>
                      </Button>
                    ) : item.status === 'paye' && item.receiptId ? (
                      <Button size="sm" variant="ghost" asChild>
                        <Link href={`/loyers/quittances/${item.receiptId}`} aria-label={`Quittance ${formatMonthYear(item.id)}`}>
                          Quittance
                        </Link>
                      </Button>
                    ) : null,
                },
              ]}
            />
            <Pagination page={page} pageSize={PAGE_SIZE} total={rows.length} onPageChange={setPage} />
          </>
        )}
      </Card>
    </>
  );
}
