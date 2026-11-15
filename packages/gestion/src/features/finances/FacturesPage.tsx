'use client';

import { CircleCheck, Download, FileMinus, FileText, Mail } from 'lucide-react';
import { useState } from 'react';
import { Alert, Badge, Button, ConfirmDialog, MenuItem, MenuSeparator, Select, Tab, TabList, TabPanel, Table, TableBody, TableCell, TableHead, TableHeaderCell, TableRow, Tabs, TextField } from '@eguardimmo/ui';
import { downloadCsv } from './csv';
import { formatDate } from './dates';
import { formatMoneyInput } from './money';
import { EmptyBlock, FINANCES_ROUTES, PageHeader, PagedFooter, PAGE_SIZE, QueryGate, useExec, useMoney } from './parts';
import type { ScreenProps } from './parts';
import { useFinances } from './queries';
import { financesPaths } from './paths';
import { RowMenu } from './RowMenu';
import type { Facture, FinancesData } from './schemas';
import { MarkPaidDialog } from './factures/MarkPaidDialog';
import { factureYears, filterFactures, inTab } from './factures/rows';
import type { FactureFilters, FactureTab } from './factures/rows';

const TABS: readonly FactureTab[] = ['toutes', 'payees', 'attente', 'avoirs'];
const isTab = (value: string): value is FactureTab => TABS.some((tab) => tab === value);

export function FacturesPage({ Link, navigate }: ScreenProps) {
  const query = useFinances();
  return (
    <>
      <PageHeader
        Link={Link}
        crumbs={[{ label: 'Finances', href: FINANCES_ROUTES.operations }, { label: 'Factures' }]}
        title="Factures"
        description="Factures et reçus émis, numérotés en continu. Une facture émise ne se supprime pas : elle s’annule par avoir."
      />
      <QueryGate query={query} errorTitle="Les factures n’ont pas pu être chargées">
        {(data) => <FacturesContent data={data} Link={Link} navigate={navigate} />}
      </QueryGate>
    </>
  );
}

function FacturesContent({ data, Link, navigate }: ScreenProps & { data: FinancesData }) {
  const money = useMoney(data.currency);
  const exec = useExec({ navigate });
  const years = factureYears(data);
  const [filters, setFilters] = useState<FactureFilters>({ tab: 'toutes', search: '', year: data.today.slice(0, 4) });
  const [page, setPage] = useState(1);
  const [paying, setPaying] = useState<Facture | null>(null);
  const [crediting, setCrediting] = useState<Facture | null>(null);

  const rows = filterFactures(data, filters);
  const visible = rows.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const countIn = (tab: FactureTab) => data.factures.filter((facture) => facture.date.startsWith(filters.year) && inTab(facture, tab)).length;
  const update = (patch: Partial<FactureFilters>) => {
    setFilters((current) => ({ ...current, ...patch }));
    setPage(1);
  };
  const exportRows = () => {
    downloadCsv('factures.csv', [
      ['Numéro', 'Date', 'Destinataire', 'Objet', 'Montant TTC', 'État'],
      ...rows.map((facture) => [facture.numero, formatDate(facture.date), facture.destinataire, facture.objet, formatMoneyInput(facture.montantTtc), facture.type === 'avoir' ? 'Avoir' : facture.statut === 'payee' ? 'Payée' : 'En attente']),
    ]);
  };

  return (
    <>
      <div className="flex flex-wrap justify-end gap-2">
        <Button variant="secondary" disabled={rows.length === 0} onClick={exportRows}>
          Exporter
        </Button>
        <Button asChild>
          <Link href={FINANCES_ROUTES.nouvelleFacture}>Nouvelle facture</Link>
        </Button>
      </div>
      {exec.error ? (
        <Alert tone="danger" title="L’opération n’a pas été enregistrée">
          {exec.error.message}
        </Alert>
      ) : null}
      <section aria-label="Liste des factures" className="flex min-w-0 flex-col gap-2 rounded-lg border border-line bg-surface p-4">
        <Tabs value={filters.tab} defaultValue="toutes" onValueChange={(tab) => { if (isTab(tab)) update({ tab }); }}>
          <TabList aria-label="Type de document">
            <Tab value="toutes" count={countIn('toutes')}>Toutes</Tab>
            <Tab value="payees" count={countIn('payees')}>Payées</Tab>
            <Tab value="attente" count={countIn('attente')}>En attente</Tab>
            <Tab value="avoirs" count={countIn('avoirs')}>Avoirs</Tab>
          </TabList>
        <TabPanel value={filters.tab}>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-[minmax(0,1fr)_200px]">
          <TextField label="Recherche" placeholder="Numéro, locataire" value={filters.search} onChange={(event) => { update({ search: event.target.value }); }} />
          <Select label="Période" placeholder="Année" options={years.map((year) => ({ value: year, label: `Période : ${year}` }))} value={filters.year} onValueChange={(year) => { update({ year }); }} />
        </div>
        {rows.length === 0 ? (
          <EmptyBlock title="Aucune facture ne correspond">Modifiez la recherche, l’onglet ou la période.</EmptyBlock>
        ) : (
          <Table aria-label="Factures et avoirs">
            <TableHead>
              <tr>
                <TableHeaderCell>Numéro</TableHeaderCell>
                <TableHeaderCell>Date</TableHeaderCell>
                <TableHeaderCell>Destinataire</TableHeaderCell>
                <TableHeaderCell>Objet</TableHeaderCell>
                <TableHeaderCell numeric>Montant TTC</TableHeaderCell>
                <TableHeaderCell>État</TableHeaderCell>
                <TableHeaderCell>Action</TableHeaderCell>
              </tr>
            </TableHead>
            <TableBody>
              {visible.map((facture) => (
                <TableRow key={facture.id}>
                  <TableCell strong>{facture.numero}</TableCell>
                  <TableCell>{formatDate(facture.date)}</TableCell>
                  <TableCell>{facture.destinataire}</TableCell>
                  <TableCell>{facture.objet}</TableCell>
                  <TableCell numeric>{money(facture.montantTtc)}</TableCell>
                  <TableCell>
                    {facture.type === 'avoir' ? <Badge>Avoir</Badge> : facture.statut === 'payee' ? <Badge tone="success">Payée</Badge> : <Badge tone="warning">En attente</Badge>}
                  </TableCell>
                  <TableCell>
                    <span className="flex items-center gap-1">
                      <Button variant="link" size="sm" onClick={() => { navigate(financesPaths.facture(facture.id)); }}>
                        Ouvrir
                      </Button>
                      <RowMenu>
                        <MenuItem icon={FileText} onSelect={() => { navigate(financesPaths.facture(facture.id)); }}>Aperçu du PDF</MenuItem>
                        <MenuItem icon={Download} onSelect={() => { navigate(`${financesPaths.facture(facture.id)}?imprimer=1`); }}>Télécharger le PDF</MenuItem>
                        <MenuItem icon={Mail} onSelect={() => { exec.run({ type: 'sendInvoice', factureId: facture.id }); }}>Envoyer par e-mail</MenuItem>
                        {facture.type === 'facture' && facture.statut === 'attente' ? (
                          <MenuItem icon={CircleCheck} onSelect={() => { setPaying(facture); }}>Enregistrer un paiement</MenuItem>
                        ) : null}
                        {facture.type === 'facture' && facture.avoirId === null ? (
                          <>
                            <MenuSeparator />
                            <MenuItem icon={FileMinus} tone="danger" onSelect={() => { setCrediting(facture); }}>Émettre un avoir</MenuItem>
                          </>
                        ) : null}
                      </RowMenu>
                    </span>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
        <PagedFooter page={page} total={rows.length} onPageChange={setPage} label="Pagination des factures" />
        </TabPanel>
        </Tabs>
      </section>

      <MarkPaidDialog
        open={paying !== null}
        numero={paying?.numero ?? ''}
        today={data.today}
        pending={exec.pending}
        error={exec.error}
        onClose={() => { setPaying(null); exec.reset(); }}
        onSubmit={(values) => { if (paying) exec.run({ type: 'markInvoicePaid', factureId: paying.id, ...values }, { onDone: () => { setPaying(null); } }); }}
      />
      <ConfirmDialog
        open={crediting !== null}
        onOpenChange={(open) => { if (!open) setCrediting(null); }}
        title="Émettre un avoir ?"
        description={crediting ? `L’avoir annule la facture ${crediting.numero} de ${money(crediting.montantTtc)} : il reçoit son propre numéro et la facture reste consultable.` : ''}
        confirmLabel="Émettre l’avoir"
        tone="danger"
        loading={exec.pending}
        onConfirm={() => { if (crediting) exec.run({ type: 'creditInvoice', factureId: crediting.id }, { redirect: 'result', onDone: () => { setCrediting(null); }, onError: () => { setCrediting(null); } }); }}
      />
    </>
  );
}
