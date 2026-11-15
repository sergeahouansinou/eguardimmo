'use client';

import { Ban, BellRing, CalendarCheck, CalendarRange, Copy, FileText, Mail, Pencil, Wallet } from 'lucide-react';
import {
  Button,
  Card,
  Chip,
  ConfirmDialog,
  EmptyState,
  Pagination,
  Select,
  Tab,
  TabList,
  TabPanel,
  Table,
  TableBody,
  TableHead,
  TableHeaderCell,
  TableRow,
  Tabs,
} from '@eguardimmo/ui';
import { useState } from 'react';
import { useLeaseLookups } from './BauxParts';
import { useReservationAction, useReservationMail, useReservations } from './hooks';
import { bauxPaths } from './paths';
import { ReservationCalendarDialog } from './ReservationCalendarDialog';
import { ReservationImportDialog } from './ReservationImportDialog';
import { ReservationRow, reservationStatusBadge } from './ReservationRow';
import type { Reservation, ReservationStatus } from './schemas';
import { LinkButton, ListLoading, LoadError, PageHeader, SearchInput, errorMessage, useGestionNavigation, useNotify } from '../locataires/kit';
import type { ActionItem } from '../locataires/kit';
import { useUnits } from '../locataires/hooks';
import { downloadCsv, toCsv } from '../locataires/kit/csv';
import { formatDateFr, monthLabel, todayIso } from '../locataires/kit/dates';
import { links } from '../locataires/kit/links';
import { money } from '../locataires/kit/money';
import { useListView } from '../locataires/kit/useListView';
import type { ListTab } from '../locataires/kit/useListView';

const ALL = 'tous';

const STATUS_FILTERS: readonly ReservationStatus[] = ['acompte_recu', 'solde_a_percevoir', 'option'];

function buildTabs(today: string): ListTab<Reservation>[] {
  return [
    { id: 'a_venir', label: 'À venir', match: (item) => item.status !== 'annulee' && item.arrival > today },
    { id: 'en_cours', label: 'En cours', match: (item) => item.status !== 'annulee' && item.arrival <= today && item.departure > today },
    { id: 'passees', label: 'Passées', match: (item) => item.status !== 'annulee' && item.departure <= today },
    { id: 'annulees', label: 'Annulées', match: (item) => item.status === 'annulee' },
  ];
}

export function ReservationsPage() {
  const reservations = useReservations();
  const lookups = useLeaseLookups();
  const { push } = useGestionNavigation();
  const notify = useNotify();
  const act = useReservationAction();
  const mail = useReservationMail();
  const units = useUnits();
  const [unitId, setUnitId] = useState(ALL);
  const [period, setPeriod] = useState(ALL);
  const [statusFilter, setStatusFilter] = useState<ReservationStatus | null>(null);
  const [importOpen, setImportOpen] = useState(false);
  const [calendarOpen, setCalendarOpen] = useState(false);
  const [pendingCancel, setPendingCancel] = useState<Reservation | null>(null);

  const items = reservations.data ?? [];
  const searchText = (item: Reservation) => `${item.reference} ${item.guest} ${lookups.unitLabel(item.unitId)}`;
  const tabs = buildTabs(todayIso());
  const view = useListView({
    items,
    tabs,
    searchText,
    predicate: (item) =>
      (unitId === ALL || item.unitId === unitId) &&
      (period === ALL || (item.arrival.slice(0, 7) <= period && item.departure.slice(0, 7) >= period)) &&
      (statusFilter === null || item.status === statusFilter),
  });
  const unitIds = [...new Set(items.map((item) => item.unitId))];
  const periods = [...new Set(items.flatMap((item) => [item.arrival.slice(0, 7), item.departure.slice(0, 7)]))].sort().reverse();
  const filtered = unitId !== ALL || period !== ALL || statusFilter !== null;

  const run = async (id: string, action: 'confirm' | 'cancel' | 'duplicate', success: string) => {
    try {
      const result = await act.mutateAsync({ id, action });
      notify({ title: success, description: result.reference });
    } catch (error) {
      notify({ tone: 'danger', title: 'Action impossible', description: errorMessage(error) });
    }
  };

  const send = async (id: string, kind: 'confirmation' | 'rappel') => {
    try {
      const result = await mail.mutateAsync({ id, kind });
      notify({ title: kind === 'confirmation' ? 'Confirmation envoyée' : 'Relance envoyée', description: `${result.reference}, ${result.guest}` });
    } catch (error) {
      notify({ tone: 'danger', title: 'Envoi impossible', description: errorMessage(error) });
    }
  };

  const actionsFor = (item: Reservation): ActionItem[] => [
    { id: 'edit', label: 'Modifier', icon: Pencil, disabled: item.status === 'annulee', onSelect: () => { push(bauxPaths.editReservation(item.id)); } },
    { id: 'confirm', label: 'Confirmer l’option', icon: CalendarCheck, disabled: item.status !== 'option', onSelect: () => { void run(item.id, 'confirm', 'Réservation confirmée'); } },
    { id: 'mail', label: 'Envoyer la confirmation', icon: Mail, disabled: item.status === 'annulee' || item.status === 'option', onSelect: () => { void send(item.id, 'confirmation'); } },
    { id: 'remind', label: 'Relancer le solde', icon: BellRing, disabled: item.status === 'annulee' || item.paid >= item.amount, onSelect: () => { void send(item.id, 'rappel'); } },
    { id: 'payment', label: 'Enregistrer un paiement', icon: Wallet, disabled: item.status === 'annulee', onSelect: () => { push(links.newPayment({ reservation: item.id })); } },
    { id: 'contract', label: 'Contrat de location', icon: FileText, disabled: item.status === 'annulee', onSelect: () => { push(bauxPaths.reservationContract(item.id)); } },
    { id: 'duplicate', label: 'Dupliquer en option', icon: Copy, onSelect: () => { void run(item.id, 'duplicate', 'Option créée'); } },
    { id: 'cancel', label: 'Annuler la réservation', icon: Ban, tone: 'danger', separatorBefore: true, disabled: item.status === 'annulee', onSelect: () => { setPendingCancel(item); } },
  ];

  const exportCsv = () => {
    downloadCsv(
      'reservations.csv',
      toCsv(
        ['Référence', 'Bien', 'Voyageur', 'Arrivée', 'Départ', 'Montant', 'Payé', 'Statut'],
        items.map((item) => [item.reference, lookups.unitLabel(item.unitId), item.guest, formatDateFr(item.arrival), formatDateFr(item.departure), money(item.amount), money(item.paid), reservationStatusBadge[item.status].label]),
      ),
    );
    notify({ title: 'Export prêt', description: `${String(items.length)} réservations exportées.` });
  };

  const confirmCancel = async () => {
    const target = pendingCancel;
    setPendingCancel(null);
    if (target) await run(target.id, 'cancel', 'Réservation annulée');
  };


  return (
    <>
      <PageHeader
        crumbs={[{ label: 'Accueil', href: links.home }, { label: 'Baux', href: bauxPaths.list }, { label: 'Réservations' }]}
        title="Réservations"
        subtitle="Séjours de courte durée en location meublée. Chaque réservation porte un acompte et un dépôt de garantie."
        actions={
          <>
            <Button variant="secondary" onClick={exportCsv} disabled={!reservations.data}>Exporter</Button>
            <Button variant="secondary" onClick={() => { setImportOpen(true); }}>Importer</Button>
            <Button variant="secondary" disabled={!reservations.data || !units.data} onClick={() => { setCalendarOpen(true); }}>Calendrier</Button>
            <LinkButton href={bauxPaths.newReservation} variant="primary" icon={CalendarRange}>Nouvelle réservation</LinkButton>
          </>
        }
      />
      {reservations.isError ? <LoadError title="Les réservations n’ont pas pu être chargées" /> : null}
      <Card role="region" aria-label="Liste des réservations" className="gap-3">
        <Tabs value={view.tab} onValueChange={view.setTab} defaultValue="a_venir">
          <TabList aria-label="Filtrer les réservations">
            {tabs.map((tab) => (
              <Tab key={tab.id} value={tab.id} count={view.counts[tab.id] ?? 0}>{tab.label}</Tab>
            ))}
          </TabList>
          <TabPanel value={view.tab} className="flex flex-col gap-3 pt-1">
            <div className="flex flex-wrap items-center gap-2">
              <SearchInput label="Rechercher une réservation" placeholder="Référence, voyageur, bien" value={view.query} onValueChange={view.setQuery} />
              <Select
                label="Bien"
                hideLabel
                placeholder="Bien : Tous"
                value={unitId}
                onValueChange={(value) => { setUnitId(value); view.resetPage(); }}
                options={[{ value: ALL, label: 'Bien : Tous' }, ...unitIds.map((entry) => ({ value: entry, label: lookups.unitShort(entry) }))]}
                className="w-48"
              />
              <Select
                label="Période"
                hideLabel
                placeholder="Période : Toutes"
                value={period}
                onValueChange={(value) => { setPeriod(value); view.resetPage(); }}
                options={[{ value: ALL, label: 'Période : Toutes' }, ...periods.map((entry) => ({ value: entry, label: monthLabel(entry) }))]}
                className="w-56"
              />
              <div role="group" aria-label="Statut" className="flex flex-wrap items-center gap-1.5">
                {STATUS_FILTERS.map((status) => (
                  <Chip key={status} pressed={statusFilter === status} onClick={() => { setStatusFilter(statusFilter === status ? null : status); view.resetPage(); }}>
                    {reservationStatusBadge[status].label}
                  </Chip>
                ))}
              </div>
            </div>
            {reservations.isPending ? <ListLoading label="Chargement des réservations" /> : null}
            {reservations.data && view.rows.length === 0 ? (
              <EmptyState icon={CalendarRange} title="Aucune réservation" description={view.query !== '' || filtered ? 'Aucune réservation ne correspond à ces filtres.' : 'Rien à afficher dans cette rubrique pour le moment.'} />
            ) : null}
            {view.rows.length > 0 ? (
              <Table aria-label="Réservations">
                <TableHead>
                  <TableRow>
                    <TableHeaderCell>Référence</TableHeaderCell>
                    <TableHeaderCell>Bien</TableHeaderCell>
                    <TableHeaderCell>Voyageur</TableHeaderCell>
                    <TableHeaderCell>Arrivée</TableHeaderCell>
                    <TableHeaderCell>Départ</TableHeaderCell>
                    <TableHeaderCell numeric>Nuits</TableHeaderCell>
                    <TableHeaderCell numeric>Montant</TableHeaderCell>
                    <TableHeaderCell numeric>Dépôt</TableHeaderCell>
                    <TableHeaderCell>État</TableHeaderCell>
                    <TableHeaderCell><span className="sr-only">Actions</span></TableHeaderCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {view.rows.map((item) => (
                    <ReservationRow
                      key={item.id}
                      item={item}
                      unit={lookups.unitShort(item.unitId)}
                      actions={actionsFor(item)}
                      onConfirm={() => { void run(item.id, 'confirm', 'Réservation confirmée'); }}
                      onRemind={() => { void send(item.id, 'rappel'); }}
                    />
                  ))}
                </TableBody>
              </Table>
            ) : null}
            <Pagination page={view.page} pageSize={view.pageSize} total={view.total} onPageChange={view.setPage} label="Pagination des réservations" />
          </TabPanel>
        </Tabs>
      </Card>

      <ReservationImportDialog open={importOpen} onOpenChange={setImportOpen} />
      <ReservationCalendarDialog open={calendarOpen} onOpenChange={setCalendarOpen} reservations={items} units={(units.data ?? []).filter((unit) => items.some((item) => item.unitId === unit.id))} />
      <ConfirmDialog
        open={pendingCancel !== null}
        onOpenChange={(open) => { if (!open) setPendingCancel(null); }}
        title="Annuler cette réservation ?"
        description={`${pendingCancel?.reference ?? ''} sera marquée comme annulée. L’historique est conservé.`}
        confirmLabel="Annuler la réservation"
        tone="danger"
        onConfirm={() => { void confirmCancel(); }}
      />
    </>
  );
}
