'use client';

import { Alert, Button, Card } from '@eguardimmo/ui';
import { CircleCheck } from 'lucide-react';
import Link from 'next/link';
import { DataTable } from '@/components/DataTable';
import { DownloadButton } from '@/components/DownloadButton';
import { FailureAlert } from '@/components/FailureAlert';
import { LeaseGate } from '@/components/LeaseGate';
import { PageHeader } from '@/components/PageHeader';
import { Skeleton } from '@/components/ScreenState';
import { EmptyLine } from '@/components/Section';
import { StatusBadge } from '@/components/StatusBadge';
import { formatDate } from '@/lib/dates';
import { pdfFilename } from '@/tenant/download';
import { useFileDownload } from '@/tenant/documentQueries';
import { INSPECTION_KIND_LABEL, INSPECTION_WORDING, PERFORMER_LABEL } from '@/tenant/inspectionLabels';
import { useInspections } from '@/tenant/inspectionQueries';
import { inspectionDocumentPath } from '@/tenant/inspectionRequests';
import type { Inspection } from '@/tenant/inspectionSchemas';
import { useSelectedLease } from '@/tenant/selectedLease';
import { LoadMore } from '../rent/LoadMore';

export function ApiEtatsScreen() {
  const selection = useSelectedLease();
  return (
    <>
      <PageHeader
        title="États des lieux"
        crumbs={[{ label: 'Mon logement' }, { label: 'États des lieux' }]}
        subtitle="Les états des lieux publiés par votre agence. Un état publié ne se modifie plus : vous pouvez y ajouter des remarques."
      />
      <LeaseGate selection={selection} errorTitle="Vos baux n’ont pas pu être chargés">
        {(lease) => <InspectionTable key={lease.id} leaseId={lease.id} />}
      </LeaseGate>
    </>
  );
}

function InspectionTable({ leaseId }: { leaseId: string }) {
  const inspections = useInspections();
  const download = useFileDownload();
  if (inspections.isError && inspections.data === undefined) {
    return <FailureAlert title="Les états des lieux n’ont pas pu être chargés" error={inspections.error} wording={INSPECTION_WORDING} onRetry={() => void inspections.refetch()} />;
  }
  if (inspections.data === undefined) return <Skeleton rows={2} />;
  const items = inspections.data.pages.flatMap((page) => page.items).filter((item) => item.leaseId === leaseId);
  return (
    <>
      {download.isError ? <FailureAlert title="Le téléchargement a échoué" error={download.error} wording={INSPECTION_WORDING} /> : null}
      {items.some((item) => item.openRemarkKinds.length > 0) ? (
        <Alert tone="info" title="Vous pouvez encore faire une remarque">
          Ouvrez l’état des lieux concerné pour signaler un complément, une remarque sur le chauffage ou un commentaire.
        </Alert>
      ) : null}
      <Card role="region" aria-label="Liste des états des lieux" className="px-4 py-3">
        {items.length === 0 ? (
          <EmptyLine>Aucun état des lieux n’a encore été publié pour ce bail.</EmptyLine>
        ) : (
          <DataTable
            label="États des lieux"
            rows={items}
            rowKey={(item) => item.id}
            columns={[
              {
                id: 'type',
                header: 'Type',
                primary: true,
                cell: (item) => (
                  <>
                    {INSPECTION_KIND_LABEL[item.kind]}
                    <br />
                    <span className="text-caption font-normal text-fg-subtle">{PERFORMER_LABEL[item.performedBy]}</span>
                  </>
                ),
              },
              { id: 'date', header: 'Date', cell: (item) => formatDate(item.performedOn) },
              {
                id: 'etat',
                header: 'État',
                cell: (item: Inspection) =>
                  item.publishedAt === null ? (
                    <StatusBadge tone="neutral">Non publié</StatusBadge>
                  ) : (
                    <StatusBadge tone="success" icon={CircleCheck}>Publié, figé</StatusBadge>
                  ),
              },
              {
                id: 'remarques',
                header: 'Remarques',
                cell: (item) => (item.openRemarkKinds.length > 0 ? 'Possibles' : 'Délai écoulé'),
              },
              {
                id: 'actions',
                header: 'Actions',
                numeric: true,
                mobileLabel: '',
                cell: (item) =>
                  item.publishedAt === null ? null : (
                    <span className="inline-flex flex-wrap items-center justify-end gap-1">
                      <Button size="sm" variant="ghost" asChild>
                        <Link href={`/etats-des-lieux/${item.id}`}>Voir le détail</Link>
                      </Button>
                      <DownloadButton
                        label={`Télécharger ${INSPECTION_KIND_LABEL[item.kind]} du ${formatDate(item.performedOn)}`}
                        pending={download.isPending}
                        onDownload={() => { download.mutate({ path: inspectionDocumentPath(item.id), filename: pdfFilename(`${INSPECTION_KIND_LABEL[item.kind]}-${item.performedOn}`) }); }}
                      />
                    </span>
                  ),
              },
            ]}
          />
        )}
      </Card>
      <LoadMore query={inspections} label="Afficher plus d’états des lieux" errorTitle="La suite des états des lieux n’a pas pu être chargée" />
    </>
  );
}
