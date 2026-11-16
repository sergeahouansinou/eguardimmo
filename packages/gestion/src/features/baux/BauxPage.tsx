'use client';

import { Archive, ArchiveRestore, Banknote, CalendarClock, ClipboardCheck, Copy, FilePen, FilePlus, FileText, LogOut, Pencil, Receipt, RefreshCw, Trash2, TrendingUp } from 'lucide-react';
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
import { useCourriersUnavailable } from '../courriers/FeatureGate';
import { ReviseRentDialog } from './ReviseRentDialog';
import { useLeaseLookups } from './BauxParts';
import { useFeatureUnavailable } from './FeatureGate';
import { LeaseImportDialog } from './LeaseImportDialog';
import { LeaseRow } from './LeaseRow';
import { useArchiveLease, useDeleteLease, useDuplicateLease, useExits, useLeases, useRenewLease } from './hooks';
import { ALL, BALANCES, SORTS, SOON_DAYS, TYPES, WINDOWS, tabs } from './bauxListConfig';
import { isArchivable, isRunningLease } from './leaseRules';
import { bauxPaths } from './paths';
import { courriersPaths } from '../courriers/paths';
import type { Lease } from './schemas';
import { LinkButton, ListLoading, LoadError, PageHeader, SearchInput, errorMessage, useGestionNavigation, useNotify } from '../locataires/kit';
import type { ActionItem } from '../locataires/kit';
import { downloadCsv, toCsv } from '../locataires/kit/csv';
import { daysBetween, formatDateFr, todayIso } from '../locataires/kit/dates';
import { links } from '../locataires/kit/links';
import { money } from '../locataires/kit/money';
import { useListView } from '../locataires/kit/useListView';

export function BauxPage() {
  const leases = useLeases();
  const lookups = useLeaseLookups();
  const { push } = useGestionNavigation();
  const notify = useNotify();
  const duplicate = useDuplicateLease();
  const remove = useDeleteLease();
  const archive = useArchiveLease();
  const renew = useRenewLease();
  const exits = useExits();
  const courriersOff = useCourriersUnavailable();
  const balanceOff = useFeatureUnavailable('balance');
  const importOff = useFeatureUnavailable('import');

  const [building, setBuilding] = useState(ALL);
  const [kind, setKind] = useState(ALL);
  const [balance, setBalance] = useState(ALL);
  const [sort, setSort] = useState('fin');
  const [window, setWindow] = useState<number | null>(null);
  const [selected, setSelected] = useState<readonly string[]>([]);
  const [pendingDelete, setPendingDelete] = useState<readonly Lease[]>([]);
  const [revising, setRevising] = useState<Lease | null>(null);
  const [pendingArchive, setPendingArchive] = useState<Lease | null>(null);
  const [pendingRenew, setPendingRenew] = useState<Lease | null>(null);
  const [importing, setImporting] = useState(false);

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
      (balanceOff || balance === ALL || (balance === 'impayes') === (lease.balance < 0)),
  });
  const filtered = window !== null || building !== ALL || kind !== ALL || (!balanceOff && balance !== ALL);

  const compare = (a: Lease, b: Lease) => {
    if (sort === 'loyer') return b.rent - a.rent;
    if (sort === 'debut') return b.start.localeCompare(a.start);
    if (sort === 'bien') return lookups.unitLabel(a.unitId).localeCompare(lookups.unitLabel(b.unitId), 'fr');
    return a.end.localeCompare(b.end);
  };
  const sorted = [...view.rows].sort(compare);
  const exportable = view.filtered.filter((lease) => lease.unsupported === undefined).sort(compare);

  const active = items.filter((lease) => isRunningLease(lease) && lease.unsupported === undefined);
  const monthlyRent = active.reduce((sum, lease) => sum + lease.rent + lease.charges, 0);
  const endingSoon = active.filter((lease) => endingWithin(lease, SOON_DAYS)).length;
  const departureOf = (lease: Lease) => exits.data?.find((entry) => entry.leaseId === lease.id)?.departure ?? lease.end;
  const notices = items.filter((lease) => !lease.archived && lease.status === 'preavis').sort((a, b) => departureOf(a).localeCompare(departureOf(b)));
  const nextNotice = notices[0];
  const visibleSelected = selected.filter((id) => sorted.some((lease) => lease.id === id));
  const selectedLeases = items.filter((lease) => visibleSelected.includes(lease.id));
  const selectable = sorted.filter((lease) => lease.unsupported === undefined);
  const allSelected = selectable.length > 0 && selectable.every((lease) => selected.includes(lease.id));

  const toggle = (id: string) => { setSelected((current) => (current.includes(id) ? current.filter((entry) => entry !== id) : [...current, id])); };
  const toggleAll = () => { setSelected(allSelected ? [] : selectable.map((lease) => lease.id)); };

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

  const confirmRenew = async () => {
    const target = pendingRenew;
    setPendingRenew(null);
    if (!target) return;
    try {
      const renewed = await renew.mutateAsync(target.id);
      notify({ title: 'Bail renouvelé', description: `${target.reference} court maintenant jusqu’au ${formatDateFr(renewed.end)}.` });
    } catch (error) {
      notify({ tone: 'danger', title: 'Renouvellement impossible', description: errorMessage(error) });
    }
  };

  const confirmArchive = async () => {
    const target = pendingArchive;
    setPendingArchive(null);
    if (!target) return;
    try {
      await archive.mutateAsync({ id: target.id, archived: true });
      setSelected((current) => current.filter((id) => id !== target.id));
      notify({ title: 'Bail archivé', description: `${target.reference} reste consultable dans l’onglet Archivés.` });
    } catch (error) {
      notify({ tone: 'danger', title: 'Archivage impossible', description: errorMessage(error) });
    }
  };

  const restore = (lease: Lease) => {
    void archive.mutateAsync({ id: lease.id, archived: false }).then(
      () => { notify({ title: 'Bail désarchivé', description: lease.reference }); },
      (error: unknown) => { notify({ tone: 'danger', title: 'Désarchivage impossible', description: errorMessage(error) }); },
    );
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
      ...(courriersOff
        ? []
        : [
            { id: 'receipt', label: 'Quittances', icon: Receipt, disabled: lease.status === 'brouillon' || lease.status === 'a_venir', onSelect: () => { push(courriersPaths.quittances); } },
            { id: 'notice', label: 'Avis d’échéance', icon: Receipt, disabled: lease.status === 'brouillon' || lease.status === 'a_venir', onSelect: () => { push(courriersPaths.notices); } },
          ]),
      { id: 'revise', label: 'Réviser le loyer', icon: TrendingUp, disabled: lease.status === 'termine' || lease.status === 'brouillon', onSelect: () => { setRevising(lease); } },
      {
        id: 'renew',
        label: 'Renouveler',
        icon: RefreshCw,
        disabled: lease.status !== 'en_cours',
        onSelect: () => { setPendingRenew(lease); },
      },
      { id: 'edl', label: 'État des lieux', icon: ClipboardCheck, disabled: lease.status === 'brouillon', onSelect: () => { push(`${bauxPaths.newEdl}?bien=${lease.unitId}`); } },
      ...(courriersOff ? [] : [{ id: 'letter', label: 'Générer un courrier', icon: FilePen, onSelect: () => { push(links.newCourrier({ bien: lease.unitId, locataire: lease.tenantIds[0] })); } }]),
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
      lease.archived
        ? { id: 'archive', label: 'Désarchiver', icon: ArchiveRestore, separatorBefore: true, onSelect: () => { restore(lease); } }
        : {
            id: 'archive',
            label: isArchivable(lease) ? 'Archiver' : 'Archiver (bail terminé ou brouillon uniquement)',
            icon: Archive,
            separatorBefore: true,
            disabled: !isArchivable(lease),
            onSelect: () => { setPendingArchive(lease); },
          },
      { id: 'delete', label: 'Supprimer le brouillon', icon: Trash2, tone: 'danger', disabled: lease.status !== 'brouillon' || lease.archived, onSelect: () => { setPendingDelete([lease]); } },
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
            {importOff ? null : <Button variant="secondary" onClick={() => { setImporting(true); }}>Importer</Button>}
            <Button variant="secondary" onClick={() => { exportCsv(exportable); }} disabled={!leases.data}>Exporter</Button>
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
              {balanceOff ? null : <Select label="Solde" hideLabel placeholder="Solde : Tous" value={balance} onValueChange={(value) => { setBalance(value); view.resetPage(); }} options={BALANCES} className="w-40" />}
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
                  {courriersOff ? null : (
                    <Button
                      variant="secondary"
                      size="sm"
                      disabled={!selectedLeases.every((lease) => lease.status === 'en_cours' || lease.status === 'preavis')}
                      onClick={() => { push(courriersPaths.notices); }}
                    >
                      Envoyer un avis
                    </Button>
                  )}
                  <Button variant="secondary" size="sm" onClick={() => { exportCsv(selectedLeases); }}>Exporter la sélection</Button>
                  <Button
                    variant="danger"
                    size="sm"
                    disabled={!selectedLeases.every((lease) => lease.status === 'brouillon' && !lease.archived)}
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
                    {balanceOff ? null : <TableHeaderCell numeric>Solde</TableHeaderCell>}
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
      <ConfirmDialog
        open={pendingArchive !== null}
        onOpenChange={(open) => { if (!open) setPendingArchive(null); }}
        title="Archiver ce bail ?"
        description={pendingArchive ? `Le bail ${pendingArchive.reference} sort des onglets courants. Rien n’est supprimé : il reste consultable dans l’onglet Archivés et peut être désarchivé.` : ''}
        confirmLabel="Archiver"
        onConfirm={() => { void confirmArchive(); }}
      />
      <ConfirmDialog
        open={pendingRenew !== null}
        onOpenChange={(open) => { if (!open) setPendingRenew(null); }}
        title="Renouveler ce bail ?"
        description={pendingRenew ? `Le terme du bail ${pendingRenew.reference} sera prolongé d’une nouvelle période. Le serveur refuse le renouvellement si le terme n’est pas atteint pour un bail reconduit tacitement, ou si un préavis est enregistré.` : ''}
        confirmLabel="Renouveler"
        onConfirm={() => { void confirmRenew(); }}
      />
      <ReviseRentDialog lease={revising} onClose={() => { setRevising(null); }} />
      {importOff ? null : <LeaseImportDialog open={importing} onOpenChange={setImporting} />}
    </>
  );
}
