'use client';

import { Alert, Badge, Button, Icon } from '@eguardimmo/ui';
import { CalendarClock, FilePenLine } from 'lucide-react';
import { useState } from 'react';
import { PlanDialog } from './PlanDialog';
import { StatementFiles } from './StatementFiles';
import { StatementLines } from './StatementLines';
import { useChargesPermissions, useRectifyStatement, useStatement } from './hooks';
import { balanceLabel, failureLabel, moneyText, statementSettlementLabel, statementStatusBadge } from './labels';
import type { Statement } from './model';
import { ChargesGate } from './parts/ChargesGate';
import { DownloadButton } from './parts/DownloadButton';
import { ReasonDialog } from './parts/ReasonDialog';
import { RetryStatementButton } from './parts/RetryButton';
import { QueryState } from './parts/states';
import { chargesPaths } from './paths';
import { useChargesSource } from './source';
import { useAttemptKey } from '../ownerfunds/attemptKey';
import { DescriptionList, LedgerLines, LinkButton, PageHeader, SectionCard, noticeAfterNavigation, useGestionNavigation } from '../../locataires/kit';
import { formatDateFr } from '../../locataires/kit/dates';
import { links } from '../../locataires/kit/links';

export function StatementPage({ id }: { id: string }) {
  return (
    <ChargesGate>
      <StatementContent id={id} />
    </ChargesGate>
  );
}

function StatementContent({ id }: { id: string }) {
  const statement = useStatement(id);
  return (
    <>
      {statement.data ? (
        <StatementView statement={statement.data} />
      ) : (
        <>
          <PageHeader crumbs={[{ label: 'Accueil', href: links.home }, { label: 'Finances' }, { label: 'Régularisation des charges', href: chargesPaths.exercises }, { label: 'Décompte' }]} title="Décompte" />
          <QueryState
            query={statement}
            label="Chargement du décompte"
            title="Impossible de charger le décompte"
            notFound={{ title: 'Décompte introuvable', description: 'Ce décompte n’existe pas dans votre organisation.', backHref: chargesPaths.exercises, backLabel: 'Retour aux exercices' }}
          />
        </>
      )}
    </>
  );
}

function StatementView({ statement }: { statement: Statement }) {
  const permissions = useChargesPermissions();
  const source = useChargesSource();
  const { push } = useGestionNavigation();
  const rectify = useRectifyStatement();
  const attemptKey = useAttemptKey();
  const [dialog, setDialog] = useState<'plan' | 'rectify' | null>(null);
  const badge = statementStatusBadge[statement.status];
  const issued = statement.status === 'issued';
  const canPlan = issued && permissions.issue && statement.balance.amount > 0 && statement.settlement !== 'plan_12' && statement.plan === null;

  return (
    <>
      <PageHeader
        crumbs={[{ label: 'Accueil', href: links.home }, { label: 'Finances' }, { label: 'Régularisation des charges', href: chargesPaths.exercises }, { label: 'Exercice', href: chargesPaths.exercise(statement.exerciseId) }, { label: statement.number ?? 'Aperçu' }]}
        title={`Décompte ${statement.number ?? '(aperçu)'}`}
        subtitle={balanceLabel(statement.balance)}
        badges={<Badge tone={badge.tone}>{badge.label}</Badge>}
        actions={
          <>
            {issued ? <DownloadButton load={() => source.downloadStatementPdf(statement.id)} filename={`decompte-${statement.number ?? statement.id}.pdf`} failureTitle="PDF indisponible">Télécharger le PDF</DownloadButton> : null}
            {canPlan ? (
              <Button variant="secondary" onClick={() => { setDialog('plan'); }}>
                <Icon icon={CalendarClock} />
                Étaler le solde
              </Button>
            ) : null}
            {issued && permissions.issue ? (
              <Button variant="secondary" onClick={() => { setDialog('rectify'); }}>
                <Icon icon={FilePenLine} />
                Rectifier
              </Button>
            ) : null}
            <LinkButton href={chargesPaths.exercise(statement.exerciseId)} variant="ghost">Retour à l’exercice</LinkButton>
          </>
        }
      />
      {statement.status === 'failed' ? (
        <Alert tone="danger" title="Émission interrompue">
          <span className="flex flex-col items-start gap-2">
            <span>{failureLabel(statement.failureReason) ?? 'L’émission de ce décompte a échoué.'}</span>
            <RetryStatementButton statementId={statement.id} size="md" />
          </span>
        </Alert>
      ) : null}
      {statement.status === 'superseded' ? <Alert tone="info" title="Décompte remplacé">Une rectification a remplacé ce décompte ; il reste consultable à titre d’historique.</Alert> : null}
      <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
        <SectionCard id="statement-totals" title="Synthèse">
          <LedgerLines
            lines={[
              { label: `Quote-part sur ${String(statement.occupiedDays)} jours`, value: moneyText(statement.shareTotal) },
              { label: 'Provisions appelées', value: moneyText(statement.provisionsCalled) },
              { label: 'dont impayées', value: moneyText(statement.provisionsUnpaid) },
              { label: 'Provision mensuelle suggérée', value: moneyText(statement.suggestedMonthlyProvision) },
            ]}
            total={{ label: balanceLabel(statement.balance), value: moneyText(statement.balance, { signed: true }) }}
          />
        </SectionCard>
        <SectionCard id="statement-facts" title="Informations">
          <DescriptionList
            termWidth="150px"
            items={[
              { term: 'Bail', detail: <LinkButton href={chargesPaths.lease(statement.leaseId)} variant="ghost" size="sm">Voir le bail</LinkButton> },
              { term: 'Émis le', detail: formatDateFr(statement.issuedAt) },
              { term: 'Règlement', detail: statement.settlement === null ? '—' : statementSettlementLabel[statement.settlement] },
              { term: 'Exigible à partir du', detail: formatDateFr(statement.notBefore) },
              ...(statement.supersedesId === null ? [] : [{ term: 'Remplace', detail: <LinkButton href={chargesPaths.statement(statement.supersedesId)} variant="ghost" size="sm">Décompte précédent</LinkButton> }]),
              ...(statement.plan === null ? [] : [{ term: 'Échéancier', detail: `${statement.plan.reason} (enregistré le ${formatDateFr(statement.plan.recordedAt)})` }]),
            ]}
          />
        </SectionCard>
      </div>
      <SectionCard id="statement-lines" title="Détail par poste">
        <StatementLines lines={statement.lines} />
      </SectionCard>
      <StatementFiles statement={statement} canShare={permissions.write && issued} />
      <PlanDialog statementId={statement.id} open={dialog === 'plan'} onClose={() => { setDialog(null); }} />
      <ReasonDialog
        open={dialog === 'rectify'}
        title="Rectifier ce décompte"
        description="Un nouvel exercice est ouvert pour corriger les postes ; ce décompte reste en vigueur jusqu’à l’émission du rectificatif."
        confirmLabel="Ouvrir la rectification"
        failureTitle="Rectification impossible"
        placeholder="ex. Facture de chauffage corrigée"
        run={async (reason) => {
          const exercise = await rectify.mutateAsync({ id: statement.id, reason, key: attemptKey(`${statement.id}:${reason}`) });
          noticeAfterNavigation({ title: 'Rectification ouverte', description: 'Corrigez les postes, recalculez puis émettez.' });
          push(chargesPaths.exercise(exercise.id));
        }}
        onClose={() => { setDialog(null); }}
      />
    </>
  );
}
