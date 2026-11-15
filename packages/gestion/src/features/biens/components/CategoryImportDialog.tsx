'use client';

import { Button, Dialog, DialogContent } from '@eguardimmo/ui';
import { useState } from 'react';
import { useCommand } from '../hooks/useCommand';
import { formatBytes } from '../lib/text';
import type { Owner } from '../schemas/common';
import { FilePicker } from './FilePicker';
import type { PickedFile } from './FilePicker';

export interface CategoryImportDialogProps {
  owner: Owner;
  category: string;
  title: string;
  pickerLabel: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function CategoryImportDialog({ owner, category, title, pickerLabel, open, onOpenChange }: CategoryImportDialogProps) {
  const [file, setFile] = useState<PickedFile | null>(null);
  const [error, setError] = useState<string | null>(null);
  const reset = () => {
    setFile(null);
    setError(null);
  };
  const add = useCommand(
    (source, input: PickedFile) => source.addDocument(owner, { name: input.name, category, shared: false, sizeBytes: input.sizeBytes }),
    {
      success: (_result, input) => `« ${input.name} » importé`,
      onDone: () => {
        reset();
        onOpenChange(false);
      },
    },
  );
  return (
    <Dialog open={open} onOpenChange={(next) => { if (!next) reset(); onOpenChange(next); }}>
      <DialogContent title={title} description={`Le document est rangé dans les documents, catégorie ${category}.`}>
        <div className="flex flex-col gap-3 p-4">
          <FilePicker label={pickerLabel} hint="PDF, JPG ou PNG, 10 Mo au maximum" accept={['.pdf', '.jpg', '.jpeg', '.png']} onPick={(files) => { setFile(files[0] ?? null); setError(null); }} />
          {file ? <p className="text-body text-fg">{`${file.name} · ${formatBytes(file.sizeBytes)}`}</p> : null}
          {error ? <p role="alert" className="text-caption text-fg-danger">{error}</p> : null}
          <div className="flex flex-wrap justify-end gap-2">
            <Button variant="ghost" onClick={() => { onOpenChange(false); }}>
              Annuler
            </Button>
            <Button
              loading={add.isPending}
              onClick={() => {
                if (file) add.execute(file);
                else setError('Choisissez un fichier à importer.');
              }}
            >
              Importer
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
