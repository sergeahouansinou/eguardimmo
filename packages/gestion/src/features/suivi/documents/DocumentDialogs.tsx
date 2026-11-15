'use client';

import { useState } from 'react';
import type { SyntheticEvent } from 'react';
import { Button, Dialog, DialogClose, DialogContent, Select, TextField } from '@eguardimmo/ui';
import { bienLabel, bienOptions, tenantOf } from '../shared/biens';
import { formatFrDate } from '../shared/dates';
import { formatSize } from '../shared/files';
import { NONE } from '../shared/schemas';
import { documentPatchSchema } from './schemas';
import type { DocumentPatch, DocumentRecord } from './schemas';

export function DocumentDetailDialog({ document, onClose }: { document: DocumentRecord | null; onClose: () => void }) {
  return (
    <Dialog open={document !== null} onOpenChange={(open) => { if (!open) onClose(); }}>
      {document ? (
        <DialogContent title={document.fileName} description="Détail du document" className="max-w-md">
          <dl className="grid grid-cols-[max-content_1fr] gap-x-4 gap-y-1.5 p-4 text-body">
            <dt className="text-fg-subtle">Bien</dt>
            <dd>{document.bienId ? bienLabel(document.bienId) : 'Aucun bien'}</dd>
            <dt className="text-fg-subtle">Description</dt>
            <dd>{document.description === '' ? '—' : document.description}</dd>
            <dt className="text-fg-subtle">Partagé avec</dt>
            <dd>{document.sharedWith ?? '—'}</dd>
            <dt className="text-fg-subtle">Partage</dt>
            <dd>{document.shared ? 'Partagé avec le locataire' : 'Privé'}</dd>
            <dt className="text-fg-subtle">Taille</dt>
            <dd>{formatSize(document.sizeBytes)}</dd>
            <dt className="text-fg-subtle">Date</dt>
            <dd>{formatFrDate(document.date)}</dd>
          </dl>
          <p className="px-4 text-caption text-fg-subtle">L’aperçu du contenu n’est pas disponible en démonstration.</p>
          <div className="flex justify-end p-4">
            <DialogClose asChild>
              <Button variant="secondary">Fermer</Button>
            </DialogClose>
          </div>
        </DialogContent>
      ) : null}
    </Dialog>
  );
}

export type EditMode = 'rename' | 'attach';

export function DocumentEditDialog({
  document,
  mode,
  pending,
  onClose,
  onSubmit,
}: {
  document: DocumentRecord | null;
  mode: EditMode;
  pending: boolean;
  onClose: () => void;
  onSubmit: (patch: DocumentPatch) => void;
}) {
  return (
    <Dialog open={document !== null} onOpenChange={(open) => { if (!open) onClose(); }}>
      {document ? (
        <DialogContent title={mode === 'rename' ? 'Renommer le document' : 'Rattacher à un bien'} description={document.fileName} className="max-w-md">
          <EditForm key={`${document.id}-${mode}`} document={document} mode={mode} pending={pending} onSubmit={onSubmit} />
        </DialogContent>
      ) : null}
    </Dialog>
  );
}

function EditForm({
  document,
  mode,
  pending,
  onSubmit,
}: {
  document: DocumentRecord;
  mode: EditMode;
  pending: boolean;
  onSubmit: (patch: DocumentPatch) => void;
}) {
  const [name, setName] = useState(document.fileName);
  const [bien, setBien] = useState(document.bienId ?? NONE);
  const [error, setError] = useState<string | undefined>();

  const submit = (event: SyntheticEvent) => {
    event.preventDefault();
    const candidate =
      mode === 'rename'
        ? { fileName: name }
        : { bienId: bien === NONE ? null : bien, sharedWith: bien === NONE ? null : tenantOf(bien) };
    const parsed = documentPatchSchema.safeParse(candidate);
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message);
      return;
    }
    setError(undefined);
    onSubmit(parsed.data);
  };

  return (
    <form noValidate onSubmit={submit} className="flex flex-col gap-3 p-4">
      {mode === 'rename' ? (
        <TextField label="Nom du fichier" placeholder="Bail signé, Apt A1.pdf" value={name} error={error} onChange={(event) => { setName(event.target.value); }} />
      ) : (
        <Select
          label="Bien"
          placeholder="Choisir un bien"
          options={[{ value: NONE, label: 'Aucun bien' }, ...bienOptions()]}
          value={bien}
          error={error}
          onValueChange={setBien}
        />
      )}
      <div className="flex justify-end gap-2">
        <DialogClose asChild>
          <Button variant="secondary">Annuler</Button>
        </DialogClose>
        <Button type="submit" loading={pending}>Enregistrer</Button>
      </div>
    </form>
  );
}
