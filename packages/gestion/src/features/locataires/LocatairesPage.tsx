'use client';

import {
  Archive,
  ArchiveRestore,
  BookOpen,
  CalendarPlus,
  FilePlus,
  FileText,
  Mail,
  MessageSquare,
  Pencil,
  Trash2,
  Wallet,
} from 'lucide-react';
import {
  Alert,
  Button,
  Card,
  ConfirmDialog,
  EmptyState,
  Pagination,
  SegmentedControl,
  Select,
  Tab,
  TabList,
  TabPanel,
  Tabs,
  cx,
} from '@eguardimmo/ui';
import { Users } from 'lucide-react';
import { useState } from 'react';
import { InviteTenantDialog } from './InviteTenantDialog';
import { TenantAvatar, TenantStateBadge, tenantKindLabel } from './TenantParts';
import { useArchiveTenant, useDeleteTenant, useInvitePortal, useTenants, useUnits } from './hooks';
import { ActionMenu, LinkButton, ListLoading, LoadError, PageHeader, SearchInput, errorMessage, useGestionNavigation, useNotify } from './kit';
import type { ActionItem } from './kit';
import { downloadCsv, toCsv } from './kit/csv';
import { daysBetween, todayIso } from './kit/dates';
import { links } from './kit/links';
import { money } from './kit/money';
import { fold, useListView } from './kit/useListView';
import type { ListTab } from './kit/useListView';
import { locatairesPaths } from './paths';
import { tenantNameOf, unitFullLabel } from './schemas';
import type { Tenant, Unit } from './schemas';

const ALL = 'tous';

const tabs: ListTab<Tenant>[] = [
  { id: 'suivre', label: 'À suivre', match: (tenant) => tenant.status === 'actif' && (tenant.state === 'retard' || tenant.state === 'preavis') },
  { id: 'tous', label: 'Tous', match: (tenant) => tenant.status !== 'archive' },
  { id: 'invitations', label: 'Invitations', match: (tenant) => tenant.status === 'invite' },
  { id: 'archives', label: 'Archivés', match: (tenant) => tenant.status === 'archive' },
];

const PAGE_SIZES = ['5', '10', '25'].map((size) => ({ value: size, label: size }));
const ROW_GRID = 'md:grid-cols-[minmax(0,2fr)_minmax(0,1.3fr)_88px_150px_160px]';

const typeOptions = [
  { value: ALL, label: 'Type : Tous' },
  { value: 'particulier', label: 'Particuliers' },
  { value: 'societe', label: 'Sociétés' },
];
const balanceOptions = [
  { value: ALL, label: 'Solde : Tous' },
  { value: 'du', label: 'Solde dû' },
  { value: 'solde', label: 'Compte soldé' },
];

type Confirmation = { kind: 'archive' | 'delete'; tenant: Tenant } | null;

export function LocatairesPage() {
  const tenants = useTenants();
  const units = useUnits();
  const { push } = useGestionNavigation();
  const notify = useNotify();
  const archive = useArchiveTenant();
  const remove = useDeleteTenant();
  const invitePortal = useInvitePortal();

  const [layout, setLayout] = useState('liste');
  const [type, setType] = useState(ALL);
  const [unitId, setUnitId] = useState(ALL);
  const [balance, setBalance] = useState(ALL);
  const [pageSize, setPageSize] = useState(10);
  const [showOthers, setShowOthers] = useState(false);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [confirmation, setConfirmation] = useState<Confirmation>(null);

  const items = tenants.data ?? [];
  const unitList = units.data ?? [];
  const unitOf = (tenant: Tenant): Unit | undefined => unitList.find((unit) => unit.id === tenant.unitId);
  const searchText = (tenant: Tenant) => `${tenantNameOf(tenant)} ${tenant.phone} ${tenant.email} ${unitOf(tenant)?.label ?? ''}`;
  const filter = (tenant: Tenant) =>
    (type === ALL || tenant.kind === type) &&
    (unitId === ALL || tenant.unitId === unitId) &&
    (balance === ALL || (balance === 'du' ? tenant.balance < 0 : tenant.balance === 0));

  const view = useListView({ items, tabs, searchText, predicate: filter, pageSize });
  const active = items.filter((tenant) => tenant.status !== 'archive');
  const toFollow = items.filter(tabs[0]?.match ?? (() => false));
  const worst = [...toFollow].filter((tenant) => tenant.state === 'retard').sort((a, b) => a.balance - b.balance)[0];
  const others = view.tab === 'suivre'
    ? items.filter((tenant) => tenant.status !== 'archive' && !(tabs[0]?.match(tenant) ?? false)).filter(filter).filter((tenant) => view.query === '' || fold(searchText(tenant)).includes(fold(view.query.trim())))
    : [];

  const run = async (task: () => Promise<unknown>, success: { title: string; description?: string }) => {
    try {
      await task();
      notify(success);
    } catch (error) {
      notify({ tone: 'danger', title: 'Action impossible', description: errorMessage(error) });
    }
  };

  const actionsFor = (tenant: Tenant): ActionItem[] => {
    const name = tenantNameOf(tenant);
    const archived = tenant.status === 'archive';
    return [
      { id: 'edit', label: 'Modifier', icon: Pencil, onSelect: () => { push(locatairesPaths.edit(tenant.id)); } },
      { id: 'sheet', label: 'Fiche locataire', icon: BookOpen, onSelect: () => { push(locatairesPaths.detail(tenant.id)); } },
      { id: 'message', label: 'Envoyer un message', icon: MessageSquare, onSelect: () => { push(links.newMessage(tenant.id)); } },
      {
        id: 'portal',
        label: 'Inviter sur le portail',
        icon: Mail,
        disabled: tenant.portalActive,
        onSelect: () => { void run(() => invitePortal.mutateAsync(tenant.id), { title: 'Invitation envoyée', description: `${name} recevra un lien à ${tenant.email}.` }); },
      },
      { id: 'lease', label: 'Créer un bail', icon: FilePlus, onSelect: () => { push(links.newLease({ locataire: tenant.id })); } },
      { id: 'appointment', label: 'Prendre rendez-vous', icon: CalendarPlus, onSelect: () => { push(links.agenda); } },
      { id: 'ledger', label: 'Situation du compte', icon: Wallet, onSelect: () => { push(links.ledger(tenant.id)); } },
      { id: 'letter', label: 'Générer un courrier', icon: FileText, onSelect: () => { push(links.newCourrier({ locataire: tenant.id })); } },
      archived
        ? {
            id: 'restore',
            label: 'Restaurer',
            icon: ArchiveRestore,
            separatorBefore: true,
            onSelect: () => { void run(() => archive.mutateAsync({ id: tenant.id, archived: false }), { title: 'Locataire restauré', description: name }); },
          }
        : { id: 'archive', label: 'Archiver', icon: Archive, separatorBefore: true, onSelect: () => { setConfirmation({ kind: 'archive', tenant }); } },
      { id: 'delete', label: 'Supprimer', icon: Trash2, tone: 'danger', onSelect: () => { setConfirmation({ kind: 'delete', tenant }); } },
    ];
  };

  const exportCsv = () => {
    const rows = items
      .filter((tenant) => tenant.status !== 'archive')
      .map((tenant) => [tenantNameOf(tenant), tenantKindLabel(tenant.kind), tenant.email, tenant.phone, unitOf(tenant)?.label ?? '', money(tenant.balance)]);
    downloadCsv('locataires.csv', toCsv(['Locataire', 'Type', 'E-mail', 'Téléphone', 'Bien', 'Solde'], rows));
    notify({ title: 'Export prêt', description: `${String(rows.length)} locataires exportés dans locataires.csv.` });
  };

  const confirm = async () => {
    if (!confirmation) return;
    const { kind, tenant } = confirmation;
    const name = tenantNameOf(tenant);
    setConfirmation(null);
    if (kind === 'archive') {
      await run(() => archive.mutateAsync({ id: tenant.id, archived: true }), { title: 'Locataire archivé', description: `${name} reste consultable dans l’onglet Archivés.` });
    } else {
      await run(() => remove.mutateAsync(tenant.id), { title: 'Locataire supprimé', description: name });
    }
  };

  const renderRow = (tenant: Tenant) => (
    <TenantRow key={tenant.id} tenant={tenant} unit={unitOf(tenant)} actions={actionsFor(tenant)} card={layout === 'cartes'} />
  );

  return (
    <>
      <PageHeader
        crumbs={[{ label: 'Accueil', href: links.home }, { label: 'Locataires' }]}
        title="Locataires"
        subtitle={
          tenants.data
            ? `${String(active.length)} locataires actifs. ${toFollow.length === 0 ? 'Aucun dossier ne demande d’action.' : toFollow.length === 1 ? 'Un dossier demande une action.' : `${String(toFollow.length)} dossiers demandent une action.`}`
            : ' '
        }
        actions={
          <>
            <Button variant="secondary" onClick={exportCsv} disabled={!tenants.data}>Exporter</Button>
            <LinkButton href={locatairesPaths.create}>Ajouter manuellement</LinkButton>
            <Button onClick={() => { setInviteOpen(true); }}>Inviter un locataire</Button>
          </>
        }
      />

      {tenants.isError ? <LoadError title="Les locataires n’ont pas pu être chargés" /> : null}
      {worst ? (
        <Alert tone="danger" title={`${tenantNameOf(worst)}, ${money(-worst.balance)} de loyer en retard${worst.lateSince ? ` depuis ${String(daysBetween(worst.lateSince, todayIso()))} jours` : ''}.`}>
          <div className="mt-1">
            <LinkButton href={links.newCourrier({ modele: 'relance-de-loyer-impaye', locataire: worst.id })} size="sm">
              Relancer
            </LinkButton>
          </div>
        </Alert>
      ) : null}

      <Card role="region" aria-label="Liste des locataires" className="gap-3">
        <Tabs value={view.tab} onValueChange={view.setTab} defaultValue="suivre">
          <TabList aria-label="Filtrer les locataires">
            {tabs.map((tab) => (
              <Tab key={tab.id} value={tab.id} count={view.counts[tab.id] ?? 0}>
                {tab.label}
              </Tab>
            ))}
          </TabList>
          <TabPanel value={view.tab} className="flex flex-col gap-3 pt-1">
            <div className="flex flex-wrap items-end justify-between gap-2">
              <div className="flex min-w-0 flex-1 flex-wrap items-end gap-2">
                <SearchInput label="Rechercher un locataire" placeholder="Nom, téléphone, bien" value={view.query} onValueChange={view.setQuery} />
                <Select label="Type" hideLabel placeholder="Type : Tous" value={type} onValueChange={(value) => { setType(value); view.resetPage(); }} options={typeOptions} className="w-40" />
                <Select
                  label="Bien"
                  hideLabel
                  placeholder="Bien : Tous"
                  value={unitId}
                  onValueChange={(value) => { setUnitId(value); view.resetPage(); }}
                  options={[{ value: ALL, label: 'Bien : Tous' }, ...unitList.map((unit) => ({ value: unit.id, label: unitFullLabel(unit) }))]}
                  className="w-48"
                />
                <Select label="Solde" hideLabel placeholder="Solde : Tous" value={balance} onValueChange={(value) => { setBalance(value); view.resetPage(); }} options={balanceOptions} className="w-40" />
              </div>
              <SegmentedControl
                label="Affichage"
                value={layout}
                onValueChange={setLayout}
                options={[{ value: 'liste', label: 'Liste' }, { value: 'cartes', label: 'Cartes' }]}
              />
            </div>

            {tenants.isPending ? <ListLoading label="Chargement des locataires" /> : null}
            {tenants.data && view.rows.length === 0 && others.length === 0 ? (
              <EmptyState
                icon={Users}
                title="Aucun locataire"
                description={view.query !== '' || type !== ALL || unitId !== ALL || balance !== ALL ? 'Aucun locataire ne correspond à ces filtres.' : 'Rien à afficher dans cette rubrique pour le moment.'}
              />
            ) : null}
            {view.rows.length > 0 && layout === 'liste' ? (
              <div aria-hidden="true" className={cx('hidden gap-x-3 border-b border-line pb-1 text-caption text-fg-subtle md:grid', ROW_GRID)}>
                <span>Locataire</span>
                <span>Bien</span>
                <span className="text-right">Solde</span>
                <span>État</span>
                <span />
              </div>
            ) : null}
            {view.rows.length > 0 ? (
              <ul className={cx(layout === 'cartes' ? 'grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3' : 'flex flex-col')}>{view.rows.map(renderRow)}</ul>
            ) : null}

            {view.tab === 'suivre' && tenants.data ? (
              <div className="flex flex-col gap-2 border-t border-line pt-2">
                <div className="flex flex-wrap items-center justify-between gap-2 text-body text-fg-muted">
                  <span>
                    Locataires à jour ({String(items.filter((tenant) => tenant.status === 'actif' && tenant.state === 'a_jour').length)}) et invitation en attente ({String(items.filter((tenant) => tenant.status === 'invite').length)})
                  </span>
                  <Button variant="link" size="sm" aria-expanded={showOthers} onClick={() => { setShowOthers((current) => !current); }}>
                    {showOthers ? 'Masquer' : 'Afficher'}
                  </Button>
                </div>
                {showOthers ? (
                  <ul className={cx(layout === 'cartes' ? 'grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3' : 'flex flex-col')}>{others.map(renderRow)}</ul>
                ) : null}
              </div>
            ) : null}

            <div className="flex flex-wrap items-end justify-between gap-3 border-t border-line pt-2">
              <Select
                label="Lignes par page"
                placeholder="10"
                value={String(pageSize)}
                onValueChange={(value) => { setPageSize(Number(value)); view.resetPage(); }}
                options={PAGE_SIZES}
                className="w-36"
              />
              <Pagination page={view.page} pageSize={view.pageSize} total={view.total} onPageChange={view.setPage} label="Pagination des locataires" className="min-w-full flex-1 border-t-0 pt-0 sm:min-w-0" />
            </div>
          </TabPanel>
        </Tabs>
      </Card>

      <InviteTenantDialog open={inviteOpen} onOpenChange={setInviteOpen} />
      <ConfirmDialog
        open={confirmation !== null}
        onOpenChange={(open) => { if (!open) setConfirmation(null); }}
        title={confirmation?.kind === 'delete' ? 'Supprimer ce locataire ?' : 'Archiver ce locataire ?'}
        description={
          confirmation?.kind === 'delete'
            ? `${tenantNameOf(confirmation.tenant)} sera supprimé définitivement. Cette action est refusée si le locataire a un historique.`
            : `${confirmation ? tenantNameOf(confirmation.tenant) : ''} ne sera plus proposé dans les listes actives. Son historique est conservé.`
        }
        confirmLabel={confirmation?.kind === 'delete' ? 'Supprimer' : 'Archiver'}
        tone={confirmation?.kind === 'delete' ? 'danger' : 'default'}
        onConfirm={() => { void confirm(); }}
      />
    </>
  );
}

function TenantRow({ tenant, unit, actions, card }: { tenant: Tenant; unit: Unit | undefined; actions: ActionItem[]; card: boolean }) {
  const { Link } = useGestionNavigation();
  const name = tenantNameOf(tenant);
  const late = tenant.state === 'retard';
  return (
    <li
      className={cx(
        'min-w-0',
        card
          ? 'flex flex-col gap-2 rounded-lg border border-line p-3'
          : 'grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 gap-y-1 border-t border-line py-2 first:border-t-0',
        !card && ROW_GRID,
      )}
    >
      <div className="flex min-w-0 items-center gap-2.5">
        <TenantAvatar tenant={tenant} />
        <div className="flex min-w-0 flex-col">
          <Link href={locatairesPaths.detail(tenant.id)} className="truncate text-body-strong text-fg hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus">
            {name}
          </Link>
          <span className="truncate text-caption text-fg-subtle">{`${tenantKindLabel(tenant.kind)} · ${tenant.phone || 'Téléphone non renseigné'} · ${tenant.email}`}</span>
        </div>
      </div>
      <span className={cx('truncate text-caption text-fg-muted', !card && 'order-3 col-span-2 md:order-none md:col-span-1')}>
        {unit ? unitFullLabel(unit) : 'Aucun bien'}
      </span>
      <span className={cx('text-body-strong tabular-nums md:text-right', tenant.balance < 0 ? 'text-fg-danger' : 'text-fg')}>{money(tenant.balance)}</span>
      <span className="justify-self-start"><TenantStateBadge state={tenant.state} /></span>
      <span className="flex items-center justify-end gap-1.5">
        {late ? (
          <LinkButton href={links.newCourrier({ modele: 'relance-de-loyer-impaye', locataire: tenant.id })} variant="primary" size="sm">Relancer</LinkButton>
        ) : (
          <LinkButton href={locatairesPaths.detail(tenant.id)} variant="ghost" size="sm">Ouvrir</LinkButton>
        )}
        <ActionMenu label={`Plus d’actions, ${name}`} items={actions} />
      </span>
    </li>
  );
}
