'use client';

import { Button, Card, CardHeader, CardTitle, Icon, StatCard } from '@eguardimmo/ui';
import { Download } from 'lucide-react';
import { DataTable } from '@/components/DataTable';
import { PageHeader } from '@/components/PageHeader';
import { Async } from '@/components/ScreenState';
import { KeyValueList, TotalsList } from '@/components/Section';
import { StatusBadge } from '@/components/StatusBadge';
import { useCharges } from '@/data/queries';
import type { ChargesStatement } from '@/data/schemas/loyers';
import { formatDate } from '@/lib/dates';
import { downloadDemoPdf } from '@eguardimmo/shell';
import { formatAmount, formatMoney } from '@/lib/money';

const STATUS: Record<ChargesStatement['status'], { label: string; tone: 'success' | 'warning' | 'info' }> = {
  remboursee: { label: 'Remboursée', tone: 'success' },
  a_regler: { label: 'À régler', tone: 'warning' },
  compensee: { label: 'Compensée', tone: 'info' },
};

interface Row {
  id: string;
  label: string;
  split: string;
  amountCents: number;
  total: boolean;
}

export function ChargesScreen() {
  const charges = useCharges();
  return (
    <Async query={charges} errorTitle="Le décompte de charges n’a pas pu être chargé">
      {(data) => <ChargesContent data={data} />}
    </Async>
  );
}

function ChargesContent({ data }: { data: ChargesStatement }) {
  const status = STATUS[data.status];
  const rows: Row[] = [
    ...data.lines.map((line, index) => ({ id: String(index), label: line.label, split: line.split, amountCents: line.amountCents, total: false })),
    { id: 'total', label: `Charges réelles ${String(data.year)}`, split: '', amountCents: data.actualCents, total: true },
  ];
  return (
    <>
      <PageHeader
        title={`Régularisation des charges ${String(data.year)}`}
        crumbs={[{ label: 'Loyers et quittances', href: '/loyers' }, { label: 'Régularisation des charges' }]}
        badge={<StatusBadge tone={status.tone}>{status.label}</StatusBadge>}
        subtitle={`Provisions de ${formatMoney(data.monthlyProvisionCents)} par mois comparées aux charges réelles de l'immeuble.`}
        actions={
          <Button
            onClick={() => {
              downloadDemoPdf(`decompte-charges-${String(data.year)}.pdf`, `Décompte de charges ${String(data.year)}`, [
                `Provisions versees : ${formatAmount(data.provisionsPaidCents)} EUR`,
                `Charges reelles : ${formatAmount(data.actualCents)} EUR`,
                `Solde : ${formatAmount(data.balanceCents)} EUR`,
              ]);
            }}
          >
            <Icon icon={Download} />
            Télécharger le décompte
          </Button>
        }
      />
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Provisions versées" value={formatMoney(data.provisionsPaidCents)}>
          <span className="text-caption text-fg-subtle">12 mois × {formatMoney(data.monthlyProvisionCents)}</span>
        </StatCard>
        <StatCard label="Charges réelles" value={formatMoney(data.actualCents)}>
          <span className="text-caption text-fg-subtle">Exercice {data.year}</span>
        </StatCard>
        <StatCard label="Solde en votre faveur" value={formatMoney(data.balanceCents)}>
          <span className="text-caption text-fg-subtle">{data.settledOn ? `Remboursé le ${formatDate(data.settledOn)}` : 'À rembourser'}</span>
        </StatCard>
        <StatCard label="Provision actuelle" value={`${formatMoney(data.currentProvisionCents)} par mois`}>
          <span className="text-caption text-fg-subtle">{data.provisionNote}</span>
        </StatCard>
      </div>
      <div className="grid grid-cols-1 items-start gap-3 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <Card role="region" aria-labelledby="rc-detail" className="px-4 py-3">
          <CardHeader>
            <CardTitle as="h2" id="rc-detail">Charges réelles de {data.year}</CardTitle>
          </CardHeader>
          <DataTable
            label={`Charges réelles de ${String(data.year)}`}
            rows={rows}
            rowKey={(row) => row.id}
            rowClassName={(row) => (row.total ? 'bg-page font-semibold' : undefined)}
            columns={[
              { id: 'poste', header: 'Poste', primary: true, cell: (row) => row.label },
              { id: 'repartition', header: 'Répartition', cell: (row) => row.split },
              { id: 'montant', header: 'Montant', numeric: true, cell: (row) => `${formatAmount(row.amountCents)} €` },
            ]}
          />
        </Card>
        <div className="flex min-w-0 flex-col gap-3">
          <Card role="region" aria-labelledby="rc-calcul" className="px-4 py-3">
            <CardHeader>
              <CardTitle as="h2" id="rc-calcul">Calcul du solde</CardTitle>
            </CardHeader>
            <TotalsList
              items={[
                { label: 'Provisions versées', value: `${formatAmount(data.provisionsPaidCents)} €` },
                { label: 'Charges réelles', value: `− ${formatAmount(data.actualCents)} €` },
                { label: 'Solde remboursé', value: `${formatAmount(data.balanceCents)} €`, strong: true },
              ]}
            />
          </Card>
          {data.settledOn ? (
            <Card role="region" aria-labelledby="rc-remb" className="px-4 py-3">
              <CardHeader>
                <CardTitle as="h2" id="rc-remb">Remboursement</CardTitle>
              </CardHeader>
              <KeyValueList
                labelWidth="5rem"
                items={[
                  { label: 'Date', value: formatDate(data.settledOn) },
                  { label: 'Moyen', value: data.settlementLabel ?? '—' },
                  { label: 'Montant', value: `${formatAmount(data.balanceCents)} €` },
                ]}
              />
            </Card>
          ) : null}
        </div>
      </div>
    </>
  );
}
