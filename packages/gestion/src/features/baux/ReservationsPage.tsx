'use client';

import { Ban, CalendarCheck, CalendarRange, Copy, Wallet } from 'lucide-react';
import {
  Badge,
  Button,
  Card,
  ConfirmDialog,
  Dialog,
  DialogClose,
  DialogContent,
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
import type { BadgeTone } from '@eguardimmo/ui';
import { useState } from 'react';
import { useLeaseLookups } from './BauxParts';
import { useReservationAction, useReservations } from './hooks';
import { bauxPaths } from './paths';
import type { Reservation, ReservationStatus } from './schemas';
import { ActionMenu, LinkButton, ListLoading, LoadError, PageHeader, SearchInput, errorMessage, useGestionNavigation, useNotify } from '../locataires/kit';
import type { ActionItem } from '../locataires/kit';
import { downloadCsv, toCsv } from '../locataires/kit/csv';
import { daysBetween, formatDateFr } from '../locataires/kit/dates';
import { links } from '../locataires/kit/links';
import { money } from '../locataires/kit/money';
import { useListView } from '../locataires/kit/useListView';
import type { ListTab } from '../locataires/kit/useListView';

const ALL = 'tous';

const statusBadge: Record<ReservationStatus, { label: string; tone: BadgeTone }> = {
  option: { label: 'Option', tone: 'warning' },
  confirmee: { label: 'Confirmée', tone: 'success' },
  acompte_recu: { label: 'Acompte reçu', tone: 'info' },
  solde_a_percevoir: { label: 'Solde à percevoir', tone: 'warning' },
  annulee: { label: 'Annulée', tone: 'neutral' },
};

const tabs: ListTab<Reservation>[] = [
  { id: 'toutes', label: 'Toutes', match: (item) => item.status !== 'annulee' },
  { id: 'options', label: 'Options', match: (item) => item.status === 'option' },
  { id: 'solde', label: 'Solde à percevoir', match: (item) => item.status === 'solde_a_percevoir' || item.status === 'acompte_recu' },
  { id: 'annulees', label: 'Annulées', match: (item) => item.status === 'annulee' },
];

const TEMPLATE_HEADERS = ['Bien', 'Voyageur', 'Arrivée', 'Départ', 'Montant', 'Acompte'];

export function ReservationsPage() {
  const reservations = useReservations();
  const lookups = useLeaseLookups();
  const { push } = useGestionNavigation();
  const notify = useNotify();
  const act = useReservationAction();
  const [unitId, setUnitId] = useState(ALL);
  const [importOpen, setImportOpen] = useState(false);
  const [pendingCancel, setPendingCancel] = useState<Reservation | null>(null);

  const items = reservations.data ?? [];
  const searchText = (item: Reservation) => `${item.reference} ${item.guest} ${lookups.unitLabel(item.unitId)}`;
  const view = useListView({ items, tabs, searchText, predicate: (item) => unitId === ALL || item.unitId === unitId });
  const unitIds = [...new Set(items.map((item) => item.unitId))];

  const run = async (id: string, action: 'confirm' | 'cancel' | 'duplicate', success: string) => {
    try {
      const result = await act.mutateAsync({ id, action });
      notify({ title: success, description: result.reference });
    } catch (error) {
      notify({ tone: 'danger', title: 'Action impossible', description: errorMessage(error) });
    }
  };

  const actionsFor = (item: Reservation): ActionItem[] => [
    { id: 'confirm', label: 'Confirmer l’option', icon: CalendarCheck, disabled: item.status !== 'option', onSelect: () => { void run(item.id, 'confirm', 'Réservation confirmée'); } },
    { id: 'payment', label: 'Enregistrer un paiement', icon: Wallet, disabled: item.status === 'annulee', onSelect: () => { push(links.newPayment({ reservation: item.id })); } },
    { id: 'duplicate', label: 'Dupliquer en option', icon: Copy, onSelect: () => { void run(item.id, 'duplicate', 'Option créée'); } },
    { id: 'cancel', label: 'Annuler la réservation', icon: Ban, tone: 'danger', separatorBefore: true, disabled: item.status === 'annulee', onSelect: () => { setPendingCancel(item); } },
  ];

  const downloadTemplate = () => {
    downloadCsv('modele-reservations.csv', toCsv(TEMPLATE_HEADERS, [['Studio Plage', 'Anna Kowalski', '2026-12-01', '2026-12-08', '630,00', '300,00']]));
    notify({ title: 'Modèle téléchargé', description: 'modele-reservations.csv' });
  };

  const exportCsv = () => {
    downloadCsv(
      'reservations.csv',
      toCsv(
        ['Référence', 'Bien', 'Voyageur', 'Arrivée', 'Départ', 'Montant', 'Payé', 'Statut'],
        items.map((item) => [item.reference, lookups.unitLabel(item.unitId), item.guest, formatDateFr(item.arrival), formatDateFr(item.departure), money(item.amount), money(item.paid), statusBadge[item.status].label]),
      ),
    );
    notify({ title: 'Export prêt', description: `${String(items.length)} réservations exportées.` });
  };

  const confirmCancel = async () => {
    const target = pendingCancel;
    setPendingCancel(null);
    if (target) await run(target.id, 'cancel', 'Réservation annulée');
  };

  const expected = items.filter((item) => item.status !== 'annulee').reduce((sum, item) => sum + item.amount, 0);

  return (
    <>
      <PageHeader
        crumbs={[{ label: 'Accueil', href: links.home }, { label: 'Baux', href: bauxPaths.list }, { label: 'Réservations' }]}
        title="Réservations"
        subtitle={reservations.data ? `${String(view.counts.toutes ?? 0)} réservations actives, ${money(expected)} de chiffre d’affaires attendu.` : ' '}
        actions={
          <>
            <Button variant="secondary" onClick={exportCsv} disabled={!reservations.data}>Exporter</Button>
            <Button variant="secondary" onClick={() => { setImportOpen(true); }}>Importer</Button>
            <LinkButton href={`${bauxPaths.reservations}/nouvelle`} variant="primary" icon={CalendarRange}>Nouvelle réservation</LinkButton>
          </>
        }
      />
      {reservations.isError ? <LoadError title="Les réservations n’ont pas pu être chargées" /> : null}
      <Card role="region" aria-label="Liste des réservations" className="gap-3">
        <Tabs value={view.tab} onValueChange={view.setTab} defaultValue="toutes">
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
            </div>
            {reservations.isPending ? <ListLoading label="Chargement des réservations" /> : null}
            {reservations.data && view.rows.length === 0 ? (
              <EmptyState icon={CalendarRange} title="Aucune réservation" description={view.query !== '' || unitId !== ALL ? 'Aucune réservation ne correspond à ces filtres.' : 'Rien à afficher dans cette rubrique pour le moment.'} />
            ) : null}
            {view.rows.length > 0 ? (
              <Table aria-label="Réservations">
                <TableHead>
                  <TableRow>
                    <TableHeaderCell>Référence</TableHeaderCell>
                    <TableHeaderCell>Bien</TableHeaderCell>
                    <TableHeaderCell>Voyageur</TableHeaderCell>
                    <TableHeaderCell>Séjour</TableHeaderCell>
                    <TableHeaderCell numeric>Montant</TableHeaderCell>
                    <TableHeaderCell numeric>Payé</TableHeaderCell>
                    <TableHeaderCell>Statut</TableHeaderCell>
                    <TableHeaderCell><span className="sr-only">Actions</span></TableHeaderCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {view.rows.map((item) => (
                    <TableRow key={item.id}>
                      <TableCell strong>{item.reference}</TableCell>
                      <TableCell>{lookups.unitShort(item.unitId)}</TableCell>
                      <TableCell>{item.guest}</TableCell>
                      <TableCell>
                        {`${formatDateFr(item.arrival)} → ${formatDateFr(item.departure)}`}
                        <span className="block text-caption text-fg-subtle">{`${String(daysBetween(item.arrival, item.departure))} nuits`}</span>
                      </TableCell>
                      <TableCell numeric>{money(item.amount)}</TableCell>
                      <TableCell numeric>{money(item.paid)}</TableCell>
                      <TableCell>
                        <Badge tone={statusBadge[item.status].tone}>{statusBadge[item.status].label}</Badge>
                        {item.optionUntil ? <span className="block text-caption text-fg-subtle">{`Jusqu’au ${formatDateFr(item.optionUntil)}`}</span> : null}
                      </TableCell>
                      <TableCell><ActionMenu label={`Plus d’actions, ${item.reference}`} items={actionsFor(item)} /></TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : null}
            <Pagination page={view.page} pageSize={view.pageSize} total={view.total} onPageChange={view.setPage} label="Pagination des réservations" />
          </TabPanel>
        </Tabs>
      </Card>

      <Dialog open={importOpen} onOpenChange={setImportOpen}>
        <DialogContent title="Importer des réservations" description="Téléchargez le modèle CSV et remplissez une ligne par réservation. L’import du fichier sera disponible prochainement.">
          <div className="flex flex-col gap-3 p-4">
            <p className="text-body text-fg-muted">{`Colonnes attendues : ${TEMPLATE_HEADERS.join(', ')}. Dates au format aaaa-mm-jj, montants en euros.`}</p>
            <div className="flex flex-wrap justify-end gap-2">
              <DialogClose asChild>
                <Button variant="ghost">Fermer</Button>
              </DialogClose>
              <Button variant="secondary" onClick={downloadTemplate}>Télécharger le modèle</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
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
