'use client';

import { useState } from 'react';
import { Button, Card, CardTitle, Select, Switch, TextField, cx } from '@eguardimmo/ui';
import { PageHeader, pushFlash, useSourceMutation } from '../../outils/kit';
import type { ScreenProps } from '../../outils/kit';
import { bienOptions, tenantOf } from '../shared/biens';
import { DropZone } from '../shared/DropZone';
import { pickFiles } from '../shared/files';
import type { PickedFile, Rejection } from '../shared/files';
import { PickedFiles, RejectedFiles } from '../shared/FileList';
import { NONE } from '../shared/schemas';
import type { FieldErrors } from '../shared/schemas';
import { FormLayout, Notice } from '../shared/ui';
import { documentInputSchema } from './schemas';
import type { DocumentInput } from './schemas';
import { DOCUMENTS_KEY, useDocumentsSource } from './source';

export const DOCUMENT_RULES = {
  extensions: ['pdf', 'doc', 'docx', 'jpg', 'jpeg', 'png', 'webp'],
  mimes: [
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'image/jpeg',
    'image/png',
    'image/webp',
  ],
  maxBytes: 25_000_000,
  maxFiles: 20,
} as const;

interface Rattachement {
  bienId: string;
  description: string;
}

function Step({ index, label, current }: { index: number; label: string; current: boolean }) {
  return (
    <li aria-current={current ? 'step' : undefined} className={cx('flex items-center gap-1.5', current ? 'font-semibold text-fg' : 'text-fg-subtle')}>
      <span className={cx('inline-flex size-5 items-center justify-center rounded-full text-caption', current ? 'bg-action text-on-action' : 'bg-muted text-fg-muted')}>
        {index}
      </span>
      {label}
    </li>
  );
}

export function DocumentImportPage({ Link, navigate }: ScreenProps) {
  const source = useDocumentsSource();
  const create = useSourceMutation((drafts: readonly DocumentInput[]) => source.createMany(drafts), [DOCUMENTS_KEY]);
  const [step, setStep] = useState<1 | 2>(1);
  const [files, setFiles] = useState<PickedFile[]>([]);
  const [rejected, setRejected] = useState<Rejection[]>([]);
  const [rattachements, setRattachements] = useState<Record<string, Rattachement>>({});
  const [shared, setShared] = useState(false);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [failure, setFailure] = useState<string | null>(null);

  const addFiles = (incoming: File[]) => {
    const result = pickFiles(incoming, files, DOCUMENT_RULES, 'PDF, Word ou image');
    setFiles([...files, ...result.accepted]);
    setRejected(result.rejected);
  };
  const patch = (id: string, change: Partial<Rattachement>) => {
    setRattachements({ ...rattachements, [id]: { bienId: NONE, description: '', ...rattachements[id], ...change } });
  };

  const submit = () => {
    setFailure(null);
    const found: Record<string, string> = {};
    const drafts = files.flatMap((file) => {
      const choice = rattachements[file.id] ?? { bienId: NONE, description: '' };
      const parsed = documentInputSchema.safeParse({
        fileName: file.name,
        bienId: choice.bienId === NONE ? null : choice.bienId,
        description: choice.description,
        sharedWith: choice.bienId === NONE ? null : tenantOf(choice.bienId),
        shared,
        sizeBytes: file.sizeBytes,
      });
      if (!parsed.success) {
        found[file.id] = parsed.error.issues[0]?.message ?? 'Informations invalides.';
        return [];
      }
      return [parsed.data];
    });
    setErrors(found);
    if (Object.keys(found).length > 0) return;
    create.mutate(drafts, {
      onSuccess: () => {
        pushFlash(drafts.length > 1 ? `${String(drafts.length)} documents importés.` : 'Document importé.');
        navigate('/documents');
      },
      onError: () => { setFailure('L’import n’a pas abouti. Réessayez dans un instant.'); },
    });
  };

  return (
    <>
      <PageHeader
        Link={Link}
        crumbs={[{ label: 'Documents', href: '/documents' }, { label: 'Importer' }]}
        title="Importer des documents"
        description={step === 1 ? 'Étape 1 sur 2 : choisir les fichiers, puis les rattacher.' : 'Étape 2 sur 2 : rattacher les fichiers à un bien.'}
        actions={
          <ol aria-label="Étapes" className="flex items-center gap-2 text-caption">
            <Step index={1} label="Fichiers" current={step === 1} />
            <li aria-hidden="true" className="text-fg-subtle">—</li>
            <Step index={2} label="Rattachement" current={step === 2} />
          </ol>
        }
      />
      <Notice tone="danger" message={failure} onDismiss={() => { setFailure(null); }} />
      <FormLayout
        main={
          step === 1 ? (
            <Card>
              <CardTitle as="h2">Fichiers à importer</CardTitle>
              <DropZone
                title="Déposer les fichiers ici"
                hint="PDF, Word, image. 25 Mo par fichier, 20 fichiers au maximum."
                buttonLabel="Parcourir"
                inputLabel="Choisir les fichiers à importer"
                accept=".pdf,.doc,.docx,.jpg,.jpeg,.png,.webp,application/pdf,image/jpeg,image/png,image/webp"
                onFiles={addFiles}
              />
              <RejectedFiles rejected={rejected} />
              <PickedFiles files={files} onRemove={(id) => { setFiles(files.filter((file) => file.id !== id)); }} />
              {files.length === 0 ? <p className="text-caption text-fg-subtle">Aucun fichier choisi pour le moment.</p> : null}
            </Card>
          ) : (
            <Card>
              <CardTitle as="h2">Rattachement</CardTitle>
              <ul className="flex flex-col gap-3">
                {files.map((file) => {
                  const choice = rattachements[file.id] ?? { bienId: NONE, description: '' };
                  return (
                    <li key={file.id} className="flex flex-col gap-2 border-b border-line pb-3 last:border-b-0 last:pb-0">
                      <b className="truncate text-body-strong text-fg">{file.name}</b>
                      {errors[file.id] ? <p className="text-caption text-fg-danger">{errors[file.id]}</p> : null}
                      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                        <Select
                          label={`Bien de ${file.name}`}
                          placeholder="Choisir un bien"
                          options={[{ value: NONE, label: 'Aucun bien' }, ...bienOptions()]}
                          value={choice.bienId}
                          onValueChange={(value) => { patch(file.id, { bienId: value }); }}
                        />
                        <TextField
                          label={`Description de ${file.name}`}
                          placeholder="Bail d'habitation vide"
                          value={choice.description}
                          onChange={(event) => { patch(file.id, { description: event.target.value }); }}
                        />
                      </div>
                    </li>
                  );
                })}
              </ul>
            </Card>
          )
        }
        aside={
          <Card>
            <CardTitle as="h2">Rappel</CardTitle>
            <span className="text-body text-fg-muted">
              Un document partagé est visible par le locataire dès l’import. Un document privé reste visible par vous seul.
            </span>
            {step === 2 ? <Switch label="Partager avec le locataire" checked={shared} onCheckedChange={setShared} /> : null}
          </Card>
        }
      />
      <div className="flex flex-wrap justify-end gap-2">
        {step === 1 ? (
          <>
            <Button variant="ghost" onClick={() => { navigate('/documents'); }}>Annuler</Button>
            <Button disabled={files.length === 0} onClick={() => { setStep(2); }}>Suivant</Button>
          </>
        ) : (
          <>
            <Button variant="ghost" onClick={() => { setStep(1); }}>Retour</Button>
            <Button loading={create.isPending} onClick={submit}>
              {files.length > 1 ? `Importer ${String(files.length)} documents` : 'Importer le document'}
            </Button>
          </>
        )}
      </div>
    </>
  );
}
