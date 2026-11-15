'use client';

import { Ban, CreditCard, Download, Eye, Mail, Receipt as ReceiptIcon } from 'lucide-react';
import {
  Badge,
  Button,
  Card,
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
import { CancelReceiptDialog } from './CancelReceiptDialog';
import { ReceiptDetailCard } from './ReceiptDetailCard';
import { useCancelReceipt, useEmitReceipts, useMarkReceiptSent, useReceipts } from './hooks';
import { courriersPaths } from './paths';
import type { Receipt } from './schemas';
import { ActionMenu, LinkButton, ListLoading, LoadError, PageHeader, SearchInput, errorMessage, useGestionNavigation, useNotify } from '../locataires/kit';
import type { ActionItem } from '../locataires/kit';
import { downloadCsv, toCsv } from '../locataires/kit/csv';
import { monthLabel } from '../locataires/kit/dates';
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
  { id: 'envoyees', label: 'Envoyées', match: (item) => item.sentOn !== null && item.cancellation === null },
  { id: 'annulees', label: 'Annulées', match: (item) => item.cancellation !== null },
];

function receiptState(item: Receipt): { label: string; tone: 'success' | 'info' | 'warning' | 'danger' } {
  if (item.cancellation) return { label: 'Annulée', tone: 'danger' };
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
  const cancel = useCancelReceipt();
  const [month, setMonth] = useState(ALL);
  const [unitId, setUnitId] = useState(ALL);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [cancelling, setCancelling] = useState<Receipt | null>(null);

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

  const cancelReceipt = async (item: Receipt, reason: string) => {
    try {
      await cancel.mutateAsync({ id: item.id, input: { reason } });
      setCancelling(null);
      setSelectedId(item.id);
      notify({ title: 'Quittance annulée', description: `${item.number ?? ''}, l’échéance de ${monthLabel(item.month)} redevient à émettre.` });
    } catch (error) {
      notify({ tone: 'danger', title: 'Annulation impossible', description: errorMessage(error) });
    }
  };

  const actionsFor = (item: Receipt): ActionItem[] => [
    { id: 'detail', label: 'Voir le détail', icon: Eye, onSelect: () => { setSelectedId(item.id); } },
    { id: 'pdf', label: 'Télécharger le PDF', icon: Download, disabled: item.number === null, onSelect: () => { push(courriersPaths.quittance(item.id)); } },
    { id: 'mail', label: 'Envoyer par e-mail', icon: Mail, disabled: item.number === null || item.cancellation !== null, onSelect: () => { void sendReceipt(item); } },
    { id: 'payment', label: 'Voir le paiement', icon: CreditCard, onSelect: () => { push(links.ledger(item.tenantId)); } },
    { id: 'cancel', label: 'Annuler la quittance', icon: Ban, tone: 'danger', separatorBefore: true, disabled: item.number === null || item.cancellation !== null, onSelect: () => { setCancelling(item); } },
  ];

  const exportCsv = () => {
    const rows = items.filter((item) => item.number !== null && (month === ALL || item.month === month));
    downloadCsv(
      'quittances.csv',
      toCsv(['Numéro', 'Mois', 'Locataire', 'Bien', 'Loyer', 'Charges', 'Total', 'État'], rows.map((item) => [item.number ?? '', monthLabel(item.month), lookups.tenantName(item.tenantId), lookups.unitLabel(item.unitId), money(item.rent), money(item.charges), money(item.rent + item.charges), receiptState(item).label])),
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
          <ReceiptDetailCard
            receipt={selected}
            tenantName={lookups.tenantName(selected.tenantId)}
            unitLabel={lookups.unitLabel(selected.unitId)}
            stateLabel={receiptState(selected).label}
            sending={send.isPending}
            onSend={() => { void sendReceipt(selected); }}
            onCancel={() => { setCancelling(selected); }}
          />
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
      <CancelReceiptDialog
        receipt={cancelling}
        tenantName={cancelling ? lookups.tenantName(cancelling.tenantId) : ''}
        pending={cancel.isPending}
        onClose={() => { setCancelling(null); }}
        onConfirm={(item, reason) => { void cancelReceipt(item, reason); }}
      />
    </>
  );
}
