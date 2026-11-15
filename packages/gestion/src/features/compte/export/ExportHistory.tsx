'use client';

import { Download, RefreshCw } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Alert, Badge, Button, Card, CardHeader, CardTitle, Icon } from '@eguardimmo/ui';
import type { BadgeTone } from '@eguardimmo/ui';
import { DataTable, EmptyBlock, QueryState, Td, Th } from '../../outils/kit';
import { formatDateTimeOffset } from '../shared/dates';
import { downloadFile } from '../shared/download';
import { formatSize } from './format';
import { EXPORT_FORMAT_LABELS, EXPORT_PERIOD_LABELS, EXPORT_SCOPE_LABELS, EXPORT_STATUS_LABELS } from './schemas';
import type { ExportRequest, ExportStatus } from './schemas';
import { useExportRequests, useExportSource } from './source';

const POLL_MS = 2500;
const NO_REQUESTS: readonly ExportRequest[] = [];
const TONES: Record<ExportStatus, BadgeTone> = { en_preparation: 'warning', prete: 'success', expiree: 'neutral' };

function describe(item: ExportRequest): string {
  const scopes = item.scopes.map((scope) => EXPORT_SCOPE_LABELS[scope].label).join(', ');
  return `${scopes} · ${EXPORT_FORMAT_LABELS[item.format]} · ${EXPORT_PERIOD_LABELS[item.period]}`;
}

export function ExportHistory() {
  const query = useExportRequests();
  const source = useExportSource();
  const [failed, setFailed] = useState(false);
  const requests = query.data ?? NO_REQUESTS;
  const preparing = requests.some((item) => item.status === 'en_preparation');
  const { refetch } = query;

  useEffect(() => {
    if (!preparing) return;
    const timer = setInterval(refetch, POLL_MS);
    return () => { clearInterval(timer); };
  }, [preparing, refetch]);

  const download = (id: string) => {
    setFailed(false);
    source
      .downloadArchive(id)
      .then((archive) => { downloadFile(archive.filename, archive.content, archive.type); })
      .catch(() => { setFailed(true); });
  };

  return (
    <Card role="region" aria-labelledby="export-historique" className="px-4 py-3">
      <CardHeader>
        <CardTitle as="h2" id="export-historique">Historique des demandes</CardTitle>
        <Button variant="ghost" size="sm" onClick={refetch}>
          <Icon icon={RefreshCw} />
          Actualiser
        </Button>
      </CardHeader>
      {failed ? <Alert tone="danger" title="Téléchargement impossible">L’archive n’est plus disponible ou a expiré.</Alert> : null}
      <QueryState query={query} errorTitle="Impossible de charger les demandes d’export" loadingLabel="Chargement des demandes">
        {(items) =>
          items.length === 0 ? (
            <EmptyBlock title="Aucune demande d’export">Votre première archive apparaîtra ici.</EmptyBlock>
          ) : (
            <DataTable caption="Demandes d’export de données">
              <thead>
                <tr>
                  <Th>Demande</Th>
                  <Th>Contenu</Th>
                  <Th>Statut</Th>
                  <Th numeric>Taille</Th>
                  <Th>
                    <span className="sr-only">Action</span>
                  </Th>
                </tr>
              </thead>
              <tbody>
                {items.map((item) => (
                  <tr key={item.id} className="border-b border-line last:border-b-0">
                    <Td strong>
                      <span className="block">{formatDateTimeOffset(item.requestedAt)}</span>
                      <span className="block text-caption font-normal text-fg-subtle">{item.requestedBy}</span>
                    </Td>
                    <Td className="max-w-[360px]">{describe(item)}</Td>
                    <Td>
                      <Badge tone={TONES[item.status]}>{EXPORT_STATUS_LABELS[item.status]}</Badge>
                    </Td>
                    <Td numeric>{formatSize(item.sizeBytes)}</Td>
                    <Td className="text-right">
                      {item.status === 'prete' ? (
                        <Button variant="secondary" size="sm" onClick={() => { download(item.id); }}>
                          <Icon icon={Download} />
                          Télécharger
                        </Button>
                      ) : null}
                    </Td>
                  </tr>
                ))}
              </tbody>
            </DataTable>
          )
        }
      </QueryState>
    </Card>
  );
}
