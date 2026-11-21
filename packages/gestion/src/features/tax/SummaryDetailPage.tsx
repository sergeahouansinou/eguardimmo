'use client';

import { Alert, Badge, Button, Icon } from '@eguardimmo/ui';
import { Send, Wrench } from 'lucide-react';
import { useState } from 'react';
import { LinkButton, PageHeader, useGestionNavigation } from '../locataires/kit';
import { formatDateTimeFr } from '../orgapi/zone';
import { links } from '../locataires/kit/links';
import { ConfirmAction } from '../orgapi/ConfirmAction';
import { QueryState } from '../orgapi/QueryState';
import { useOrgPermission, useOrgTimezone } from '../orgapi/hooks';
import { useOrgInfoSource } from '../orgapi/source';
import { useTwoFactorProof } from '../reauth';
import { runWithProof } from '../activity/runWithProof';
import { RectifyDialog } from './RectifyDialog';
import { TaxDownload } from './TaxDownload';
import { TaxIncomeView } from './TaxIncomeView';
import { usePublishStatement, useRectifyStatement, useRectifySummary, useStatement, useSummary, useTaxRetry } from './hooks';
import { summaryStatusLabel, summaryStatusTone } from './labels';
import type { TaxSummary } from './model';
import { taxPaths } from './paths';
import { useTaxSource } from './source';

export type SummaryScopeKind = 'landlord' | 'agency';

const ABANDONED = 'Publication annulée : votre identité n’a pas été confirmée.';

export function SummaryDetailPage({ id, scope }: { id: string; scope: SummaryScopeKind }) {
  const landlord = useSummary(id);
  const agency = useStatement(id);
  const query = scope === 'landlord' ? landlord : agency;
  const retry = useTaxRetry();
  if (query.data) return <SummaryDetail summary={query.data} scope={scope} />;
  return (
    <>
      <PageHeader crumbs={[{ label: 'Accueil', href: links.home }, { label: 'Finances', href: '/finances' }, { label: 'Fiscalité', href: taxPaths.home }, { label: 'Synthèse' }]} title="Synthèse fiscale" />
      <QueryState
        query={query}
        label="Chargement de la synthèse"
        title="Impossible de charger la synthèse"
        onRetry={retry}
        notFound={{ title: 'Synthèse introuvable', description: 'Cette synthèse n’existe pas dans votre organisation.', backHref: taxPaths.home, backLabel: 'Retour à la fiscalité' }}
      />
    </>
  );
}

function SummaryDetail({ summary, scope }: { summary: TaxSummary; scope: SummaryScopeKind }) {
  const { push } = useGestionNavigation();
  const source = useTaxSource();
  const info = useOrgInfoSource();
  const proof = useTwoFactorProof(info.confirmTwoFactor);
  const timezone = useOrgTimezone();
  const prepare = useOrgPermission('tax_prepare');
  const publishPermission = useOrgPermission('tax_publish');
  const exportPermission = useOrgPermission('tax_export');
  const rectifySummary = useRectifySummary();
  const rectifyStatement = useRectifyStatement();
  const publish = usePublishStatement();
  const [dialog, setDialog] = useState<'rectify' | 'publish' | null>(null);
  const agency = scope === 'agency';
  const active = summary.status !== 'superseded';
  const zone = timezone.data ?? 'UTC';
  const label = `Synthèse ${String(summary.incomeYear)}`;
  const shortId = summary.id.slice(0, 8);

  return (
    <>
      <PageHeader
        crumbs={[{ label: 'Accueil', href: links.home }, { label: 'Finances', href: '/finances' }, { label: 'Fiscalité', href: taxPaths.home }, { label }]}
        title={`${agency ? 'Relevé fiscal' : 'Synthèse fiscale'} ${String(summary.incomeYear)}`}
        subtitle={`Formulaire ${summary.formVersion}${summary.publishedAt === null ? '' : ` · publié le ${formatDateTimeFr(summary.publishedAt, zone)}`}`}
        badges={<Badge tone={summaryStatusTone[summary.status]}>{summaryStatusLabel[summary.status]}</Badge>}
        actions={
          <>
            <LinkButton href={taxPaths.home}>Retour</LinkButton>
            {agency && active && summary.status === 'final' && publishPermission.write ? (
              <Button onClick={() => { setDialog('publish'); }}>
                <Icon icon={Send} />
                Publier au mandant
              </Button>
            ) : null}
            {active && prepare.write ? (
              <Button variant="secondary" onClick={() => { setDialog('rectify'); }}>
                <Icon icon={Wrench} />
                Rectifier
              </Button>
            ) : null}
          </>
        }
      />
      {summary.status === 'superseded' ? (
        <Alert tone="info" title="Synthèse remplacée">
          Une rectification plus récente remplace cette version, conservée pour l’historique.
        </Alert>
      ) : null}
      {summary.rectificationReason === null ? null : (
        <Alert tone="info" title="Rectification">
          {summary.rectificationReason}
        </Alert>
      )}
      {exportPermission.write ? (
        <div className="flex flex-wrap items-start gap-2">
          {summary.hasPdf ? (
            <TaxDownload label="Télécharger le PDF" filename={`synthese-fiscale-${String(summary.incomeYear)}-${shortId}.pdf`} load={() => (agency ? source.statementPdf(summary.id) : source.summaryPdf(summary.id))} />
          ) : null}
          <TaxDownload label="Exporter les lignes (CSV)" filename={`synthese-fiscale-${String(summary.incomeYear)}-${shortId}.csv`} load={() => (agency ? source.statementCsv(summary.id) : source.summaryCsv(summary.id))} />
        </div>
      ) : null}
      {summary.income === null ? <Alert tone="info" title="Détail indisponible">Le détail de cette synthèse n’a pas été renvoyé par le serveur.</Alert> : <TaxIncomeView income={summary.income} idPrefix="summary" />}
      <RectifyDialog
        open={dialog === 'rectify'}
        summary={summary}
        run={(input, key) => (agency ? rectifyStatement.mutateAsync({ id: summary.id, input, key }) : rectifySummary.mutateAsync({ id: summary.id, input, key }))}
        onDone={(created) => { setDialog(null); push(taxPaths.summary(created.id)); }}
        onClose={() => { setDialog(null); }}
      />
      <ConfirmAction
        open={dialog === 'publish'}
        title="Publier ce relevé au mandant"
        description="Le mandant verra ce relevé dans son espace, avec le PDF. Une publication ne se retire pas : seule une rectification peut la remplacer."
        confirmLabel="Publier"
        failureTitle="Publication impossible"
        run={async () => { await runWithProof(proof, () => publish.mutateAsync({ id: summary.id, lockVersion: summary.lockVersion }), ABANDONED); }}
        onClose={() => { setDialog(null); }}
      />
      {proof.dialog}
    </>
  );
}
