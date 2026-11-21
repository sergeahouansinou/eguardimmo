'use client';

import { Alert, Badge, Button, Icon } from '@eguardimmo/ui';
import { Download, FileDown, RefreshCw, Send, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { PublishDialog } from './PublishDialog';
import { RectifyDialog } from './RectifyDialog';
import { ReportInfoCard, ReportLinesCard, ReportTotalsCard } from './ReportBody';
import { ReportSettings } from './ReportSettings';
import { useDiscardReport, useGenerateReport, useLinesCsv, usePartyNames, useReport, useReportPdf, useReportingPermissions, useUnscheduleReport } from './hooks';
import { dayTime, periodText, statusBadge } from './labels';
import type { Report } from './model';
import { reportingPaths } from './paths';
import { ReportingApiError } from './api/reportingErrors';
import { ActionError, AgencyGate, ConfirmAction } from './parts';
import { safeFilename, saveBlob } from '../finances/rent/download';
import { ListLoading, LoadError, NotFoundPanel, PageHeader, noticeAfterNavigation, useGestionNavigation, useNotify } from '../locataires/kit';
import { links } from '../locataires/kit/links';

export function ReportPage({ id }: { id: string }) {
  return (
    <AgencyGate>
      <ReportLoader id={id} />
    </AgencyGate>
  );
}

function ReportLoader({ id }: { id: string }) {
  const report = useReport(id);
  const notFound = report.error instanceof ReportingApiError && report.error.kind === 'not_found';
  return (
    <>
      {report.isPending && !report.isError ? <ListLoading label="Chargement du compte rendu" /> : null}
      {notFound ? (
        <NotFoundPanel title="Compte rendu introuvable" description="Ce compte rendu n’existe pas dans votre organisation." backHref={reportingPaths.reports} backLabel="Retour aux comptes rendus" />
      ) : report.isError ? (
        <LoadError title={report.error?.message ?? 'Le compte rendu n’a pas pu être chargé'} />
      ) : null}
      {report.data ? <ReportView report={report.data} /> : null}
    </>
  );
}

type Dialog = 'publish' | 'rectify' | 'discard' | 'unschedule' | null;

function ReportView({ report }: { report: Report }) {
  const permissions = useReportingPermissions();
  const { push } = useGestionNavigation();
  const notify = useNotify();
  const names = usePartyNames([report.mandantId]);
  const generate = useGenerateReport();
  const discard = useDiscardReport();
  const unschedule = useUnscheduleReport();
  const pdf = useReportPdf();
  const csv = useLinesCsv();
  const [dialog, setDialog] = useState<Dialog>(null);
  const [failure, setFailure] = useState<unknown>(null);
  const name = names(report.mandantId, report.mandantName);
  const badge = statusBadge[report.status];
  const editable = report.status === 'draft' || report.status === 'generated';
  const hasNumbers = report.status === 'generated' || report.status === 'published' || report.status === 'superseded';
  const stored = report.status === 'published' || report.status === 'superseded';

  const downloadPdf = async () => {
    setFailure(null);
    try {
      saveBlob(await pdf.mutateAsync(report.id), stored ? safeFilename(`Compte-rendu-${report.number ?? report.id}`) : 'projet-compte-rendu.pdf');
    } catch (error) {
      setFailure(error);
    }
  };

  const downloadCsv = async () => {
    setFailure(null);
    try {
      saveBlob(await csv.mutateAsync(report.id), `lignes-${(report.number ?? report.id).replace(/[^A-Za-z0-9._-]+/g, '-')}.csv`);
    } catch (error) {
      setFailure(error);
    }
  };

  const runGenerate = async () => {
    setFailure(null);
    try {
      await generate.mutateAsync(report.id);
      notify({ title: report.status === 'draft' ? 'Compte rendu généré' : 'Compte rendu régénéré', description: `${name}, ${periodText(report.period)}.` });
    } catch (error) {
      setFailure(error);
    }
  };

  return (
    <>
      <PageHeader
        crumbs={[{ label: 'Accueil', href: links.home }, { label: 'Comptes rendus', href: reportingPaths.reports }, { label: name }]}
        title={`Compte rendu, ${periodText(report.period)}`}
        subtitle={`${name}${report.number === null ? '' : ` · ${report.number}`}`}
        badges={<Badge tone={badge.tone}>{badge.label}</Badge>}
        actions={
          <>
            {editable ? <Button variant="secondary" loading={generate.isPending} onClick={() => { void runGenerate(); }}><Icon icon={RefreshCw} />{report.status === 'draft' ? 'Générer' : 'Régénérer'}</Button> : null}
            {hasNumbers ? (
              <Button variant="secondary" loading={pdf.isPending} onClick={() => { void downloadPdf(); }}>
                <Icon icon={Download} />
                {stored ? 'Télécharger le PDF' : 'Aperçu PDF (projet)'}
              </Button>
            ) : null}
            {hasNumbers && permissions.export ? <Button variant="secondary" loading={csv.isPending} onClick={() => { void downloadCsv(); }}><Icon icon={FileDown} />Exporter les lignes (CSV)</Button> : null}
            {report.status === 'generated' && permissions.publish ? <Button onClick={() => { setDialog('publish'); }}><Icon icon={Send} />Publier</Button> : null}
            {report.status === 'published' && permissions.publish ? <Button variant="secondary" onClick={() => { setDialog('rectify'); }}>Rectifier</Button> : null}
            {editable ? <Button variant="ghost" onClick={() => { setDialog('discard'); }}><Icon icon={Trash2} />Écarter</Button> : null}
          </>
        }
      />
      {failure === null ? null : <ActionError title="Action impossible" error={failure} />}
      {report.status === 'generated' && report.scheduledFor !== null && permissions.publish ? (
        <Alert tone="info" title={`Publication planifiée le ${dayTime(report.scheduledFor)}`}>
          <Button variant="link" onClick={() => { setDialog('unschedule'); }}>Annuler la planification</Button>
        </Alert>
      ) : null}
      {report.status === 'superseded' ? <Alert tone="info" title="Compte rendu remplacé">Un compte rendu rectificatif l’a remplacé ; celui-ci reste consultable tel que le mandant l’a reçu.</Alert> : null}
      {report.status === 'discarded' ? <Alert tone="info" title="Compte rendu écarté">Ce brouillon a été abandonné ; la période peut être générée à nouveau.</Alert> : null}
      {!permissions.publish && report.status === 'generated' ? <p className="text-caption text-fg-subtle">Votre rôle permet de préparer le compte rendu ; la publication est réservée aux propriétaires, administrateurs et gestionnaires.</p> : null}
      <div className="grid grid-cols-1 items-start gap-3 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <div className="flex min-w-0 flex-col gap-3">
          <ReportTotalsCard report={report} />
          <ReportLinesCard report={report} />
        </div>
        <div className="flex min-w-0 flex-col gap-3">
          <ReportInfoCard report={report} name={name} />
          <ReportSettings report={report} editable={editable} />
        </div>
      </div>
      <PublishDialog report={report} name={name} open={dialog === 'publish'} onClose={() => { setDialog(null); }} />
      <RectifyDialog report={report} name={name} open={dialog === 'rectify'} onClose={() => { setDialog(null); }} />
      <ConfirmAction
        open={dialog === 'discard'}
        title="Écarter ce compte rendu ?"
        description="Le brouillon est abandonné et la période peut être générée à nouveau. Aucun numéro n’est consommé."
        confirmLabel="Écarter"
        failureTitle="Compte rendu non écarté"
        tone="danger"
        run={async () => {
          await discard.mutateAsync(report.id);
          noticeAfterNavigation({ title: 'Compte rendu écarté', description: `${name}, ${periodText(report.period)}.` });
          push(reportingPaths.reports);
        }}
        onClose={() => { setDialog(null); }}
      />
      <ConfirmAction
        open={dialog === 'unschedule'}
        title="Annuler la planification ?"
        description="Le compte rendu reste généré et ne sera pas publié automatiquement."
        confirmLabel="Annuler la planification"
        failureTitle="Planification non annulée"
        run={async () => {
          await unschedule.mutateAsync(report.id);
          notify({ title: 'Planification annulée', description: 'Le compte rendu n’est plus planifié.' });
        }}
        onClose={() => { setDialog(null); }}
      />
    </>
  );
}
