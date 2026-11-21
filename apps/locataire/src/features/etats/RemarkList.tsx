'use client';

import { Alert, Icon } from '@eguardimmo/ui';
import { Image as ImageIcon } from 'lucide-react';
import { Button } from '@eguardimmo/ui';
import { FailureAlert } from '@/components/FailureAlert';
import { EmptyLine } from '@/components/Section';
import { StatusBadge } from '@/components/StatusBadge';
import { formatDateTime } from '@/lib/dates';
import { safeFileName } from '@/tenant/download';
import { DECISION_VIEW, INSPECTION_WORDING, REMARK_KIND_VIEW } from '@/tenant/inspectionLabels';
import { useInspectionDownload, useRemarks } from '@/tenant/inspectionQueries';
import { inspectionFilePath } from '@/tenant/inspectionRequests';
import type { InspectionRemark } from '@/tenant/inspectionSchemas';
import { LoadMore } from '../rent/LoadMore';

export function RemarkList({ inspectionId }: { inspectionId: string }) {
  const remarks = useRemarks(inspectionId);
  const download = useInspectionDownload();
  const items = remarks.data?.pages.flatMap((page) => page.items) ?? [];
  if (remarks.isError && items.length === 0) {
    return <FailureAlert title="Vos remarques n’ont pas pu être chargées" error={remarks.error} wording={INSPECTION_WORDING} onRetry={() => void remarks.refetch()} />;
  }
  if (remarks.isPending) return <EmptyLine>Chargement de vos remarques…</EmptyLine>;
  return (
    <div className="flex flex-col gap-3">
      {items.length === 0 ? <EmptyLine>Vous n’avez fait aucune remarque sur cet état des lieux.</EmptyLine> : null}
      {items.map((remark) => (
        <RemarkItem
          key={remark.id}
          remark={remark}
          onPhoto={(fileId, position) => { download.mutate({ path: inspectionFilePath(fileId), filename: safeFileName(`Remarque-photo-${String(position + 1)}.jpg`) }); }}
        />
      ))}
      {download.isError ? <FailureAlert title="La photo n’a pas pu être téléchargée" error={download.error} wording={INSPECTION_WORDING} /> : null}
      <LoadMore query={remarks} label="Afficher plus de remarques" errorTitle="La suite des remarques n’a pas pu être chargée" />
    </div>
  );
}

function RemarkItem({ remark, onPhoto }: { remark: InspectionRemark; onPhoto: (fileId: string, position: number) => void }) {
  const kind = REMARK_KIND_VIEW[remark.kind];
  return (
    <article className="flex flex-col gap-2 rounded-md border border-line p-3" aria-label={`${kind.label}, ${formatDateTime(remark.createdAt)}`}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <b className="text-body-strong">{kind.label}</b>
        <StatusBadge tone={remark.status === 'answered' ? 'success' : 'info'}>{remark.status === 'answered' ? 'Réponse reçue' : 'En attente de réponse'}</StatusBadge>
      </div>
      <span className="text-caption text-fg-subtle">Envoyée le {formatDateTime(remark.createdAt)}</span>
      <p className="whitespace-pre-line break-words text-body">{remark.body}</p>
      {remark.photos.length > 0 ? (
        <ul className="flex flex-wrap gap-1.5">
          {[...remark.photos]
            .sort((a, b) => a.position - b.position)
            .map((photo) => (
              <li key={photo.id}>
                <Button size="sm" variant="secondary" aria-label={`Télécharger la photo ${String(photo.position + 1)} de la remarque`} onClick={() => { onPhoto(photo.id, photo.position); }}>
                  <Icon icon={ImageIcon} />
                  Photo {photo.position + 1}
                </Button>
              </li>
            ))}
        </ul>
      ) : null}
      {remark.answer === null ? null : (
        <Alert tone={DECISION_VIEW[remark.answer.decision].tone === 'danger' ? 'danger' : 'info'} title={DECISION_VIEW[remark.answer.decision].label}>
          {remark.answer.body ?? 'L’agence n’a pas ajouté de précision.'}
          {remark.answer.answeredAt === null ? null : <span className="mt-1 block text-caption">Le {formatDateTime(remark.answer.answeredAt)}</span>}
        </Alert>
      )}
    </article>
  );
}
