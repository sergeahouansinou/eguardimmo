'use client';

import { Badge, Button, Card, Icon, Select, Table, TableBody, TableCell, TableHead, TableHeaderCell, TableRow } from '@eguardimmo/ui';
import { Plus, Upload } from 'lucide-react';
import { useState } from 'react';
import { CursorPager, useCursorPages } from '../finances/rent/CursorPager';
import { LinkButton, ListLoading, NoRows, PageHeader, SearchInput, useGestionNavigation } from '../locataires/kit';
import { useOrgPropertyChoices, useOrgUnitChoices } from '../orgapi/hooks';
import { QueryState } from '../orgapi/QueryState';
import { ImportDialog } from './ImportDialog';
import { useContactCategories, useContacts, useContactsOfProperty, useDirectoryPermissions, useReloadDirectory } from './hooks';
import { kindLabel, statusLabel } from './labels';
import { CONTACT_KINDS, CONTACT_STATUSES } from './model';
import type { ContactQuery, ContactStatus } from './model';
import { ContactBadges, DirectoryGate, UnitCell, useDebouncedValue } from './parts';
import { directoryPaths } from './paths';

const ALL = '';
const SEARCH_DELAY_MS = 300;

export function ContactsPage() {
  return (
    <DirectoryGate need="read" title="Contacts">
      <ContactsContent />
    </DirectoryGate>
  );
}

function ContactsContent() {
  const permissions = useDirectoryPermissions();
  const pages = useCursorPages();
  const [search, setSearch] = useState('');
  const [categoryId, setCategoryId] = useState(ALL);
  const [kind, setKind] = useState(ALL);
  const [status, setStatus] = useState<ContactStatus>('active');
  const [propertyId, setPropertyId] = useState(ALL);
  const [unitId, setUnitId] = useState(ALL);
  const [importing, setImporting] = useState(false);
  const categories = useContactCategories();
  const properties = useOrgPropertyChoices();
  const units = useOrgUnitChoices(propertyId === ALL ? null : propertyId);
  const settledSearch = useDebouncedValue(search, SEARCH_DELAY_MS);

  const change = <T,>(setter: (value: T) => void) => (value: T) => {
    setter(value);
    pages.reset();
  };

  const query: ContactQuery = {
    cursor: pages.cursor,
    search: settledSearch,
    categoryId: categoryId === ALL ? null : categoryId,
    kind: CONTACT_KINDS.find((candidate) => candidate === kind) ?? null,
    status,
  };

  return (
    <>
      <PageHeader
        crumbs={[{ label: 'Accueil', href: directoryPaths.home }, { label: 'Contacts' }]}
        title="Contacts"
        subtitle="Artisans, syndics, assureurs et interlocuteurs de votre organisation."
        actions={
          permissions.write ? (
            <>
              <Button variant="secondary" onClick={() => { setImporting(true); }}>
                <Icon icon={Upload} />
                Importer un CSV
              </Button>
              <LinkButton href={directoryPaths.contactNew} variant="primary" icon={Plus}>Nouveau contact</LinkButton>
            </>
          ) : undefined
        }
      />
      <Card role="region" aria-label="Liste des contacts" className="gap-3">
        <div className="grid grid-cols-1 items-end gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {propertyId === ALL ? <SearchInput label="Rechercher un contact" placeholder="Nom, e-mail, téléphone…" value={search} onValueChange={change(setSearch)} /> : null}
          <Select
            label="Catégorie"
            placeholder="Toutes les catégories"
            options={[{ value: ALL, label: 'Toutes les catégories' }, ...(categories.data ?? []).map((category) => ({ value: category.id, label: category.label }))]}
            value={categoryId}
            onValueChange={change(setCategoryId)}
            disabled={propertyId !== ALL}
          />
          <Select label="Type" placeholder="Tous les types" options={[{ value: ALL, label: 'Tous les types' }, ...CONTACT_KINDS.map((value) => ({ value, label: kindLabel[value] }))]} value={kind} onValueChange={change(setKind)} disabled={propertyId !== ALL} />
          <Select label="Statut" placeholder="Actifs" options={CONTACT_STATUSES.map((value) => ({ value, label: statusLabel[value] }))} value={status} onValueChange={(value) => { change(setStatus)(CONTACT_STATUSES.find((candidate) => candidate === value) ?? 'active'); }} disabled={propertyId !== ALL} />
          <Select
            label="Bien"
            placeholder="Tous les biens"
            options={[{ value: ALL, label: 'Tous les biens' }, ...(properties.data ?? []).map((property) => ({ value: property.id, label: property.name }))]}
            value={propertyId}
            onValueChange={(value) => { setUnitId(ALL); change(setPropertyId)(value); }}
            searchable
          />
          {propertyId === ALL ? null : (
            <Select label="Lot" placeholder="Tout le bien" options={[{ value: ALL, label: 'Tout le bien' }, ...(units.data ?? []).map((unit) => ({ value: unit.id, label: unit.reference }))]} value={unitId} onValueChange={change(setUnitId)} />
          )}
        </div>
        {propertyId === ALL ? <ContactsTable query={query} pages={pages} /> : <PropertyContactsTable propertyId={propertyId} unitId={unitId === ALL ? null : unitId} pages={pages} />}
      </Card>
      <ImportDialog open={importing} onClose={() => { setImporting(false); }} />
    </>
  );
}

type Pages = ReturnType<typeof useCursorPages>;

function ContactsTable({ query, pages }: { query: ContactQuery; pages: Pages }) {
  const { Link } = useGestionNavigation();
  const contacts = useContacts(query);
  const reload = useReloadDirectory();
  if (contacts.isPending && !contacts.isError) return <ListLoading label="Chargement des contacts" />;
  if (contacts.data === undefined) return <QueryState query={contacts} label="Chargement des contacts" title="Impossible de charger les contacts" onRetry={reload} />;
  const filtered = query.search.trim() !== '' || query.categoryId !== null || query.kind !== null || query.status !== 'active';
  if (contacts.data.items.length === 0) return <NoRows>{pages.page > 1 || filtered ? 'Aucun contact ne correspond à ces filtres.' : 'Aucun contact pour le moment. Créez le premier ou importez un fichier CSV.'}</NoRows>;

  return (
    <>
      <Table aria-label="Contacts" scrollLabel="Contacts, défilement horizontal">
        <TableHead>
          <TableRow>
            <TableHeaderCell>Nom</TableHeaderCell>
            <TableHeaderCell>Type</TableHeaderCell>
            <TableHeaderCell>E-mail</TableHeaderCell>
            <TableHeaderCell>Téléphone</TableHeaderCell>
            <TableHeaderCell>Statut</TableHeaderCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {contacts.data.items.map((contact) => (
            <TableRow key={contact.id}>
              <TableCell>
                <Link href={directoryPaths.contact(contact.id)} className="font-medium text-action-on-subtle underline-offset-2 hover:underline">{contact.displayName}</Link>
              </TableCell>
              <TableCell>{kindLabel[contact.kind]}</TableCell>
              <TableCell>{contact.primaryEmail ?? '—'}</TableCell>
              <TableCell>{contact.primaryPhone ?? '—'}</TableCell>
              <TableCell>
                {contact.anonymized || contact.archivedAt !== null ? <ContactBadges anonymized={contact.anonymized} archived={contact.archivedAt !== null} /> : <Badge tone="success">Actif</Badge>}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
      <CursorPager pages={pages} nextCursor={contacts.data.nextCursor} label="Pagination des contacts" />
    </>
  );
}

function PropertyContactsTable({ propertyId, unitId, pages }: { propertyId: string; unitId: string | null; pages: Pages }) {
  const { Link } = useGestionNavigation();
  const links = useContactsOfProperty(propertyId, unitId, pages.cursor);
  const reload = useReloadDirectory();
  if (links.isPending && !links.isError) return <ListLoading label="Chargement des contacts du bien" />;
  if (links.data === undefined) return <QueryState query={links} label="Chargement des contacts du bien" title="Impossible de charger les contacts du bien" onRetry={reload} />;
  if (links.data.items.length === 0) return <NoRows>Aucun contact n’est rattaché à ce bien. Rattachez-en depuis la fiche d’un contact.</NoRows>;
  return (
    <>
      <Table aria-label="Contacts du bien" scrollLabel="Contacts du bien, défilement horizontal">
        <TableHead>
          <TableRow>
            <TableHeaderCell>Nom</TableHeaderCell>
            <TableHeaderCell>Rôle sur ce bien</TableHeaderCell>
            <TableHeaderCell>Lot</TableHeaderCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {links.data.items.map((link) => (
            <TableRow key={link.id}>
              <TableCell>
                <Link href={directoryPaths.contact(link.party.id)} className="font-medium text-action-on-subtle underline-offset-2 hover:underline">{link.party.displayName}</Link>
              </TableCell>
              <TableCell>{link.category?.label ?? '—'}</TableCell>
              <TableCell><UnitCell link={link} /></TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
      <CursorPager pages={pages} nextCursor={links.data.nextCursor} label="Pagination des contacts du bien" />
    </>
  );
}
