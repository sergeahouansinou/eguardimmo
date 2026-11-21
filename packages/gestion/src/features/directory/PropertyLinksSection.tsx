'use client';

import { Button, Icon, IconButton, Table, TableBody, TableCell, TableHead, TableHeaderCell, TableRow } from '@eguardimmo/ui';
import { Plus, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { ListLoading, NoRows, SectionCard, useGestionNavigation, useNotify } from '../locataires/kit';
import { CursorPager, useCursorPages } from '../finances/rent/CursorPager';
import { ConfirmAction } from '../orgapi/ConfirmAction';
import { QueryState } from '../orgapi/QueryState';
import { AddLinkDialog } from './AddLinkDialog';
import { useContactLinks, useReloadDirectory, useRemovePropertyLink } from './hooks';
import type { PropertyLink } from './model';
import { UnitCell } from './parts';
import { directoryPaths } from './paths';

export function PropertyLinksSection({ contactId, canLink }: { contactId: string; canLink: boolean }) {
  const [adding, setAdding] = useState(false);
  const pages = useCursorPages();
  return (
    <SectionCard
      id="property-links"
      title="Biens liés"
      aside={
        canLink ? (
          <Button variant="secondary" size="sm" onClick={() => { setAdding(true); }}>
            <Icon icon={Plus} />
            Rattacher à un bien
          </Button>
        ) : null
      }
    >
      <LinksTable contactId={contactId} canLink={canLink} pages={pages} />
      <AddLinkDialog contactId={contactId} open={adding} onClose={() => { setAdding(false); }} />
    </SectionCard>
  );
}

function LinksTable({ contactId, canLink, pages }: { contactId: string; canLink: boolean; pages: ReturnType<typeof useCursorPages> }) {
  const { Link } = useGestionNavigation();
  const links = useContactLinks(contactId, pages.cursor);
  const reload = useReloadDirectory();
  const [removing, setRemoving] = useState<PropertyLink | null>(null);
  const remove = useRemovePropertyLink();
  const notify = useNotify();

  if (links.isPending && !links.isError) return <ListLoading label="Chargement des biens liés" />;
  if (links.data === undefined) return <QueryState query={links} label="Chargement des biens liés" title="Impossible de charger les biens liés" onRetry={reload} />;
  if (links.data.items.length === 0) return <NoRows>{pages.page > 1 ? 'Aucun bien sur cette page.' : 'Ce contact n’est rattaché à aucun bien.'}</NoRows>;

  return (
    <>
      <Table aria-label="Biens liés au contact" scrollLabel="Biens liés au contact, défilement horizontal">
        <TableHead>
          <TableRow>
            <TableHeaderCell>Bien</TableHeaderCell>
            <TableHeaderCell>Lot</TableHeaderCell>
            <TableHeaderCell>Rôle</TableHeaderCell>
            {canLink ? <TableHeaderCell><span className="sr-only">Actions</span></TableHeaderCell> : null}
          </TableRow>
        </TableHead>
        <TableBody>
          {links.data.items.map((link) => (
            <TableRow key={link.id}>
              <TableCell>
                <Link href={directoryPaths.property(link.propertyId)} className="font-medium text-action-on-subtle underline-offset-2 hover:underline">{link.propertyName ?? 'Voir le bien'}</Link>
              </TableCell>
              <TableCell>
                <UnitCell link={link} />
              </TableCell>
              <TableCell>{link.category?.label ?? '—'}</TableCell>
              {canLink ? (
                <TableCell>
                  <IconButton label={`Retirer le lien avec ${link.propertyName ?? 'ce bien'}`} icon={Trash2} onClick={() => { setRemoving(link); }} />
                </TableCell>
              ) : null}
            </TableRow>
          ))}
        </TableBody>
      </Table>
      <CursorPager pages={pages} nextCursor={links.data.nextCursor} label="Pagination des biens liés" />
      <ConfirmAction
        open={removing !== null}
        title="Retirer ce lien ?"
        description="Le contact ne sera plus rattaché à ce bien. La fiche du contact et celle du bien ne sont pas supprimées."
        confirmLabel="Retirer le lien"
        tone="danger"
        failureTitle="Lien non retiré"
        run={async () => {
          if (!removing) return;
          await remove.mutateAsync({ propertyId: removing.propertyId, linkId: removing.id });
          notify({ title: 'Lien retiré' });
        }}
        onClose={() => { setRemoving(null); }}
      />
    </>
  );
}
