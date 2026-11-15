'use client';

import { Banknote, CalendarClock, ClipboardCheck, Copy, FilePen, FilePlus, FileText, LogOut, Pencil, Receipt, RefreshCw, Trash2, TrendingUp } from 'lucide-react';
import {
  Alert,
  Button,
  Card,
  Checkbox,
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
import { FileStack } from 'lucide-react';
import { useState } from 'react';
import { ReviseRentDialog } from './ReviseRentDialog';
import { useLeaseLookups } from './BauxParts';
import { LeaseRow } from './LeaseRow';
import { useDeleteLease, useDuplicateLease, useExits, useLeases } from './hooks';
import { bauxPaths } from './paths';
import type { Lease } from './schemas';
import { LinkButton, ListLoading, LoadError, PageHeader, SearchInput, errorMessage, useGestionNavigation, useNotify } from '../locataires/kit';
import type { ActionItem } from '../locataires/kit';
import { downloadCsv, toCsv } from '../locataires/kit/csv';
import { addDays, daysBetween, formatDateFr, todayIso } from '../locataires/kit/dates';
import { links } from '../locataires/kit/links';
import { money } from '../locataires/kit/money';
import { useListView } from '../locataires/kit/useListView';
import type { ListTab } from '../locataires/kit/useListView';

const tabs: ListTab<Lease>[] = [
  { id: 'actifs', label: 'Actifs', match: (lease) => lease.status === 'en_cours' || lease.status === 'preavis' },
  { id: 'a_venir', label: 'À venir', match: (lease) => lease.status === 'a_venir' },
  { id: 'termines', label: 'Terminés', match: (lease) => lease.status === 'termine' },
  { id: 'brouillons', label: 'Brouillons', match: (lease) => lease.status === 'brouillon' },
];

const SORTS = [
  { value: 'fin', label: 'Tri : fin la plus proche' },
  { value: 'loyer', label: 'Tri : loyer décroissant' },
  { value: 'debut', label: 'Tri : début le plus récent' },
  { value: 'bien', label: 'Tri : bien (A à Z)' },
];
const WINDOWS = [30, 60, 90] as const;
const ALL = 'tous';
const TYPES = [
  { value: ALL, label: 'Type : Tous' },
  { value: 'vide', label: 'Vide' },
  { value: 'meuble', label: 'Meublé' },
];
const BALANCES = [
  { value: ALL, label: 'Solde : Tous' },
  { value: 'impayes', label: 'Impayés' },
  { value: 'a_jour', label: 'À jour' },
];
const SOON_DAYS = 60;

export function BauxPage() {
  const leases = useLeases();
  const lookups = useLeaseLookups();
  const { push } = useGestionNavigation();
  const notify = useNotify();
  const duplicate = useDuplicateLease();
  const remove = useDeleteLease();
  const exits = useExits();

  const [building, setBuilding] = useState(ALL);
  const [kind, setKind] = useState(ALL);
  const [balance, setBalance] = useState(ALL);
  const [sort, setSort] = useState('fin');
  const [window, setWindow] = useState<number | null>(null);
  const [selected, setSelected] = useState<readonly string[]>([]);
  const [pendingDelete, setPendingDelete] = useState<readonly Lease[]>([]);
  const [revising, setRevising] = useState<Lease | null>(null);

  const items = leases.data ?? [];
  const today = todayIso();
  const endingWithin = (lease: Lease, days: number) => lease.status !== 'termine' && lease.status !== 'brouillon' && lease.end >= today && daysBetween(today, lease.end) <= days;
  const searchText = (lease: Lease) => `${lease.reference} ${lookups.unitLabel(lease.unitId)} ${lookups.tenantsOf(lease)}`;
  const buildings = [...new Set(items.map((lease) => lookups.unitBuilding(lease.unitId)).filter((entry) => entry !== ''))].sort((a, b) => a.localeCompare(b, 'fr'));
  const view = useListView({
    items,
    tabs,
    searchText,
    predicate: (lease) =>
      (window === null || endingWithin(lease, window)) &&
      (building === ALL || lookups.unitBuilding(lease.unitId) === building) &&
      (kind === ALL || (kind === 'meuble') === lease.furnished) &&
      (balance === ALL || (balance === 'impayes') === (lease.balance < 0)),
  });
  const filtered = window !== null || building !== ALL || kind !== ALL || balance !== ALL;

  const sorted = [...view.rows].sort((a, b) => {
    if (sort === 'loyer') return b.rent - a.rent;
    if (sort === 'debut') return b.start.localeCompare(a.start);
    if (sort === 'bien') return lookups.unitLabel(a.unitId).localeCompare(lookups.unitLabel(b.unitId), 'fr');
    return a.end.localeCompare(b.end);
  });

  const active = items.filter((lease) => lease.status === 'en_cours' || lease.status === 'preavis');
  const monthlyRent = active.reduce((sum, lease) => sum + lease.rent + lease.charges, 0);
  const endingSoon = active.filter((lease) => endingWithin(lease, SOON_DAYS)).length;
  const departureOf = (lease: Lease) => exits.data?.find((entry) => entry.leaseId === lease.id)?.departure ?? lease.end;
  const notices = items.filter((lease) => lease.status === 'preavis').sort((a, b) => departureOf(a).localeCompare(departureOf(b)));
  const nextNotice = notices[0];
  const visibleSelected = selected.filter((id) => sorted.some((lease) => lease.id === id));
  const selectedLeases = items.filter((lease) => visibleSelected.includes(lease.id));
  const allSelected = sorted.length > 0 && sorted.every((lease) => selected.includes(lease.id));

  const toggle = (id: string) => { setSelected((current) => (current.includes(id) ? current.filter((entry) => entry !== id) : [...current, id])); };
  const toggleAll = () => { setSelected(allSelected ? [] : sorted.map((lease) => lease.id)); };

  const exportCsv = (rows: readonly Lease[]) => {
    downloadCsv(
      'baux.csv',
      toCsv(
        ['Référence', 'Bien', 'Locataires', 'Début', 'Fin', 'Loyer', 'Charges', 'Statut'],
        rows.map((lease) => [lease.reference, lookups.unitLabel(lease.unitId), lookups.tenantsOf(lease), formatDateFr(lease.start), formatDateFr(lease.end), money(lease.rent), money(lease.charges), lease.status]),
      ),
    );
    notify({ title: 'Export prêt', description: `${String(rows.length)} baux exportés dans baux.csv.` });
  };

  const confirmDelete = async () => {
    const targets = pendingDelete;
    setPendingDelete([]);
    try {
      for (const lease of targets) await remove.mutateAsync(lease.id);
      setSelected((current) => current.filter((id) => !targets.some((lease) => lease.id === id)));
      notify({ title: targets.length > 1 ? 'Brouillons supprimés' : 'Brouillon supprimé', description: targets.map((lease) => lease.reference).join(', ') });
    } catch (error) {
      notify({ tone: 'danger', title: 'Suppression impossible', description: errorMessage(error) });
    }
  };

  const actionsFor = (lease: Lease): ActionItem[] => {
    const editable = lease.status !== 'termine';
    return [
      { id: 'open', label: 'Ouvrir le bail', icon: FileText, onSelect: () => { push(bauxPaths.detail(lease.id)); } },
      { id: 'edit', label: lease.status === 'brouillon' ? 'Poursuivre la saisie' : 'Modifier', icon: Pencil, disabled: !editable, onSelect: () => { push(bauxPaths.edit(lease.id)); } },
      { id: 'payment', label: 'Enregistrer un paiement', icon: Banknote, disabled: lease.status === 'brouillon' || lease.status === 'a_venir', onSelect: () => { push(links.newPayment({ locataire: lease.tenantIds[0] })); } },
      { id: 'schedule', label: 'Échéancier', icon: CalendarClock, disabled: lease.status === 'brouillon', onSelect: () => { push(bauxPaths.schedule(lease.id)); } },
      { id: 'receipt', label: 'Quittances', icon: Receipt, disabled: lease.status === 'brouillon' || lease.status === 'a_venir', onSelect: () => { push('/documents/quittances'); } },
      { id: 'notice', label: 'Avis d’échéance', icon: Receipt, disabled: lease.status === 'brouillon' || lease.status === 'a_venir', onSelect: () => { push('/documents/avis-echeance'); } },
      { id: 'revise', label: 'Réviser le loyer', icon: TrendingUp, disabled: lease.status === 'termine' || lease.status === 'brouillon', onSelect: () => { setRevising(lease); } },
      {
        id: 'renew',
        label: 'Renouveler',
        icon: RefreshCw,
        disabled: lease.status !== 'en_cours' && lease.status !== 'preavis',
        onSelect: () => { push(`${links.newLease({ bien: lease.unitId, locataire: lease.tenantIds[0] })}&debut=${addDays(lease.end, 1)}`); },
      },
      { id: 'edl', label: 'État des lieux', icon: ClipboardCheck, disabled: lease.status === 'brouillon', onSelect: () => { push(`${bauxPaths.newEdl}?bien=${lease.unitId}`); } },
      { id: 'letter', label: 'Générer un courrier', icon: FilePen, onSelect: () => { push(links.newCourrier({ bien: lease.unitId, locataire: lease.tenantIds[0] })); } },
      {
        id: 'duplicate',
        label: 'Dupliquer en brouillon',
        icon: Copy,
        onSelect: () => {
          void duplicate.mutateAsync(lease.id).then(
            (copy) => { notify({ title: 'Brouillon créé', description: copy.reference }); },
            (error: unknown) => { notify({ tone: 'danger', title: 'Duplication impossible', description: errorMessage(error) }); },
          );
        },
      },
      { id: 'exit', label: 'Préavis et sortie', icon: LogOut, separatorBefore: true, disabled: lease.status === 'brouillon' || lease.status === 'a_venir', onSelect: () => { push(bauxPaths.exit(lease.id)); } },
      { id: 'delete', label: 'Supprimer le brouillon', icon: Trash2, tone: 'danger', disabled: lease.status !== 'brouillon', onSelect: () => { setPendingDelete([lease]); } },
    ];
  };

  return (
    <>
      <PageHeader
        crumbs={[{ label: 'Accueil', href: links.home }, { label: 'Baux' }]}
        title="Baux"
        subtitle={
          leases.data
            ? `${String(active.length)} baux en cours, ${money(monthlyRent)} appelés par mois, charges comprises.${endingSoon > 0 ? ` ${String(endingSoon)} ${endingSoon > 1 ? 'se terminent' : 'se termine'} dans moins de ${String(SOON_DAYS)} jours.` : ''}`
            : ' '
        }
        actions={
          <>
            <Button variant="secondary" onClick={() => { exportCsv(items); }} disabled={!leases.data}>Exporter</Button>
            <LinkButton href={bauxPaths.edls}>États des lieux</LinkButton>
            <LinkButton href={links.newLease()} variant="primary" icon={FilePlus}>Nouveau bail</LinkButton>
          </>
        }
      />

      {leases.isError ? <LoadError title="Les baux n’ont pas pu être chargés" /> : null}
      {nextNotice ? (
        <Alert tone="warning" title={`Bail de ${lookups.tenantsOf(nextNotice)}, fin le ${formatDateFr(departureOf(nextNotice))}`}>
          {`Préavis donné. Vérifier l’état des lieux de sortie.${notices.length > 1 ? ` ${String(notices.length - 1)} autre${notices.length > 2 ? 's' : ''} préavis en cours.` : ''}`}
          <div className="mt-1"><LinkButton href={bauxPaths.exit(nextNotice.id)} size="sm">Ouvrir</LinkButton></div>
        </Alert>
      ) : null}

      <Card role="region" aria-label="Liste des baux" className="gap-3">
        <Tabs value={view.tab} onValueChange={(value) => { view.setTab(value); setSelected([]); }} defaultValue="actifs">
          <TabList aria-label="Filtrer les baux">
            {tabs.map((tab) => (
              <Tab key={tab.id} value={tab.id} count={view.counts[tab.id] ?? 0}>{tab.label}</Tab>
            ))}
          </TabList>
          <TabPanel value={view.tab} className="flex flex-col gap-3 pt-1">
            <div className="flex flex-wrap items-center gap-2">
              <SearchInput label="Rechercher un bail" placeholder="Référence, bien, locataire" value={view.query} onValueChange={view.setQuery} />
              <Select
                label="Immeuble"
                hideLabel
                placeholder="Immeuble : Tous"
                value={building}
                onValueChange={(value) => { setBuilding(value); view.resetPage(); }}
                options={[{ value: ALL, label: 'Immeuble : Tous' }, ...buildings.map((entry) => ({ value: entry, label: entry }))]}
                className="w-52"
              />
              <Select label="Type" hideLabel placeholder="Type : Tous" value={kind} onValueChange={(value) => { setKind(value); view.resetPage(); }} options={TYPES} className="w-40" />
              <Select label="Solde" hideLabel placeholder="Solde : Tous" value={balance} onValueChange={(value) => { setBalance(value); view.resetPage(); }} options={BALANCES} className="w-40" />
              <Select label="Tri" hideLabel placeholder="Trier" value={sort} onValueChange={setSort} options={SORTS} className="w-56" />
              <div role="group" aria-label="Fin de bail" className="flex flex-wrap items-center gap-1.5">
                {WINDOWS.map((days) => (
                  <Chip key={days} pressed={window === days} onClick={() => { setWindow(window === days ? null : days); view.resetPage(); }}>
                    {`Fin dans ${String(days)} j`}
                  </Chip>
                ))}
              </div>
            </div>

            {visibleSelected.length > 0 ? (
              <div role="region" aria-label="Actions sur la sélection" className="flex flex-wrap items-center justify-between gap-2 rounded-md bg-action-subtle px-3 py-2 text-body text-action-on-subtle">
                <span>{`${String(visibleSelected.length)} ${visibleSelected.length > 1 ? 'baux sélectionnés' : 'bail sélectionné'}`}</span>
                <span className="flex flex-wrap items-center gap-2">
                  <Button
                    variant="secondary"
                    size="sm"
                    disabled={!selectedLeases.every((lease) => lease.status === 'en_cours' || lease.status === 'preavis')}
                    onClick={() => { push('/documents/avis-echeance'); }}
                  >
                    Envoyer un avis
                  </Button>
                  <Button variant="secondary" size="sm" onClick={() => { exportCsv(selectedLeases); }}>Exporter la sélection</Button>
                  <Button
                    variant="danger"
                    size="sm"
                    disabled={!selectedLeases.every((lease) => lease.status === 'brouillon')}
                    onClick={() => { setPendingDelete(selectedLeases); }}
                  >
                    Supprimer les brouillons
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => { setSelected([]); }}>Tout désélectionner</Button>
                </span>
              </div>
            ) : null}

            {leases.isPending ? <ListLoading label="Chargement des baux" /> : null}
            {leases.data && sorted.length === 0 ? (
              <EmptyState
                icon={FileStack}
                title="Aucun bail"
                description={view.query !== '' || filtered ? 'Aucun bail ne correspond à ces filtres.' : 'Rien à afficher dans cette rubrique pour le moment.'}
              >
                <LinkButton href={links.newLease()} variant="primary" icon={FilePlus}>Nouveau bail</LinkButton>
              </EmptyState>
            ) : null}
            {sorted.length > 0 ? (
              <Table aria-label="Baux">
                <TableHead>
                  <TableRow>
                    <TableHeaderCell className="w-8"><Checkbox label="Tout sélectionner" hideLabel checked={allSelected} onChange={toggleAll} /></TableHeaderCell>
                    <TableHeaderCell>Bien</TableHeaderCell>
                    <TableHeaderCell>Locataire</TableHeaderCell>
                    <TableHeaderCell>Type</TableHeaderCell>
                    <TableHeaderCell numeric>Loyer</TableHeaderCell>
                    <TableHeaderCell numeric>Charges</TableHeaderCell>
                    <TableHeaderCell numeric>Dépôt</TableHeaderCell>
                    <TableHeaderCell>Fin</TableHeaderCell>
                    <TableHeaderCell numeric>Solde</TableHeaderCell>
                    <TableHeaderCell>État</TableHeaderCell>
                    <TableHeaderCell><span className="sr-only">Actions</span></TableHeaderCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {sorted.map((lease) => (
                    <LeaseRow
                      key={lease.id}
                      lease={lease}
                      unit={lookups.unitShort(lease.unitId)}
                      tenants={lookups.tenantsOf(lease)}
                      checked={selected.includes(lease.id)}
                      onToggle={() => { toggle(lease.id); }}
                      actions={actionsFor(lease)}
                    />
                  ))}
                </TableBody>
              </Table>
            ) : null}
            <Pagination page={view.page} pageSize={view.pageSize} total={view.total} onPageChange={view.setPage} label="Pagination des baux" />
          </TabPanel>
        </Tabs>
      </Card>

      <ConfirmDialog
        open={pendingDelete.length > 0}
        onOpenChange={(open) => { if (!open) setPendingDelete([]); }}
        title={pendingDelete.length > 1 ? 'Supprimer ces brouillons ?' : 'Supprimer ce brouillon ?'}
        description="Les brouillons supprimés ne peuvent pas être récupérés. Un bail émis ne se supprime pas, il se résilie."
        confirmLabel="Supprimer"
        tone="danger"
        onConfirm={() => { void confirmDelete(); }}
      />
      <ReviseRentDialog lease={revising} onClose={() => { setRevising(null); }} />
    </>
  );
}
