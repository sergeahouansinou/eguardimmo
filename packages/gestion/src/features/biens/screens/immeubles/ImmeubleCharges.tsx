'use client';

import { Button, StatCard } from '@eguardimmo/ui';
import { useState } from 'react';
import { DataTable } from '../../components/DataTable';
import { CategoryImportDialog } from '../../components/CategoryImportDialog';
import { EntryList, Panel, StatGrid } from '../../components/Panels';
import { QueryBoundary, SkeletonRows } from '../../components/QueryState';
import { useBiensEnvironment } from '../../environment';
import { useListState } from '../../hooks/useListState';
import { formatNumber } from '../../lib/amount';
import { biensPaths, externalPaths } from '../../paths';
import { useImmeubleCharges } from '../../queries';
import type { ChargesData } from '../../schemas/immeubles';
import { formatMoney } from '../../../../format/money';

type Currency = ChargesData['currency'];

const recoverable = (line: ChargesData['lines'][number]): number => Math.round((line.share * line.recoverablePercent) / 100);
const percent = (value: number): string => `${formatNumber(Math.round(value * 10) / 10)} %`;

function Totals({ data, currency }: { data: ChargesData; currency: Currency }) {
  const budget = data.lines.reduce((sum, line) => sum + line.share, 0);
  const back = data.lines.reduce((sum, line) => sum + recoverable(line), 0);
  const fund = Math.round((budget * data.fundPercent) / 100);
  return (
    <StatGrid>
      <StatCard label={`Budget ${String(data.year)}, votre part`} value={formatMoney(budget, currency)}>
        <span className="text-caption text-fg-subtle">{`${formatNumber(data.sharePerMille)} / 1 000 des charges générales`}</span>
      </StatCard>
      <StatCard label="Récupérable sur vos locataires" value={formatMoney(back, currency)}>
        <span className="text-caption text-fg-subtle">{budget === 0 ? '—' : `${percent((back / budget) * 100)} du budget`}</span>
      </StatCard>
      <StatCard label="Non récupérable" value={formatMoney(budget - back, currency)}>
        <span className="text-caption text-fg-subtle">Syndic, assurance, part du gardien</span>
      </StatCard>
      <StatCard label="Fonds de travaux" value={formatMoney(fund, currency)}>
        <span className="text-caption text-fg-subtle">{`${formatNumber(data.fundPercent)} % du budget, loi ALUR`}</span>
      </StatCard>
    </StatGrid>
  );
}

export function ImmeubleCharges({ id }: { id: string }) {
  const { Link } = useBiensEnvironment();
  const query = useImmeubleCharges(id);
  const [importing, setImporting] = useState(false);
  const lines = useListState({ key: 'label', direction: 'asc' });
  const split = useListState({ key: 'lot', direction: 'asc' });
  return (
    <QueryBoundary query={query} errorTitle="Les charges n’ont pas pu être chargées" skeleton={<SkeletonRows rows={6} label="Chargement des charges" />}>
      {(data) => {
        const currency = data.currency;
        const budget = data.lines.reduce((sum, line) => sum + line.share, 0);
        const back = data.lines.reduce((sum, line) => sum + recoverable(line), 0);
        return (
          <>
            <Totals data={data} currency={currency} />
            <Panel
              title={`Postes du budget ${String(data.year)}`}
              action={
                <Button variant="secondary" size="sm" onClick={() => { setImporting(true); }}>
                  Importer l’appel de fonds
                </Button>
              }
            >
              <DataTable
                label="Postes du budget"
                rows={data.lines}
                getId={(row) => row.id}
                list={lines}
                footer={data.lines.length > lines.pageSize}
                empty={<p className="text-body text-fg-muted">Aucun poste de budget pour cet immeuble. Importez l’appel de fonds du syndic pour le renseigner.</p>}
                columns={[
                  { id: 'label', header: 'Poste', strong: true, sortBy: (row) => row.label, cell: (row) => row.label },
                  { id: 'key', header: 'Clé', sortBy: (row) => row.key, cell: (row) => row.key },
                  { id: 'share', header: 'Votre part', numeric: true, sortBy: (row) => row.share, cell: (row) => formatMoney(row.share, currency) },
                  { id: 'percent', header: 'Récupérable', numeric: true, sortBy: (row) => row.recoverablePercent, cell: (row) => (row.recoverablePercent === 0 ? '—' : `${formatNumber(row.recoverablePercent)} %`) },
                  { id: 'amount', header: 'Montant récupérable', numeric: true, sortBy: (row) => recoverable(row), cell: (row) => (row.recoverablePercent === 0 ? '—' : formatMoney(recoverable(row), currency)) },
                ]}
              />
              {data.lines.length > 0 ? (
                <p className="flex flex-wrap items-baseline justify-between gap-2 border-t border-line pt-2 text-body font-medium text-fg">
                  <span>Total</span>
                  <span className="tabular-nums">{`${formatMoney(budget, currency)} · ${budget === 0 ? '—' : percent((back / budget) * 100)} · ${formatMoney(back, currency)} récupérables`}</span>
                </p>
              ) : null}
            </Panel>
            <Panel
              title="Clés de répartition"
              action={
                <Button variant="link" size="sm" asChild>
                  <Link href={biensPaths.editImmeuble(id)}>Modifier</Link>
                </Button>
              }
            >
              <EntryList label="Clés de répartition" empty="Aucune clé de répartition définie." items={data.keys.map((key) => ({ id: key.id, title: key.label, detail: key.detail, badge: key.pill }))} />
            </Panel>
            <Panel
              title={`Régularisation ${String(data.year)}, estimation par lot`}
              action={
                <Button variant="secondary" size="sm" asChild>
                  <Link href={externalPaths.regularisation}>Lancer la régularisation</Link>
                </Button>
              }
            >
              <p className="text-caption text-fg-subtle">Charges récupérables réparties au tantième</p>
              <DataTable
                label="Régularisation par lot"
                rows={data.regularisation}
                getId={(row) => row.lotId}
                list={split}
                footer={false}
                empty={<p className="text-body text-fg-muted">Aucun lot à régulariser.</p>}
                columns={[
                  { id: 'lot', header: 'Lot', strong: true, sortBy: (row) => row.lotName, cell: (row) => <Link href={biensPaths.lot(row.lotId)} className="font-medium hover:underline">{row.lotName}</Link> },
                  { id: 'tenant', header: 'Locataire', sortBy: (row) => row.tenant, cell: (row) => row.tenant ?? '—' },
                  { id: 'tantiemes', header: 'Tantièmes', numeric: true, sortBy: (row) => row.tantiemes, cell: (row) => formatNumber(row.tantiemes) },
                  { id: 'provisions', header: 'Provisions versées', numeric: true, sortBy: (row) => row.provisions, cell: (row) => formatMoney(row.provisions, currency) },
                  { id: 'recoverable', header: 'Charges récupérables', numeric: true, sortBy: (row) => row.recoverable, cell: (row) => formatMoney(row.recoverable, currency) },
                  {
                    id: 'balance',
                    header: 'Solde',
                    numeric: true,
                    sortBy: (row) => row.provisions - row.recoverable,
                    cell: (row) => `${row.provisions - row.recoverable >= 0 ? '+' : '−'}${formatMoney(Math.abs(row.provisions - row.recoverable), currency)}`,
                  },
                  {
                    id: 'effect',
                    header: 'Effet',
                    cell: (row) => {
                      const balance = row.provisions - row.recoverable;
                      if (balance === 0) return 'Aucun écart';
                      return `${balance > 0 ? 'À rembourser' : 'À réclamer'}, ${formatMoney(Math.abs(balance), currency)}`;
                    },
                  },
                ]}
              />
            </Panel>
            <CategoryImportDialog owner={{ kind: 'immeuble', id }} category="Appel de fonds" title="Importer l’appel de fonds" pickerLabel="Déposer l’appel de fonds ici" open={importing} onOpenChange={setImporting} />
          </>
        );
      }}
    </QueryBoundary>
  );
}
