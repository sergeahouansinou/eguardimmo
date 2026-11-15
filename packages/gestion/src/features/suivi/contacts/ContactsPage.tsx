'use client';

import { useState } from 'react';
import { Archive, ArchiveRestore, Eye, EyeOff, Mail, Phone, Share2, Trash2, Wrench } from 'lucide-react';
import { Avatar, Badge, Button, Card, Tab, TabList, TabPanel, Tabs, TextField } from '@eguardimmo/ui';
import {
  ConfirmDialog,
  DataTable,
  EmptyBlock,
  FilterChip,
  PageHeader,
  pushFlash,
  QueryState,
  SortTh,
  Td,
  Th,
  useSourceMutation,
} from '../../outils/kit';
import type { ScreenProps } from '../../outils/kit';
import { ALL, bienOptions } from '../shared/biens';
import { openExternal } from '../shared/external';
import { usePaging } from '../shared/paging';
import { nextSort, sortItems } from '../shared/sort';
import type { SortState } from '../shared/sort';
import { matchesQuery } from '../shared/text';
import { FilterSelect, Notice, PaginationBar, RowMenu, Toolbar } from '../shared/ui';
import type { RowAction } from '../shared/ui';
import { biensLabel, compareContacts, initialsOf, matchesBienFilter } from './logic';
import type { SortKey } from './logic';
import { CATEGORIES, categoryTabLabels, categoryText } from './schemas';
import type { Category, Contact } from './schemas';
import { CONTACTS_KEY, useContacts, useContactsSource } from './source';

type TabKey = 'tous' | Category | 'archives';
type ShareFilter = 'tous' | 'partage' | 'prive';

export function ContactsPage({ Link, navigate }: ScreenProps) {
  const query = useContacts();
  const source = useContactsSource();
  const [tab, setTab] = useState<TabKey>('tous');
  const [search, setSearch] = useState('');
  const [bien, setBien] = useState(ALL);
  const [share, setShare] = useState<ShareFilter>('tous');
  const [sort, setSort] = useState<SortState<SortKey>>({ key: null, direction: 'asc' });
  const [toDelete, setToDelete] = useState<Contact | null>(null);
  const [error, setError] = useState<string | null>(null);

  const invalidate = [CONTACTS_KEY] as const;
  const setShared = useSourceMutation((input: { id: string; shared: boolean }) => source.setShared(input.id, input.shared), invalidate);
  const setArchived = useSourceMutation((input: { id: string; archived: boolean }) => source.setArchived(input.id, input.archived), invalidate);
  const remove = useSourceMutation((id: string) => source.remove(id), invalidate);
  const fail = () => { setError('L’action n’a pas abouti. Réessayez dans un instant.'); };

  const all = query.data ?? [];
  const active = all.filter((contact) => !contact.archived);
  const countOf = (category: Category) => active.filter((contact) => contact.category === category).length;
  const filtered = all.filter((contact) => {
    if (tab === 'archives' ? !contact.archived : contact.archived) return false;
    if (tab !== 'tous' && tab !== 'archives' && contact.category !== tab) return false;
    if (!matchesQuery(search, contact.name, contact.subtitle, contact.phone, contact.email)) return false;
    if (!matchesBienFilter(contact, bien)) return false;
    if (share === 'partage' && !contact.shared) return false;
    if (share === 'prive' && contact.shared) return false;
    return true;
  });
  const ordered = sortItems(filtered, sort, compareContacts);
  const paging = usePaging(ordered, 5);
  const filtering = search !== '' || bien !== ALL || share !== 'tous';

  const touch = <T,>(setter: (value: T) => void) => (value: T) => {
    setter(value);
    paging.reset();
  };
  const toggleShare = (contact: Contact) => {
    setShared.mutate(
      { id: contact.id, shared: !contact.shared },
      {
        onSuccess: () => { pushFlash(contact.shared ? `« ${contact.name} » est maintenant privé.` : `« ${contact.name} » est maintenant partagé avec les locataires du bien.`); },
        onError: fail,
      },
    );
  };
  const archive = (contact: Contact) => {
    setArchived.mutate(
      { id: contact.id, archived: !contact.archived },
      {
        onSuccess: () => { pushFlash(contact.archived ? `« ${contact.name} » est de retour dans le carnet.` : `« ${contact.name} » a été archivé.`); },
        onError: fail,
      },
    );
  };
  const sortHeader = (key: SortKey, label: string) => (
    <SortTh
      label={label}
      active={sort.key === key}
      direction={sort.direction}
      onSort={() => {
        setSort(nextSort(sort, key));
        paging.reset();
      }}
    />
  );
  const sharePressed = (value: ShareFilter) => share === value;
  const toggleShareFilter = (value: ShareFilter) => (pressed: boolean) => {
    setShare(pressed ? value : 'tous');
    paging.reset();
  };

  const actionsFor = (contact: Contact): RowAction[] => {
    const actions: RowAction[] = [];
    if (contact.phone !== '') actions.push({ id: 'call', label: 'Appeler', icon: Phone, onSelect: () => { openExternal(`tel:${contact.phone.replace(/[^+\d]/g, '')}`); } });
    if (contact.email !== '') actions.push({ id: 'mail', label: 'Envoyer un e-mail', icon: Mail, onSelect: () => { openExternal(`mailto:${contact.email}`); } });
    actions.push({
      id: 'share',
      label: contact.shared ? 'Rendre privé' : 'Partager avec les locataires',
      icon: contact.shared ? EyeOff : Share2,
      onSelect: () => { toggleShare(contact); },
    });
    actions.push({ id: 'intervention', label: 'Créer une intervention', icon: Wrench, onSelect: () => { navigate('/interventions/nouvelle'); } });
    actions.push({
      id: 'archive',
      label: contact.archived ? 'Désarchiver' : 'Archiver',
      icon: contact.archived ? ArchiveRestore : Archive,
      separatorBefore: true,
      onSelect: () => { archive(contact); },
    });
    actions.push({ id: 'delete', label: 'Supprimer', icon: Trash2, tone: 'danger', onSelect: () => { setToDelete(contact); } });
    return actions;
  };

  return (
    <>
      <PageHeader
        Link={Link}
        crumbs={[{ label: 'Outils' }, { label: 'Carnet de contacts' }]}
        title="Carnet de contacts"
        description="Artisans, syndics, assureurs et garants. Un contact partagé est visible par les locataires du bien."
        actions={
          <Button asChild>
            <Link href="/contacts/nouveau">Nouveau contact</Link>
          </Button>
        }
      />
      <Notice tone="danger" message={error} onDismiss={() => { setError(null); }} />
      <Card role="region" aria-label="Liste des contacts">
        <Tabs
          value={tab}
          defaultValue="tous"
          onValueChange={(value) => {
            setTab(CATEGORIES.find((category) => category === value) ?? (value === 'archives' ? 'archives' : 'tous'));
            paging.reset();
          }}
        >
          <TabList aria-label="Catégories de contacts">
            <Tab value="tous" count={query.data ? active.length : undefined}>Tous</Tab>
            {CATEGORIES.map((category) => (
              <Tab key={category} value={category} count={query.data ? countOf(category) : undefined}>{categoryTabLabels[category]}</Tab>
            ))}
            <Tab value="archives">Archives</Tab>
          </TabList>
          <TabPanel value={tab} className="flex flex-col gap-2">
            <Toolbar>
              <div className="w-full sm:w-60">
                <TextField
                  label="Rechercher"
                  hideLabel
                  placeholder="Nom, téléphone, e-mail"
                  type="search"
                  value={search}
                  onChange={(event) => { touch(setSearch)(event.target.value); }}
                />
              </div>
              <FilterSelect label="Bien" allLabel="Bien : Tous" options={bienOptions('short')} value={bien} onValueChange={touch(setBien)} />
              <div className="flex flex-wrap gap-1.5 pb-0.5" role="group" aria-label="Filtrer par partage">
                <FilterChip pressed={sharePressed('partage')} onPressedChange={toggleShareFilter('partage')}>Partagé</FilterChip>
                <FilterChip pressed={sharePressed('prive')} onPressedChange={toggleShareFilter('prive')}>Privé</FilterChip>
              </div>
            </Toolbar>
            <QueryState query={query} errorTitle="Les contacts n’ont pas pu être chargés" loadingLabel="Chargement des contacts">
              {() =>
                ordered.length === 0 ? (
                  <EmptyBlock
                    title={filtering ? 'Aucun contact ne correspond' : tab === 'archives' ? 'Aucun contact archivé' : 'Aucun contact dans cette catégorie'}
                    action={
                      filtering ? (
                        <Button
                          variant="secondary"
                          size="sm"
                          onClick={() => {
                            setSearch('');
                            setBien(ALL);
                            setShare('tous');
                            paging.reset();
                          }}
                        >
                          Réinitialiser les filtres
                        </Button>
                      ) : tab !== 'archives' ? (
                        <Button size="sm" asChild><Link href="/contacts/nouveau">Nouveau contact</Link></Button>
                      ) : undefined
                    }
                  >
                    {filtering ? 'Modifiez la recherche ou les filtres.' : 'Ajoutez les artisans, syndics, assureurs et garants que vous sollicitez.'}
                  </EmptyBlock>
                ) : (
                  <>
                    <DataTable caption="Carnet de contacts">
                      <thead>
                        <tr>
                          {sortHeader('name', 'Nom')}
                          {sortHeader('category', 'Catégorie')}
                          <Th>Téléphone</Th>
                          <Th>E-mail</Th>
                          <Th>Biens</Th>
                          <Th>Partage</Th>
                          <Th><span className="sr-only">Actions</span></Th>
                        </tr>
                      </thead>
                      <tbody>
                        {paging.pageItems.map((contact) => (
                          <tr key={contact.id}>
                            <Td>
                              <span className="flex items-center gap-2">
                                <Avatar initials={initialsOf(contact.name)} size="md" />
                                <span className="flex flex-col">
                                  <span className="font-medium text-fg">{contact.name}</span>
                                  <span className="text-caption text-fg-subtle">{contact.subtitle}</span>
                                </span>
                              </span>
                            </Td>
                            <Td>{categoryText(contact)}</Td>
                            <Td>{contact.phone === '' ? '—' : contact.phone}</Td>
                            <Td>{contact.email === '' ? '—' : contact.email}</Td>
                            <Td>{biensLabel(contact)}</Td>
                            <Td>
                              <Badge tone={contact.shared ? 'info' : 'neutral'}>
                                {contact.shared ? <Eye size={12} aria-hidden="true" /> : null}
                                {contact.shared ? 'Partagé' : 'Privé'}
                              </Badge>
                            </Td>
                            <Td>
                              <span className="flex items-center justify-end gap-1">
                                <Button variant="link" size="sm" asChild>
                                  <Link href={`/contacts/${contact.id}`} aria-label={`Ouvrir ${contact.name}`}>Ouvrir</Link>
                                </Button>
                                <RowMenu label={`Plus d’actions, ${contact.name}`} actions={actionsFor(contact)} />
                              </span>
                            </Td>
                          </tr>
                        ))}
                      </tbody>
                    </DataTable>
                    <PaginationBar paging={paging} label="Pagination des contacts" />
                  </>
                )
              }
            </QueryState>
          </TabPanel>
        </Tabs>
      </Card>
      <ConfirmDialog
        open={toDelete !== null}
        onOpenChange={(open) => { if (!open) setToDelete(null); }}
        title="Supprimer ce contact ?"
        description={toDelete ? `« ${toDelete.name} » sera retiré du carnet définitivement. Pour le conserver, archivez-le plutôt.` : ''}
        confirmLabel="Supprimer"
        pending={remove.isPending}
        onConfirm={() => {
          if (!toDelete) return;
          remove.mutate(toDelete.id, {
            onSuccess: () => {
              pushFlash(`Contact « ${toDelete.name} » supprimé.`);
              setToDelete(null);
            },
            onError: () => {
              setToDelete(null);
              fail();
            },
          });
        }}
      />
    </>
  );
}
