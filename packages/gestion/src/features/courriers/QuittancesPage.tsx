'use client';

import { CreditCard, Download, Eye, Mail, Receipt as ReceiptIcon } from 'lucide-react';
import {
  Badge,
  Button,
  Card,
  CardTitle,
  ConfirmDialog,
  EmptyState,
  Pagination,
  Select,
  Tab,
  TabList,
  TabPanel,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeaderCell,
  TableRow,
  Tabs,
} from '@eguardimmo/ui';
import { useState } from 'react';
import { useLeaseLookups } from '../baux/BauxParts';
import { bauxPaths } from '../baux/paths';
import { useEmitReceipts, useMarkReceiptSent, useReceipts } from './hooks';
import { courriersPaths } from './paths';
import type { Receipt } from './schemas';
import { ActionMenu, DescriptionList, LinkButton, ListLoading, LoadError, PageHeader, SearchInput, errorMessage, useGestionNavigation, useNotify } from '../locataires/kit';
import type { ActionItem } from '../locataires/kit';
import { downloadCsv, toCsv } from '../locataires/kit/csv';
import { formatDateFr, monthLabel } from '../locataires/kit/dates';
import { links } from '../locataires/kit/links';
import { money } from '../locataires/kit/money';
import { useListView } from '../locataires/kit/useListView';
import type { ListTab } from '../locataires/kit/useListView';

const ALL = 'toutes';

const isToSettle = (item: Receipt) => item.number === null && item.outstanding > 0;
const isToEmit = (item: Receipt) => item.number === null && item.outstanding === 0;

const tabs: ListTab<Receipt>[] = [
  { id: 'toutes', label: 'Toutes', match: () => true },
  { id: 'a_solder', label: 'À solder', match: isToSettle },
  { id: 'a_emettre', label: 'À émettre', match: isToEmit },
  { id: 'envoyees', label: 'Envoyées', match: (item) => item.sentOn !== null },
];

function receiptState(item: Receipt): { label: string; tone: 'success' | 'info' | 'warning' } {
  if (item.sentOn) return { label: 'Envoyée', tone: 'success' };
  if (item.number) return { label: 'Émise', tone: 'info' };
  if (item.outstanding > 0) return { label: `Reste dû ${money(item.outstanding)}`, tone: 'warning' };
  return { label: 'À émettre', tone: 'warning' };
}

export function QuittancesPage() {
  const receipts = useReceipts();
  const lookups = useLeaseLookups();
  const notify = useNotify();
  const { push } = useGestionNavigation();
  const emit = useEmitReceipts();
  const send = useMarkReceiptSent();
  const [month, setMonth] = useState(ALL);
  const [unitId, setUnitId] = useState(ALL);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);

  const items = receipts.data ?? [];
  const months = [...new Set(items.map((item) => item.month))].sort().reverse();
  const unitIds = [...new Set(items.map((item) => item.unitId))].sort((a, b) => lookups.unitLabel(a).localeCompare(lookups.unitLabel(b), 'fr'));
  const searchText = (item: Receipt) => `${item.number ?? ''} ${lookups.tenantName(item.tenantId)} ${lookups.unitLabel(item.unitId)}`;
  const view = useListView({ items, tabs, searchText, predicate: (item) => (month === ALL || item.month === month) && (unitId === ALL || item.unitId === unitId) });
  const pendingMonths = [...new Set(items.filter(isToEmit).map((item) => item.month))];
  const selected = items.find((item) => item.id === selectedId) ?? null;
  const toEmit = items.filter((item) => isToEmit(item) && (month === ALL || item.month === month));
  const emitMonth = month === ALL ? pendingMonths[0] : month;

  const emitAll = async () => {
    setConfirming(false);
    if (!emitMonth) return;
    try {
      const created = await emit.mutateAsync(emitMonth);
      notify({ title: 'Quittances émises', description: `${String(created.length)} quittances de ${monthLabel(emitMonth)}, envoyées aux locataires.` });
      setSelectedId(null);
    } catch (error) {
      notify({ tone: 'danger', title: 'Émission impossible', description: errorMessage(error) });
    }
  };

  const sendReceipt = async (item: Receipt) => {
    try {
      await send.mutateAsync(item.id);
      notify({ title: 'Quittance envoyée', description: `${item.number ?? ''}, ${lookups.tenantName(item.tenantId)}` });
    } catch (error) {
      notify({ tone: 'danger', title: 'Envoi impossible', description: errorMessage(error) });
    }
  };

  const actionsFor = (item: Receipt): ActionItem[] => [
    { id: 'detail', label: 'Voir le détail', icon: Eye, onSelect: () => { setSelectedId(item.id); } },
    { id: 'pdf', label: 'Télécharger le PDF', icon: Download, disabled: item.number === null, onSelect: () => { push(courriersPaths.quittance(item.id)); } },
    { id: 'mail', label: 'Envoyer par e-mail', icon: Mail, disabled: item.number === null, onSelect: () => { void sendReceipt(item); } },
    { id: 'payment', label: 'Voir le paiement', icon: CreditCard, onSelect: () => { push(links.ledger(item.tenantId)); } },
  ];

  const exportCsv = () => {
    const rows = items.filter((item) => item.number !== null && (month === ALL || item.month === month));
    downloadCsv(
      'quittances.csv',
      toCsv(['Numéro', 'Mois', 'Locataire', 'Bien', 'Loyer', 'Charges', 'Total'], rows.map((item) => [item.number ?? '', monthLabel(item.month), lookups.tenantName(item.tenantId), lookups.unitLabel(item.unitId), money(item.rent), money(item.charges), money(item.rent + item.charges)])),
    );
    notify({ title: 'Export prêt', description: `${String(rows.length)} quittances exportées.` });
  };

  return (
    <>
      <PageHeader
        crumbs={[{ label: 'Accueil', href: links.home }, { label: 'Documents', href: courriersPaths.documents }, { label: 'Quittances' }]}
        title="Quittances"
        subtitle="Une quittance par échéance intégralement soldée, numérotée et scellée au moment de l’envoi."
        actions={
          <>
            <Button variant="secondary" onClick={exportCsv} disabled={!receipts.data}>Exporter</Button>
            <Button disabled={toEmit.length === 0} loading={emit.isPending} onClick={() => { setConfirming(true); }}>
              Émettre les quittances soldées
            </Button>
          </>
        }
      />
      {receipts.isError ? <LoadError title="Les quittances n’ont pas pu être chargées" /> : null}
      <div className="grid grid-cols-1 items-start gap-3 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <Card role="region" aria-label="Liste des quittances" className="min-w-0 gap-3">
          <Tabs value={view.tab} onValueChange={view.setTab} defaultValue="emises">
            <TabList aria-label="Filtrer les quittances">
              {tabs.map((tab) => (
                <Tab key={tab.id} value={tab.id} count={view.counts[tab.id] ?? 0}>{tab.label}</Tab>
              ))}
            </TabList>
            <TabPanel value={view.tab} className="flex flex-col gap-3 pt-1">
              <div className="flex flex-wrap items-center gap-2">
                <SearchInput label="Rechercher une quittance" placeholder="Numéro, locataire" value={view.query} onValueChange={view.setQuery} />
                <Select
                  label="Bien"
                  hideLabel
                  placeholder="Bien : Tous"
                  value={unitId}
                  onValueChange={(value) => { setUnitId(value); view.resetPage(); }}
                  options={[{ value: ALL, label: 'Bien : Tous' }, ...unitIds.map((entry) => ({ value: entry, label: lookups.unitLabel(entry) }))]}
                  className="w-56"
                />
                <Select
                  label="Période"
                  hideLabel
                  placeholder="Période : Toutes"
                  value={month}
                  onValueChange={(value) => { setMonth(value); view.resetPage(); }}
                  options={[{ value: ALL, label: 'Période : Toutes' }, ...months.map((entry) => ({ value: entry, label: monthLabel(entry) }))]}
                  className="w-52"
                />
              </div>
              {receipts.isPending ? <ListLoading label="Chargement des quittances" /> : null}
              {receipts.data && view.rows.length === 0 ? (
                <EmptyState icon={ReceiptIcon} title="Aucune quittance" description={view.query !== '' || month !== ALL || unitId !== ALL ? 'Aucune quittance ne correspond à ces filtres.' : 'Rien à afficher dans cette rubrique pour le moment.'} />
              ) : null}
              {view.rows.length > 0 ? (
                <Table aria-label="Quittances">
                  <TableHead>
                    <TableRow>
                      <TableHeaderCell>Numéro</TableHeaderCell>
                      <TableHeaderCell>Locataire</TableHeaderCell>
                      <TableHeaderCell>Période</TableHeaderCell>
                      <TableHeaderCell numeric>Montant</TableHeaderCell>
                      <TableHeaderCell>État</TableHeaderCell>
                      <TableHeaderCell><span className="sr-only">Actions</span></TableHeaderCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {view.rows.map((item) => (
                      <TableRow key={item.id} selected={item.id === selectedId}>
                        <TableCell strong>{item.number ?? 'Brouillon'}</TableCell>
                        <TableCell>{lookups.tenantName(item.tenantId)}</TableCell>
                        <TableCell>{monthLabel(item.month)}</TableCell>
                        <TableCell numeric>{money(item.rent + item.charges)}</TableCell>
                        <TableCell><Badge tone={receiptState(item).tone}>{receiptState(item).label}</Badge></TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1">
                            {item.number ? (
                              <LinkButton href={courriersPaths.quittance(item.id)} size="sm">Télécharger</LinkButton>
                            ) : (
                              <LinkButton href={bauxPaths.schedule(item.leaseId)} size="sm">Échéancier</LinkButton>
                            )}
                            <ActionMenu label={`Plus d’actions, ${item.number ?? `brouillon ${lookups.tenantName(item.tenantId)}`}`} items={actionsFor(item)} />
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              ) : null}
              <Pagination page={view.page} pageSize={view.pageSize} total={view.total} onPageChange={view.setPage} label="Pagination des quittances" />
            </TabPanel>
          </Tabs>
        </Card>
        {selected ? (
          <Card role="region" aria-label="Détail de la quittance" className="gap-3">
            <CardTitle as="h2">{selected.number ?? 'Brouillon de quittance'}</CardTitle>
            <Badge tone={selected.number ? 'success' : 'warning'}>{selected.number ? 'Scellée' : receiptState(selected).label}</Badge>
            <DescriptionList
              termWidth="100px"
              items={[
                { term: 'Locataire', detail: lookups.tenantName(selected.tenantId) },
                { term: 'Bien', detail: lookups.unitLabel(selected.unitId) },
                { term: 'Période', detail: monthLabel(selected.month) },
                { term: 'Loyer', detail: money(selected.rent) },
                { term: 'Charges', detail: money(selected.charges) },
                { term: 'Total', detail: money(selected.rent + selected.charges) },
                ...(selected.outstanding > 0 ? [{ term: 'Reste dû', detail: money(selected.outstanding) }] : []),
                { term: 'Émise le', detail: formatDateFr(selected.issuedOn) },
                { term: 'Envoyée le', detail: formatDateFr(selected.sentOn) },
              ]}
            />
            <div className="flex flex-wrap gap-2">
              {selected.number ? (
                <>
                  <LinkButton href={courriersPaths.quittance(selected.id)} variant="primary" icon={Download}>Ouvrir le PDF</LinkButton>
                  <Button variant="secondary" loading={send.isPending} onClick={() => { void sendReceipt(selected); }}>Envoyer par e-mail</Button>
                </>
              ) : (
                <p className="text-caption text-fg-subtle">{selected.outstanding > 0 ? 'La quittance sera émise une fois l’échéance intégralement soldée.' : 'Émettez les quittances soldées pour la générer.'}</p>
              )}
            </div>
          </Card>
        ) : null}
      </div>
      <ConfirmDialog
        open={confirming}
        onOpenChange={setConfirming}
        title="Émettre les quittances soldées ?"
        description={`${String(toEmit.length)} quittances ${emitMonth ? `de ${monthLabel(emitMonth)} ` : ''}seront numérotées puis envoyées aux locataires. Les numéros attribués ne peuvent plus être modifiés.`}
        confirmLabel="Émettre les quittances"
        onConfirm={() => { void emitAll(); }}
      />
    </>
  );
}
