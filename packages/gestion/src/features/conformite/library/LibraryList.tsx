'use client';

import { Alert, Button, Card, EmptyState, SegmentedControl, Select, Table, TableBody, TableHead, TableHeaderCell, TableRow } from '@eguardimmo/ui';
import { FileText } from 'lucide-react';
import { useState } from 'react';
import { saveBlob } from '../../finances/rent/download';
import { ListLoading, LinkButton, errorMessage, useNotify } from '../../locataires/kit';
import { downloadName } from '../files';
import { useSubjectChoices } from '../useSubjects';
import { useArchiveLibraryDocument, useLibraryDownload, useLibraryEntries, useLibraryPermissions, useRestoreLibraryDocument } from './hooks';
import { libraryKindLabel, librarySubjectLabel } from './labels';
import { LIBRARY_KINDS } from './model';
import type { LibraryEntry, LibraryKind, LibrarySubject } from './model';
import { ArchiveConfirm } from './ArchiveConfirm';
import { LibraryRow } from './LibraryRow';
import { libraryPaths } from './paths';

const ALL = 'tous';
const kindOptions = [{ value: ALL, label: 'Toutes les natures' }, ...LIBRARY_KINDS.map((kind) => ({ value: kind, label: libraryKindLabel[kind] }))];
const stateOptions = [
  { value: 'active', label: 'Actifs' },
  { value: 'archived', label: 'Archivés' },
];
const isKind = (value: string): value is LibraryKind => LIBRARY_KINDS.some((kind) => kind === value);

export function LibraryList({ mandateLabelOf }: { mandateLabelOf?: (mandateId: string) => string | null }) {
  const [kind, setKind] = useState<LibraryKind | null>(null);
  const [archived, setArchived] = useState(false);
  const [pendingArchive, setPendingArchive] = useState<LibraryEntry | null>(null);
  const permissions = useLibraryPermissions();
  const entries = useLibraryEntries({ kind, archived });
  const choices = useSubjectChoices();
  const download = useLibraryDownload();
  const archive = useArchiveLibraryDocument();
  const restore = useRestoreLibraryDocument();
  const notify = useNotify();

  const subjectLabel = (subject: LibrarySubject | null): string => {
    if (subject === null) return 'Aucun objet';
    if (subject.type === 'mandate') return mandateLabelOf?.(subject.id) ?? librarySubjectLabel.mandate;
    if (subject.type === 'organization' || subject.type === 'unit' || subject.type === 'lease') return choices.labelOf({ type: subject.type, id: subject.id });
    return librarySubjectLabel[subject.type];
  };

  const fail = (title: string, error: unknown) => { notify({ tone: 'danger', title, description: errorMessage(error) }); };
  const onDownload = (entry: LibraryEntry) => {
    download.mutate(entry, {
      onSuccess: ({ blob, mimeType }) => { saveBlob(blob, downloadName([entry.file.name.replace(/\.[A-Za-z0-9]+$/, '')], mimeType)); },
      onError: (error) => { fail('Téléchargement impossible', error); },
    });
  };
  const onRestore = (entry: LibraryEntry) => {
    restore.mutate(entry, {
      onSuccess: () => { notify({ title: 'Document restauré', description: `« ${entry.file.name} » est de nouveau dans la bibliothèque.` }); },
      onError: (error) => { fail('Restauration impossible', error); },
    });
  };
  const confirmArchive = () => {
    const entry = pendingArchive;
    if (entry === null) return;
    archive.mutate(entry, {
      onSuccess: () => {
        setPendingArchive(null);
        notify({ title: 'Document archivé', description: `« ${entry.file.name} » est conservé dans les archives, rien n’est supprimé.` });
      },
      onError: (error) => {
        setPendingArchive(null);
        fail('Archivage impossible', error);
      },
    });
  };

  return (
    <Card role="region" aria-label="Bibliothèque de documents" className="gap-3">
      <div className="flex flex-wrap items-end gap-3">
        <div className="w-full sm:w-56">
          <Select
            label="Nature"
            placeholder="Toutes les natures"
            options={kindOptions}
            value={kind ?? ALL}
            onValueChange={(value) => { setKind(isKind(value) ? value : null); }}
          />
        </div>
        <SegmentedControl label="État des documents" options={stateOptions} value={archived ? 'archived' : 'active'} onValueChange={(value) => { setArchived(value === 'archived'); }} />
      </div>
      {entries.isError ? (
        <Alert tone="danger" title="La bibliothèque n’a pas pu être chargée">
          <span className="block">{errorMessage(entries.error)}</span>
          <Button variant="secondary" size="sm" className="mt-2" onClick={entries.retry}>Réessayer</Button>
        </Alert>
      ) : null}
      {entries.isPending && !entries.isError ? <ListLoading label="Chargement de la bibliothèque" /> : null}
      {!entries.isPending && !entries.isError && entries.items.length === 0 ? (
        <EmptyState
          icon={FileText}
          title={archived ? 'Aucun document archivé' : 'Aucun document dans la bibliothèque'}
          description={archived ? 'Les documents archivés apparaissent ici ; ils peuvent être restaurés.' : 'Déposez un mandat, un bail, un diagnostic ou une photo pour le retrouver ici.'}
        >
          {permissions.write && !archived ? <LinkButton href={libraryPaths.add} variant="primary">Ajouter un document</LinkButton> : null}
        </EmptyState>
      ) : null}
      {entries.items.length > 0 ? (
        <Table aria-label="Documents de la bibliothèque">
          <TableHead>
            <TableRow>
              <TableHeaderCell>Document et actions</TableHeaderCell>
              <TableHeaderCell>Nature</TableHeaderCell>
              <TableHeaderCell>Concerne</TableHeaderCell>
              <TableHeaderCell>Déposé le</TableHeaderCell>
              <TableHeaderCell>Analyse antivirus</TableHeaderCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {entries.items.map((entry) => (
              <LibraryRow
                key={entry.id}
                entry={entry}
                subjectLabel={subjectLabel(entry.file.subject)}
                canWrite={permissions.write}
                onDownload={onDownload}
                onArchive={setPendingArchive}
                onRestore={onRestore}
              />
            ))}
          </TableBody>
        </Table>
      ) : null}
      {entries.hasMore ? (
        <div className="flex justify-center border-t border-line pt-2">
          <Button variant="secondary" loading={entries.isLoadingMore} onClick={entries.loadMore}>Charger plus</Button>
        </div>
      ) : null}
      <ArchiveConfirm entry={pendingArchive} pending={archive.isPending} onCancel={() => { setPendingArchive(null); }} onConfirm={confirmArchive} />
    </Card>
  );
}
