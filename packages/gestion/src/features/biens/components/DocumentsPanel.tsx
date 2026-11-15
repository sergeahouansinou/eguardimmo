'use client';

import { Badge, Button, Chip, ConfirmDialog, Dialog, DialogContent, EmptyState, Select, Switch } from '@eguardimmo/ui';
import { Download, EyeOff, FileText, Share2, Trash2, Upload } from 'lucide-react';
import { useState } from 'react';
import { useCommand } from '../hooks/useCommand';
import { useListState } from '../hooks/useListState';
import { formatDate } from '../lib/dates';
import { downloadFile } from '../lib/files';
import { formatBytes, plural, slugify } from '../lib/text';
import { useDocuments } from '../queries';
import type { DocumentRecord, Owner } from '../schemas/common';
import { DataTable } from './DataTable';
import { FilePicker } from './FilePicker';
import type { PickedFile } from './FilePicker';
import { Panel } from './Panels';
import { QueryBoundary, SkeletonRows } from './QueryState';
import { RowActions } from './RowActions';

const ACCEPTED = ['.pdf', '.jpg', '.jpeg', '.png', '.docx'];

function ImportDialog({ owner, categories, open, onOpenChange, showShare }: { owner: Owner; categories: readonly string[]; open: boolean; onOpenChange: (open: boolean) => void; showShare: boolean }) {
  const [file, setFile] = useState<PickedFile | null>(null);
  const [category, setCategory] = useState('');
  const [shared, setShared] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const reset = () => {
    setFile(null);
    setCategory('');
    setShared(false);
    setError(null);
  };
  const add = useCommand((source, input: { file: PickedFile; category: string; shared: boolean }) =>
    source.addDocument(owner, { name: input.file.name, category: input.category, shared: input.shared, sizeBytes: input.file.sizeBytes }), {
    success: (_result, input) => `« ${input.file.name} » ajouté`,
    onDone: () => {
      reset();
      onOpenChange(false);
    },
  });
  const submit = () => {
    if (!file) {
      setError('Choisissez un fichier à importer.');
    } else if (category === '') {
      setError('Choisissez une catégorie.');
    } else {
      setError(null);
      add.execute({ file, category, shared });
    }
  };
  return (
    <Dialog open={open} onOpenChange={(next) => { if (!next) reset(); onOpenChange(next); }}>
      <DialogContent title="Importer un document" description="PDF, image ou document Word, 10 Mo au maximum.">
        <div className="flex flex-col gap-3 p-4">
          <FilePicker label="Déposer un fichier ici" hint="PDF, JPG, PNG ou DOCX, 10 Mo au maximum" accept={ACCEPTED} onPick={(files) => { setFile(files[0] ?? null); setError(null); }} />
          {file ? <p className="text-body text-fg">{`${file.name} · ${formatBytes(file.sizeBytes)}`}</p> : null}
          <Select label="Catégorie" placeholder="Choisir une catégorie" options={categories.map((entry) => ({ value: entry, label: entry }))} value={category} onValueChange={setCategory} />
          {showShare ? <Switch label="Partager avec le locataire" checked={shared} onCheckedChange={setShared} /> : null}
          {error ? <p role="alert" className="text-caption text-fg-danger">{error}</p> : null}
          <div className="flex flex-wrap justify-end gap-2">
            <Button variant="ghost" onClick={() => { onOpenChange(false); }}>
              Annuler
            </Button>
            <Button loading={add.isPending} onClick={submit}>
              Importer
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export function DocumentsPanel({ owner, title, showShare = true, itemLabel = 'Document' }: { owner: Owner; title: string; showShare?: boolean; itemLabel?: string }) {
  const query = useDocuments(owner);
  const [category, setCategory] = useState('');
  const [importing, setImporting] = useState(false);
  const [removing, setRemoving] = useState<DocumentRecord | null>(null);
  const list = useListState({ key: 'date', direction: 'desc' });
  const share = useCommand((source, input: { id: string; shared: boolean }) => source.setDocumentShared(input.id, input.shared), {
    success: (_result, input) => (input.shared ? 'Document partagé avec le locataire' : 'Document rendu privé'),
  });
  const remove = useCommand((source, id: string) => source.deleteDocument(id), {
    success: () => 'Document supprimé',
    onDone: () => { setRemoving(null); },
  });

  return (
    <Panel
      title={title}
      action={
        <Button variant="secondary" size="sm" onClick={() => { setImporting(true); }}>
          <Upload aria-hidden="true" className="size-4" />
          Importer
        </Button>
      }
    >
      <QueryBoundary query={query} errorTitle="Les documents n’ont pas pu être chargés" skeleton={<SkeletonRows label="Chargement des documents" />}>
        {(data) => {
          const filtered = category === '' ? data.items : data.items.filter((item) => item.category === category);
          const counts = data.categories.map((entry) => ({ entry, count: data.items.filter((item) => item.category === entry).length })).filter((item) => item.count > 0);
          return (
            <>
              <div role="group" aria-label="Filtrer par catégorie" className="flex flex-wrap gap-1.5">
                <Chip pressed={category === ''} onClick={() => { setCategory(''); list.restart(); }}>
                  {`Tous ${String(data.items.length)}`}
                </Chip>
                {counts.map((item) => (
                  <Chip key={item.entry} pressed={category === item.entry} onClick={() => { setCategory(item.entry); list.restart(); }}>
                    {`${item.entry} ${String(item.count)}`}
                  </Chip>
                ))}
              </div>
              <DataTable
                label={title}
                rows={filtered}
                getId={(row) => row.id}
                list={list}
                empty={
                  <EmptyState icon={FileText} title="Aucun document" description="Importez un fichier pour le conserver ici.">
                    <Button variant="secondary" onClick={() => { setImporting(true); }}>
                      Importer un document
                    </Button>
                  </EmptyState>
                }
                columns={[
                  { id: 'name', header: itemLabel, strong: true, sortBy: (row) => row.name, cell: (row) => row.name },
                  { id: 'category', header: 'Catégorie', sortBy: (row) => row.category, cell: (row) => row.category },
                  { id: 'date', header: 'Date', sortBy: (row) => row.date, cell: (row) => formatDate(row.date) },
                  ...(showShare
                    ? [{ id: 'shared', header: 'Partage', cell: (row: DocumentRecord) => <Badge tone={row.shared ? 'info' : 'neutral'}>{row.shared ? 'Partagé' : 'Privé'}</Badge> }]
                    : []),
                  { id: 'size', header: 'Taille', numeric: true, sortBy: (row) => row.sizeBytes, cell: (row) => formatBytes(row.sizeBytes) },
                  {
                    id: 'actions',
                    header: 'Action',
                    hideHeader: true,
                    cell: (row) => (
                      <RowActions
                        name={row.name}
                        items={[
                          {
                            id: 'download',
                            label: 'Télécharger',
                            icon: Download,
                            onSelect: () => { downloadFile(`${slugify(row.name)}.txt`, `Document de démonstration : ${row.name}\r\nCatégorie : ${row.category}\r\nDate : ${formatDate(row.date)}\r\n`, 'text/plain;charset=utf-8'); },
                          },
                          ...(showShare
                            ? [{ id: 'share', label: row.shared ? 'Rendre privé' : 'Partager avec le locataire', icon: row.shared ? EyeOff : Share2, onSelect: () => { share.execute({ id: row.id, shared: !row.shared }); } }]
                            : []),
                          { id: 'delete', label: 'Supprimer', icon: Trash2, tone: 'danger' as const, separatorBefore: true, onSelect: () => { setRemoving(row); } },
                        ]}
                      />
                    ),
                  },
                ]}
              />
              <p className="text-caption text-fg-subtle">{plural(filtered.length, 'document')} affiché{filtered.length > 1 ? 's' : ''}.</p>
              <ImportDialog owner={owner} categories={data.categories} open={importing} onOpenChange={setImporting} showShare={showShare} />
            </>
          );
        }}
      </QueryBoundary>
      <ConfirmDialog
        open={removing !== null}
        onOpenChange={(open) => { if (!open) setRemoving(null); }}
        title="Supprimer ce document ?"
        description={removing ? `« ${removing.name} » sera supprimé définitivement.` : ''}
        confirmLabel="Supprimer"
        tone="danger"
        loading={remove.isPending}
        onConfirm={() => { if (removing) remove.execute(removing.id); }}
      />
    </Panel>
  );
}
