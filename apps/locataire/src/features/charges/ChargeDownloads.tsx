'use client';

import { Button, Icon, IconButton } from '@eguardimmo/ui';
import { FileDown } from 'lucide-react';
import { FailureAlert } from '@/components/FailureAlert';
import { CardLink, EmptyLine, ListRow, SectionCard } from '@/components/Section';
import { formatDate } from '@/lib/dates';
import { CHARGE_WORDING } from '@/tenant/chargeLabels';
import type { ChargeDownload } from '@/tenant/chargeQueries';
import { useChargeDownload } from '@/tenant/chargeQueries';
import type { ChargeFile, ChargeStatement } from '@/tenant/chargeModel';
import { chargeFilePath, chargePdfPath } from '@/tenant/chargeRequests';
import { safeFileName } from '@/tenant/download';

export type ChargeDownloads = ReturnType<typeof useChargeDownload>;

export const pdfDownload = (statement: Pick<ChargeStatement, 'id' | 'number'>): ChargeDownload => ({
  kind: 'pdf',
  path: chargePdfPath(statement.id),
  baseName: safeFileName(`Decompte-charges-${statement.number}`),
});

export const fileDownload = (statement: Pick<ChargeStatement, 'id' | 'number'>, file: Pick<ChargeFile, 'id' | 'label'>): ChargeDownload => ({
  kind: 'file',
  path: chargeFilePath(statement.id, file.id),
  baseName: safeFileName(`${statement.number}-${file.label}`),
});

const isRunning = (downloads: ChargeDownloads, request: ChargeDownload): boolean => downloads.isPending && downloads.variables.path === request.path;

export function ChargePdfButton({ statement, downloads }: { statement: ChargeStatement; downloads: ChargeDownloads }) {
  const request = pdfDownload(statement);
  return (
    <Button variant="secondary" loading={isRunning(downloads, request)} disabled={downloads.isPending} onClick={() => { downloads.mutate(request); }}>
      <Icon icon={FileDown} />
      Télécharger le décompte (PDF)
    </Button>
  );
}

export function ChargeDownloadFailure({ downloads }: { downloads: ChargeDownloads }) {
  if (!downloads.isError) return null;
  return <FailureAlert title="Le téléchargement a échoué" error={downloads.error} wording={CHARGE_WORDING} />;
}

export function ChargeFilesCard({ statement, downloads }: { statement: ChargeStatement; downloads: ChargeDownloads }) {
  return (
    <SectionCard id="rc-pieces" title="Pièces justificatives" aside={<CardLink href="/messages/nouveau">Écrire à mon agence</CardLink>}>
      {statement.files.length === 0 ? (
        <EmptyLine>Aucune pièce n’est mise à disposition pour ce décompte. Vous pouvez la demander à votre agence par message.</EmptyLine>
      ) : (
        <ul>
          {statement.files.map((file) => (
            <ListRow
              key={file.id}
              title={file.label}
              detail={file.visibleUntil === null ? undefined : `Disponible jusqu’au ${formatDate(file.visibleUntil)}`}
              trailing={
                <IconButton
                  label={`Télécharger la pièce ${file.label}`}
                  icon={FileDown}
                  variant="secondary"
                  disabled={downloads.isPending}
                  onClick={() => { downloads.mutate(fileDownload(statement, file)); }}
                />
              }
            />
          ))}
        </ul>
      )}
    </SectionCard>
  );
}
