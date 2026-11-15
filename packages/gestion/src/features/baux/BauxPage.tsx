'use client';

import { Banknote, CalendarClock, ClipboardCheck, Copy, FilePen, FilePlus, FileText, LogOut, Pencil, Receipt, Trash2, TrendingUp } from 'lucide-react';
import {
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
  TableCell,
  TableHead,
  TableHeaderCell,
  TableRow,
  Tabs,
} from '@eguardimmo/ui';
import { FileStack } from 'lucide-react';
import { useState } from 'react';
import { ReviseRentDialog } from './ReviseRentDialog';
import { LeaseStatusBadge, leasePeriod, useLeaseLookups } from './BauxParts';
import { useDeleteLease, useDuplicateLease, useLeases } from './hooks';
import { bauxPaths } from './paths';
import type { Lease } from './schemas';
import { ActionMenu, LinkButton, ListLoading, LoadError, PageHeader, SearchInput, errorMessage, useGestionNavigation, useNotify } from '../locataires/kit';
import type { ActionItem } from '../locataires/kit';
import { downloadCsv, toCsv } from '../locataires/kit/csv';
import { daysBetween, formatDateFr, todayIso } from '../locataires/kit/dates';
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

export function BauxPage() {
  const leases = useLeases();
  const lookups = useLeaseLookups();
  const { push } = useGestionNavigation();
  const notify = useNotify();
  const duplicate = useDuplicateLease();
  const remove = useDeleteLease();

  const [sort, setSort] = useState('fin');
  const [window, setWindow] = useState<number | null>(null);
  const [selected, setSelected] = useState<readonly string[]>([]);
  const [pendingDelete, setPendingDelete] = useState<readonly Lease[]>([]);
  const [revising, setRevising] = useState<Lease | null>(null);

  const items = leases.data ?? [];
  const today = todayIso();
  const endingWithin = (lease: Lease, days: number) => lease.status !== 'termine' && lease.status !== 'brouillon' && lease.end >= today && daysBetween(today, lease.end) <= days;
  const searchText = (lease: Lease) => `${lease.reference} ${lookups.unitLabel(lease.unitId)} ${lookups.tenantsOf(lease)}`;
  const view = useListView({ items, tabs, searchText, predicate: (lease) => window === null || endingWithin(lease, window) });

  const sorted = [...view.rows].sort((a, b) => {
    if (sort === 'loyer') return b.rent - a.rent;
    if (sort === 'debut') return b.start.localeCompare(a.start);
    if (sort === 'bien') return lookups.unitLabel(a.unitId).localeCompare(lookups.unitLabel(b.unitId), 'fr');
    return a.end.localeCompare(b.end);
  });

  const active = items.filter((lease) => lease.status === 'en_cours' || lease.status === 'preavis');
  const monthlyRent = active.reduce((sum, lease) => sum + lease.rent + lease.charges, 0);
  const visibleSelected = selected.filter((id) => sorted.some((lease) => lease.id === id));
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
            ? `${String(active.length)} baux en cours, ${money(monthlyRent)} appelés par mois, charges comprises.`
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
                <span>{`${String(visibleSelected.length)} sélectionné${visibleSelected.length > 1 ? 's' : ''}`}</span>
                <span className="flex flex-wrap items-center gap-2">
                  <Button variant="secondary" size="sm" onClick={() => { exportCsv(items.filter((lease) => visibleSelected.includes(lease.id))); }}>Exporter la sélection</Button>
                  <Button
                    variant="danger"
                    size="sm"
                    disabled={!items.filter((lease) => visibleSelected.includes(lease.id)).every((lease) => lease.status === 'brouillon')}
                    onClick={() => { setPendingDelete(items.filter((lease) => visibleSelected.includes(lease.id))); }}
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
                description={view.query !== '' || window !== null ? 'Aucun bail ne correspond à ces filtres.' : 'Rien à afficher dans cette rubrique pour le moment.'}
              >
                <LinkButton href={links.newLease()} variant="primary" icon={FilePlus}>Nouveau bail</LinkButton>
              </EmptyState>
            ) : null}
            {sorted.length > 0 ? (
              <Table aria-label="Baux">
                <TableHead>
                  <TableRow>
                    <TableHeaderCell className="w-8"><Checkbox label="Tout sélectionner" hideLabel checked={allSelected} onChange={toggleAll} /></TableHeaderCell>
                    <TableHeaderCell>Bail</TableHeaderCell>
                    <TableHeaderCell>Locataires</TableHeaderCell>
                    <TableHeaderCell>Période</TableHeaderCell>
                    <TableHeaderCell numeric>Loyer</TableHeaderCell>
                    <TableHeaderCell>Statut</TableHeaderCell>
                    <TableHeaderCell><span className="sr-only">Actions</span></TableHeaderCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {sorted.map((lease) => (
                    <LeaseRow
                      key={lease.id}
                      lease={lease}
                      unit={lookups.unitLabel(lease.unitId)}
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

function LeaseRow({
  lease,
  unit,
  tenants,
  checked,
  onToggle,
  actions,
}: {
  lease: Lease;
  unit: string;
  tenants: string;
  checked: boolean;
  onToggle: () => void;
  actions: ActionItem[];
}) {
  const { Link } = useGestionNavigation();
  return (
    <TableRow selected={checked}>
      <TableCell><Checkbox label={`Sélectionner ${lease.reference}`} hideLabel checked={checked} onChange={onToggle} /></TableCell>
      <TableCell strong>
        <Link href={bauxPaths.detail(lease.id)} className="text-fg hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus">
          {lease.reference}
        </Link>
        <span className="block text-caption font-normal text-fg-subtle">{unit}</span>
      </TableCell>
      <TableCell>{tenants}</TableCell>
      <TableCell>{leasePeriod(lease)}</TableCell>
      <TableCell numeric>{money(lease.rent + lease.charges)}</TableCell>
      <TableCell><LeaseStatusBadge status={lease.status} /></TableCell>
      <TableCell><ActionMenu label={`Plus d’actions, bail ${lease.reference}`} items={actions} /></TableCell>
    </TableRow>
  );
}
