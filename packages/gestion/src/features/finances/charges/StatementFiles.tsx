'use client';

import { Alert, Badge, Button } from '@eguardimmo/ui';
import { useState } from 'react';
import { useShareStatementFile } from './hooks';
import type { Statement, StatementFile } from './model';
import { ActionError } from './parts/ActionError';
import { ConfirmAction } from './parts/ConfirmAction';
import { SectionCard, useNotify } from '../../locataires/kit';
import { formatDateFr } from '../../locataires/kit/dates';

export function StatementFiles({ statement, canShare }: { statement: Statement; canShare: boolean }) {
  const share = useShareStatementFile();
  const notify = useNotify();
  const [sharing, setSharing] = useState<StatementFile | null>(null);

  return (
    <SectionCard id="statement-files" title="Pièces partagées avec le locataire">
      {statement.files.length === 0 ? <p className="text-body text-fg-subtle">Aucune pièce rattachée à ce décompte.</p> : null}
      <ul className="flex flex-col gap-2">
        {statement.files.map((file) => (
          <li key={file.id} className="flex flex-wrap items-center justify-between gap-2 border-t border-line py-2 first:border-t-0">
            <span className="flex min-w-0 flex-col">
              <b className="truncate text-body-strong text-fg">{file.label}</b>
              <span className="text-caption text-fg-subtle">{file.tenantVisible ? `Visible par le locataire jusqu’au ${formatDateFr(file.visibleUntil)}` : 'Non partagée'}</span>
            </span>
            <span className="flex items-center gap-2">
              <Badge tone={file.tenantVisible ? 'success' : 'neutral'}>{file.tenantVisible ? 'Partagée' : 'Privée'}</Badge>
              {canShare ? (
                file.tenantVisible ? (
                  <Button size="sm" variant="secondary" loading={share.isPending && share.variables.fileId === file.id} onClick={() => { share.mutate({ statementId: statement.id, fileId: file.id, visible: false }, { onSuccess: () => { notify({ title: 'Accès retiré', description: 'Le locataire ne voit plus cette pièce.' }); } }); }}>
                    Retirer l’accès
                  </Button>
                ) : (
                  <Button size="sm" variant="secondary" onClick={() => { setSharing(file); }}>Partager</Button>
                )
              ) : null}
            </span>
          </li>
        ))}
      </ul>
      {share.isError ? <ActionError title="Partage non modifié" error={share.error} /> : null}
      <ConfirmAction
        open={sharing !== null}
        title="Partager cette pièce avec le locataire ?"
        description="Le locataire pourra la consulter depuis son espace pendant la durée prévue par le serveur."
        extra={<Alert tone="warning" title="Vérifiez les données de tiers">Une facture peut porter des informations sur d’autres occupants ou sur le propriétaire : relisez-la avant de la partager.</Alert>}
        confirmLabel="Partager la pièce"
        failureTitle="Pièce non partagée"
        run={async () => {
          if (sharing === null) return;
          await share.mutateAsync({ statementId: statement.id, fileId: sharing.id, visible: true });
          notify({ title: 'Pièce partagée', description: 'Le locataire la retrouve dans son espace.' });
        }}
        onClose={() => { setSharing(null); }}
      />
    </SectionCard>
  );
}
