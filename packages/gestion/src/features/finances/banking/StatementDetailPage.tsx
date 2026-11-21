'use client';

import { Alert, Badge, Button, Card, Icon } from '@eguardimmo/ui';
import { Ban } from 'lucide-react';
import { useState } from 'react';
import { useAccounts, useStatement } from './hooks';
import { moneyText, sourceLabel } from './labels';
import { BankingGate, BankingSections } from './parts/BankingGate';
import { DownloadButton } from './parts/DownloadButton';
import { QueryState } from './parts/states';
import { bankingPaths } from './paths';
import { useBankingSource } from './source';
import { VoidStatementDialog } from './StatementsPage';
import { LinkButton, PageHeader, SectionCard, useGestionNavigation } from '../../locataires/kit';
import { formatDateFr } from '../../locataires/kit/dates';
import { links } from '../../locataires/kit/links';

export function StatementDetailPage({ id }: { id: string }) {
  return (
    <BankingGate>
      <StatementDetailContent id={id} />
    </BankingGate>
  );
}

function StatementDetailContent({ id }: { id: string }) {
  const source = useBankingSource();
  const { Link } = useGestionNavigation();
  const detail = useStatement(id);
  const accounts = useAccounts();
  const [voiding, setVoiding] = useState(false);
  const crumbs = [{ label: 'Accueil', href: links.home }, { label: 'Finances' }, { label: 'Banque' }, { label: 'Relevés', href: bankingPaths.statements }, { label: 'Détail' }];

  if (detail.data === undefined) {
    return (
      <>
        <PageHeader crumbs={crumbs} title="Relevé" />
        <QueryState query={detail} label="Chargement du relevé" title="Impossible de charger le relevé" notFound={{ title: 'Relevé introuvable', description: 'Ce relevé n’existe pas ou n’appartient pas à cette organisation.', backHref: bankingPaths.statements, backLabel: 'Retour aux relevés' }} />
      </>
    );
  }

  const { statement, gaps } = detail.data;
  const account = accounts.data?.find((item) => item.id === statement.bankAccountId);
  const voided = statement.voidedAt !== null;
  return (
    <>
      <PageHeader
        crumbs={crumbs}
        title={`Relevé du ${formatDateFr(statement.periodFrom)} au ${formatDateFr(statement.periodTo)}`}
        subtitle={account ? `${account.label} · ••••${account.last4}` : undefined}
        badges={voided ? <Badge tone="neutral">Annulé</Badge> : <Badge tone="success">Importé</Badge>}
        actions={
          <>
            {statement.hasFile ? <DownloadButton load={() => source.downloadStatement(statement.id)} filename={`releve-${statement.periodFrom}.${statement.source === 'camt053' ? 'xml' : 'csv'}`} failureTitle="Relevé non téléchargé">Télécharger le fichier brut</DownloadButton> : null}
            {voided ? null : (
              <Button variant="secondary" onClick={() => { setVoiding(true); }}>
                <Icon icon={Ban} />
                Annuler l’import
              </Button>
            )}
          </>
        }
      />
      <BankingSections current="statements" />
      {voided ? <Alert tone="warning" title="Import annulé">{`Annulé le ${formatDateFr(statement.voidedAt)}${statement.voidReason ? ` : ${statement.voidReason}` : '.'}`}</Alert> : null}
      {gaps.length === 0 ? null : (
        <Alert tone="danger" title="Trou entre deux relevés">
          {gaps.map((gap) => (
            <span key={`${gap.previousStatementId}-${gap.statementId}`} className="block">
              {`Le solde d’ouverture attendu est ${moneyText({ amount: gap.expectedOpening, currency: statement.currency })} mais ce relevé indique ${moneyText({ amount: gap.actualOpening, currency: statement.currency })}. `}
              <Link href={bankingPaths.statement(gap.previousStatementId === statement.id ? gap.statementId : gap.previousStatementId)} className="text-action-on-subtle underline underline-offset-2">Voir le relevé voisin</Link>
            </span>
          ))}
          Importez le relevé manquant avant de valider un état de rapprochement.
        </Alert>
      )}
      <SectionCard id="statement-facts" title="Informations du relevé">
        <dl className="grid grid-cols-2 gap-x-4 gap-y-3 text-body sm:grid-cols-4">
          <Fact label="Format">{`${sourceLabel[statement.source]}${statement.formatVersion ? ` ${statement.formatVersion}` : ''}`}</Fact>
          <Fact label="Référence">{statement.statementRef ?? 'Non indiquée'}</Fact>
          <Fact label="Solde d’ouverture">{statement.openingBalance ? moneyText(statement.openingBalance) : 'Non indiqué'}</Fact>
          <Fact label="Solde de clôture">{statement.closingBalance ? moneyText(statement.closingBalance) : 'Non indiqué'}</Fact>
          <Fact label="Lignes importées">{String(statement.linesImported)}</Fact>
          <Fact label="Doublons ignorés">{String(statement.linesDuplicated)}</Fact>
          <Fact label="Lignes refusées">{String(statement.linesRejected)}</Fact>
          <Fact label="Copie">{statement.isCopy ? 'Oui' : 'Non'}</Fact>
        </dl>
      </SectionCard>
      <Card className="flex-row flex-wrap items-center justify-between gap-2">
        <span className="text-body text-fg-muted">Les lignes de ce compte se pointent depuis l’écran de pointage.</span>
        <LinkButton href={bankingPaths.linesOf(statement.bankAccountId)} variant="primary">Ouvrir le pointage</LinkButton>
      </Card>
      <VoidStatementDialog statement={voiding ? statement : null} onClose={() => { setVoiding(false); }} />
    </>
  );
}

function Fact({ label, children }: { label: string; children: string }) {
  return (
    <div className="flex min-w-0 flex-col">
      <dt className="text-caption text-fg-subtle">{label}</dt>
      <dd className="font-medium text-fg">{children}</dd>
    </div>
  );
}
