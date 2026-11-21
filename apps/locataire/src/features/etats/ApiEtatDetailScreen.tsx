'use client';

import { Alert, Button, Icon, StatCard } from '@eguardimmo/ui';
import { ApiError } from '@eguardimmo/api';
import { Download } from 'lucide-react';
import { FailureAlert } from '@/components/FailureAlert';
import { PageHeader } from '@/components/PageHeader';
import { NotFoundState, Skeleton } from '@/components/ScreenState';
import { KeyValueList, SectionCard } from '@/components/Section';
import { StatusBadge } from '@/components/StatusBadge';
import { formatDate, formatDateTime } from '@/lib/dates';
import { useFileDownload } from '@/tenant/documentQueries';
import { pdfFilename } from '@/tenant/download';
import { INSPECTION_KIND_LABEL, INSPECTION_WORDING, PERFORMER_LABEL } from '@/tenant/inspectionLabels';
import { useInspection } from '@/tenant/inspectionQueries';
import { inspectionDocumentPath } from '@/tenant/inspectionRequests';
import type { Inspection } from '@/tenant/inspectionSchemas';
import { RemarkForm } from './RemarkForm';
import { RemarkList } from './RemarkList';

const CRUMBS_ROOT = { label: 'États des lieux', href: '/etats-des-lieux' };

export function ApiEtatDetailScreen({ id }: { id: string }) {
  const inspection = useInspection(id);
  if (inspection.isError && inspection.error instanceof ApiError && inspection.error.status === 404) {
    return <NotFoundState title="État des lieux introuvable" backHref="/etats-des-lieux" backLabel="Revenir aux états des lieux" />;
  }
  if (inspection.isError) {
    return <FailureAlert title="L’état des lieux n’a pas pu être chargé" error={inspection.error} wording={INSPECTION_WORDING} onRetry={() => void inspection.refetch()} />;
  }
  if (inspection.data === undefined) return <Skeleton rows={4} />;
  return <Detail inspection={inspection.data} />;
}

const yesNo = (value: boolean | null): string => (value === null ? '—' : value ? 'Oui' : 'Non');

function Detail({ inspection }: { inspection: Inspection }) {
  const download = useFileDownload();
  const title = INSPECTION_KIND_LABEL[inspection.kind];
  const date = formatDate(inspection.performedOn);
  const published = inspection.publishedAt !== null;
  return (
    <>
      <PageHeader
        title={title}
        crumbs={[CRUMBS_ROOT, { label: `${inspection.kind === 'entry' ? 'Entrée' : 'Sortie'} du ${date}` }]}
        badge={published ? <StatusBadge tone="success">Publié, figé</StatusBadge> : <StatusBadge tone="neutral">Non publié</StatusBadge>}
        subtitle={`${date} · ${PERFORMER_LABEL[inspection.performedBy]}`}
        actions={
          published ? (
            <Button
              loading={download.isPending}
              onClick={() => { download.mutate({ path: inspectionDocumentPath(inspection.id), filename: pdfFilename(`${title}-${inspection.performedOn}`) }); }}
            >
              <Icon icon={Download} />
              Télécharger le document
            </Button>
          ) : undefined
        }
      />
      {download.isError ? <FailureAlert title="Le téléchargement a échoué" error={download.error} wording={INSPECTION_WORDING} /> : null}
      {published ? (
        <Alert tone="info" title="Document figé">
          Cet état des lieux est publié : il ne se modifie plus. Si un point vous paraît inexact, ajoutez une remarque ci-dessous.
        </Alert>
      ) : (
        <Alert tone="warning" title="Pas encore consultable">
          Votre agence n’a pas encore publié cet état des lieux.
        </Alert>
      )}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <StatCard label="Date de l’état des lieux" value={date}>
          <span className="text-caption text-fg-subtle">{PERFORMER_LABEL[inspection.performedBy]}</span>
        </StatCard>
        <StatCard label="Publié le" value={inspection.publishedAt === null ? '—' : formatDate(inspection.publishedAt)}>
          <span className="text-caption text-fg-subtle">{inspection.publishedAt === null ? 'En préparation' : formatDateTime(inspection.publishedAt)}</span>
        </StatCard>
      </div>
      <div className="grid grid-cols-1 items-start gap-3 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <div className="flex min-w-0 flex-col gap-3">
          <SectionCard id="ed-remarques" title="Mes remarques">
            <RemarkList inspectionId={inspection.id} />
          </SectionCard>
          {published ? (
            <SectionCard id="ed-nouvelle" title="Ajouter une remarque">
              {inspection.openRemarkKinds.length === 0 ? (
                <p className="text-body text-fg-muted">Aucune remarque n’est possible sur cet état des lieux : les délais sont écoulés.</p>
              ) : (
                <RemarkForm inspectionId={inspection.id} kinds={inspection.openRemarkKinds} />
              )}
            </SectionCard>
          ) : null}
        </div>
        <SectionCard id="ed-signatures" title="Signataires">
          {inspection.signatories.length === 0 ? (
            <p className="text-body text-fg-muted">Aucun signataire n’est indiqué.</p>
          ) : (
            <ul className="flex flex-col gap-2">
              {inspection.signatories.map((signatory) => (
                <li key={`${signatory.name}-${signatory.date}`} className="flex flex-col rounded-md border border-line p-3">
                  <b className="text-body-strong">{signatory.name}</b>
                  <span className="text-caption text-fg-subtle">{signatory.capacity} · le {formatDate(signatory.date)}</span>
                </li>
              ))}
            </ul>
          )}
          {inspection.kind === 'exit' ? (
            <div className="mt-3">
              <KeyValueList labelWidth="8rem" items={[{ label: 'Conforme à l’entrée', value: yesNo(inspection.exitMatchesEntry) }]} />
            </div>
          ) : null}
        </SectionCard>
      </div>
    </>
  );
}
