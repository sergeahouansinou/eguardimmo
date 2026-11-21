import { Badge, Button } from '@eguardimmo/ui';
import { Download, Paperclip } from 'lucide-react';
import { NoRows, SectionCard, errorMessage, useNotify } from '../../locataires/kit';
import { formatDateFr } from '../../locataires/kit/dates';
import { useFileDownload } from '../hooks';
import { actorLabel, fileKindLabel } from '../labels';
import type { InterventionDetail } from '../model';
import { useRowAction } from './rowActions';

export function FilesCard({ intervention, canAdd, canWrite, onAdd }: { intervention: InterventionDetail; canAdd: boolean; canWrite: boolean; onAdd: () => void }) {
  const notify = useNotify();
  const download = useFileDownload();
  const run = useRowAction();
  const open = (fileId: string, label: string) => {
    download.mutateAsync({ id: intervention.id, fileId }).then(
      (blob) => {
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = label;
        link.click();
        URL.revokeObjectURL(url);
      },
      (error: unknown) => { notify({ tone: 'danger', title: 'Téléchargement impossible', description: errorMessage(error) }); },
    );
  };
  return (
    <SectionCard
      id="pieces"
      title="Pièces"
      aside={canAdd ? <Button variant="secondary" size="sm" onClick={onAdd}><Paperclip aria-hidden className="size-4" />Ajouter une pièce</Button> : undefined}
    >
      {intervention.files.length === 0 ? <NoRows>Aucune pièce.</NoRows> : null}
      <ul className="flex flex-col">
        {intervention.files.map((file) => {
          const label = `${fileKindLabel[file.kind]} du ${formatDateFr(file.createdAt)}`;
          return (
            <li key={file.id} className="flex flex-wrap items-center justify-between gap-2 border-t border-line py-2 first:border-t-0">
              <span className="flex min-w-0 flex-col">
                <b className="text-body-strong text-fg">{fileKindLabel[file.kind]}</b>
                <span className="text-caption text-fg-subtle">{`Ajoutée par ${actorLabel[file.uploadedByKind].toLowerCase()} le ${formatDateFr(file.createdAt)}`}</span>
              </span>
              <span className="flex flex-wrap items-center gap-1">
                {file.visibleToTenant ? <Badge tone="info">Visible du locataire</Badge> : null}
                <Badge tone={file.visibleToOwner ? 'success' : 'neutral'}>{file.visibleToOwner ? 'Visible du mandant' : 'Interne'}</Badge>
                {canWrite ? (
                  <Button variant="ghost" size="sm" aria-label={`${file.visibleToOwner ? 'Retirer au mandant' : 'Partager avec le mandant'} : ${label}`} onClick={() => { run(file.visibleToOwner ? 'Pièce retirée au mandant' : 'Pièce partagée avec le mandant', (source) => source.shareFile(intervention.id, file.id, !file.visibleToOwner)); }}>
                    {file.visibleToOwner ? 'Retirer au mandant' : 'Partager au mandant'}
                  </Button>
                ) : null}
                <Button variant="ghost" size="sm" aria-label={`Télécharger : ${label}`} onClick={() => { open(file.id, label); }}>
                  <Download aria-hidden className="size-4" />
                  Télécharger
                </Button>
              </span>
            </li>
          );
        })}
      </ul>
    </SectionCard>
  );
}
