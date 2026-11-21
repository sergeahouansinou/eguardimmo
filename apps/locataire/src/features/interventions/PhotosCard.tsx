'use client';

import { Button, Icon } from '@eguardimmo/ui';
import { ImageIcon } from 'lucide-react';
import { useState } from 'react';
import { FailureAlert } from '@/components/FailureAlert';
import { FileDrop } from '@/components/FileDrop';
import { useFlash } from '@/components/flash';
import { SectionCard } from '@/components/Section';
import { PHOTO_RULES, checkFile } from '@/lib/files';
import { INTERVENTION_WORDING } from '@/tenant/interventionErrors';
import { useAddPhotos, usePhotoDownload } from '@/tenant/interventionQueries';
import { photoPath } from '@/tenant/interventionRequests';
import type { InterventionFile } from '@/tenant/interventionModel';

export const MAX_PHOTOS = 6;

const photoName = (file: InterventionFile, index: number): string => `Photo ${String(index + 1)}${file.uploadedBy === 'team' ? ' (ajoutée par l’agence)' : ''}`;

export function PhotosCard({ id, files, canAdd }: { id: string; files: InterventionFile[]; canAdd: boolean }) {
  const photos = files.filter((file) => file.kind.startsWith('photo'));
  const download = usePhotoDownload();
  const add = useAddPhotos();
  const show = useFlash((state) => state.show);
  const [selected, setSelected] = useState<File[]>([]);
  const [fileError, setFileError] = useState<string | undefined>();

  const change = (next: File[]) => {
    const rejected = next.map((file) => checkFile(file, PHOTO_RULES)).find((check) => !check.ok);
    const problem = rejected?.error ?? (next.length > MAX_PHOTOS ? `${String(MAX_PHOTOS)} photos au maximum à la fois.` : undefined);
    setFileError(problem);
    if (problem === undefined) setSelected(next);
  };

  const send = () => {
    add.mutate(
      { id, photos: selected },
      {
        onSuccess: (failed) => {
          setSelected(failed);
          show(
            failed.length === 0
              ? { tone: 'success', title: 'Photos ajoutées', path: `/interventions/${id}` }
              : { tone: 'warning', title: 'Certaines photos n’ont pas été ajoutées', detail: failed.map((file) => file.name).join(', '), path: `/interventions/${id}` },
          );
        },
      },
    );
  };

  return (
    <SectionCard id="iv-photos" title="Photos jointes">
      {photos.length === 0 ? (
        <p className="py-2 text-body text-fg-subtle">Aucune photo jointe.</p>
      ) : (
        <ul className="flex flex-col gap-1.5">
          {photos.map((file, index) => (
            <li key={file.id} className="flex flex-wrap items-center justify-between gap-2">
              <span className="inline-flex items-center gap-1.5 text-body">
                <Icon icon={ImageIcon} size={16} className="text-fg-subtle" />
                {photoName(file, index)}
              </span>
              <Button
                size="sm"
                variant="ghost"
                disabled={download.isPending}
                aria-label={`Télécharger ${photoName(file, index)}`}
                onClick={() => { download.mutate({ path: photoPath(id, file.id), filename: `photo-${String(index + 1)}.jpg` }); }}
              >
                Télécharger
              </Button>
            </li>
          ))}
        </ul>
      )}
      {download.isError ? <FailureAlert title="La photo n’a pas pu être téléchargée" error={download.error} wording={INTERVENTION_WORDING} /> : null}
      {canAdd ? (
        <div className="mt-3 flex flex-col gap-2">
          <FileDrop title="Ajouter des photos" rules={PHOTO_RULES} files={selected} multiple onFilesChange={change} error={fileError} />
          {add.isError ? <FailureAlert title="Les photos n’ont pas pu être envoyées" error={add.error} wording={INTERVENTION_WORDING} /> : null}
          {selected.length > 0 ? (
            <div>
              <Button size="sm" loading={add.isPending} onClick={send}>
                Envoyer {selected.length === 1 ? 'la photo' : `les ${String(selected.length)} photos`}
              </Button>
            </div>
          ) : null}
        </div>
      ) : null}
    </SectionCard>
  );
}
