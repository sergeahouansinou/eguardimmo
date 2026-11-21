'use client';

import { Alert, Button, EmptyState } from '@eguardimmo/ui';
import { UserSearch } from 'lucide-react';
import { useState } from 'react';
import { useDebounced } from '../../finances/invoicing/useDebounced';
import { ListLoading, LoadError, PageHeader, SearchInput, SectionCard } from '../kit';
import { links } from '../kit/links';
import { locatairesPaths } from '../paths';
import { AccessCard } from './AccessCard';
import { useTenantAccessPermissions, useTenantSearch } from './hooks';
import type { TenantChoice } from './model';

const SEARCH_DELAY_MS = 250;

export function InvitationPage() {
  const permissions = useTenantAccessPermissions();
  const [term, setTerm] = useState('');
  const [selected, setSelected] = useState<TenantChoice | null>(null);
  const search = useTenantSearch(useDebounced(term, SEARCH_DELAY_MS));
  const rows = search.data ?? [];

  return (
    <>
      <PageHeader
        crumbs={[{ label: 'Accueil', href: links.home }, { label: 'Locataires', href: locatairesPaths.list }, { label: 'Invitation' }]}
        title="Inviter un locataire"
        subtitle="Donnez accès à l’espace locataire à un contact enregistré, suivez son invitation ou révoquez son accès."
      />
      {permissions.manage ? (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <SectionCard id="recherche-locataire" title="Contacts">
            <SearchInput label="Rechercher un contact" placeholder="Rechercher par nom ou e-mail" value={term} onValueChange={setTerm} />
            {search.isError ? <LoadError title={search.error?.message ?? 'Les contacts n’ont pas pu être chargés'} /> : null}
            {search.isPending && !search.isError ? <ListLoading label="Chargement des contacts" /> : null}
            {search.data && rows.length === 0 ? (
              <EmptyState icon={UserSearch} title="Aucun contact" description={term === '' ? 'Aucune personne n’est enregistrée dans votre organisation.' : 'Aucune personne ne correspond à cette recherche.'} />
            ) : null}
            {rows.length > 0 ? (
              <ul aria-label="Contacts" className="flex flex-col">
                {rows.map((tenant) => (
                  <li key={tenant.id} className="flex min-h-12 items-center gap-2.5 border-t border-line py-1.5 first:border-t-0">
                    <span className="flex min-w-0 flex-1 flex-col">
                      <b className="truncate text-body-strong text-fg">{tenant.name}</b>
                      <span className="truncate text-caption text-fg-subtle">{tenant.email ?? 'Aucun e-mail principal'}</span>
                    </span>
                    <Button variant={selected?.id === tenant.id ? 'primary' : 'secondary'} size="sm" aria-pressed={selected?.id === tenant.id} aria-label={`Gérer l’accès de ${tenant.name}`} onClick={() => { setSelected(tenant); }}>
                      Gérer l’accès
                    </Button>
                  </li>
                ))}
              </ul>
            ) : null}
          </SectionCard>
          {selected ? (
            <AccessCard key={selected.id} tenant={selected} />
          ) : (
            <Alert tone="info" title="Choisissez un contact">
              Sélectionnez un contact pour voir l’état de son invitation.
            </Alert>
          )}
        </div>
      ) : (
        <Alert tone="info" title="Invitations réservées à la gestion">
          Votre rôle ne permet pas d’inviter les locataires à leur espace.
        </Alert>
      )}
    </>
  );
}
