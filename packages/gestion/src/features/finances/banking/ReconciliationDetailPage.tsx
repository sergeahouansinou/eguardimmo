'use client';

import { Alert, Badge, Button, Icon } from '@eguardimmo/ui';
import { CheckCheck } from 'lucide-react';
import { useState } from 'react';
import { useAccounts, useBankingPermissions, useReconciliation, useValidateReconciliation } from './hooks';
import { BALANCE_SOURCE_LABEL, moneyText, reconciliationStatusBadge } from './labels';
import type { Money, Reconciliation } from './model';
import { BankingGate, BankingSections } from './parts/BankingGate';
import { ConfirmAction } from './parts/ConfirmAction';
import { DownloadButton } from './parts/DownloadButton';
import { QueryState } from './parts/states';
import { bankingPaths } from './paths';
import { useBankingSource } from './source';
import { LinkButton, PageHeader, SectionCard, useGestionNavigation, useNotify } from '../../locataires/kit';
import { formatDateFr, monthLabel } from '../../locataires/kit/dates';
import { links } from '../../locataires/kit/links';
import { useAttemptKey } from '../ownerfunds/attemptKey';

export function ReconciliationDetailPage({ id }: { id: string }) {
  return (
    <BankingGate>
      <ReconciliationDetailContent id={id} />
    </BankingGate>
  );
}

const crumbs = [{ label: 'Accueil', href: links.home }, { label: 'Finances' }, { label: 'Banque' }, { label: 'États de rapprochement', href: bankingPaths.reconciliations }, { label: 'Détail' }];

function ReconciliationDetailContent({ id }: { id: string }) {
  const detail = useReconciliation(id);
  const accounts = useAccounts();
  if (detail.data === undefined) {
    return (
      <>
        <PageHeader crumbs={crumbs} title="État de rapprochement" />
        <QueryState query={detail} label="Chargement de l’état" title="Impossible de charger l’état" notFound={{ title: 'État introuvable', description: 'Cet état n’existe pas ou n’appartient pas à cette organisation.', backHref: bankingPaths.reconciliations, backLabel: 'Retour aux états' }} />
      </>
    );
  }
  const item = detail.data;
  const account = accounts.data?.find((entry) => entry.id === item.bankAccountId);
  const badge = reconciliationStatusBadge[item.status];
  return (
    <>
      <PageHeader
        crumbs={crumbs}
        title={`État de ${monthLabel(item.asOf.slice(0, 7))}`}
        subtitle={account ? `${account.label} · ••••${account.last4}` : undefined}
        badges={<Badge tone={badge.tone}>{badge.label}</Badge>}
        actions={<Actions item={item} />}
      />
      <BankingSections current="reconciliations" />
      <Alerts item={item} />
      <Figures item={item} />
      <SectionCard id="reconciliation-items" title="Éléments non expliqués">
        <p className="text-body text-fg-muted">{`${String(item.unmatchedLines.length)} ligne${item.unmatchedLines.length > 1 ? 's' : ''} du relevé non pointée${item.unmatchedLines.length > 1 ? 's' : ''}, ${String(item.ignoredLines.length)} ignorée${item.ignoredLines.length > 1 ? 's' : ''}, ${String(item.unmatchedEntryCount)} écriture${item.unmatchedEntryCount > 1 ? 's' : ''} non pointée${item.unmatchedEntryCount > 1 ? 's' : ''}.`}</p>
        <div><LinkButton href={bankingPaths.linesOf(item.bankAccountId)}>Ouvrir le pointage</LinkButton></div>
      </SectionCard>
    </>
  );
}

function Actions({ item }: { item: Reconciliation }) {
  const source = useBankingSource();
  const permissions = useBankingPermissions();
  const validate = useValidateReconciliation();
  const attemptKey = useAttemptKey();
  const notify = useNotify();
  const [confirming, setConfirming] = useState(false);
  return (
    <>
      {item.hasBalanceProof ? <DownloadButton load={() => source.downloadProof(item.id)} filename={`piece-solde-${item.asOf.slice(0, 7)}`} failureTitle="Pièce non téléchargée">Télécharger la pièce du solde</DownloadButton> : null}
      {item.status === 'draft' && permissions.available ? (
        <Button variant="primary" disabled={!item.validatable} onClick={() => { setConfirming(true); }}>
          <Icon icon={CheckCheck} />
          Valider l’état
        </Button>
      ) : null}
      <ConfirmAction
        open={confirming}
        title="Valider cet état ?"
        description={`L’état de ${monthLabel(item.asOf.slice(0, 7))} est figé et son écart inexpliqué doit être nul. Un état validé remplace le précédent pour la clôture des fonds des mandants.`}
        confirmLabel="Valider l’état"
        failureTitle="État non validé"
        run={async () => {
          await validate.mutateAsync({ id: item.id, key: attemptKey(item.id) });
          notify({ title: 'État validé', description: 'Il est pris en compte pour la clôture des fonds.' });
        }}
        onClose={() => { setConfirming(false); }}
      />
    </>
  );
}

function Alerts({ item }: { item: Reconciliation }) {
  const { Link } = useGestionNavigation();
  const gap = item.hasGap;
  return (
    <>
      {gap ? (
        <Alert tone="danger" title="Trou entre deux relevés">
          {`Le chaînage des soldes est rompu : importez le relevé manquant. `}
          {item.gaps.map((entry) => (
            <Link key={`${entry.previousStatementId}-${entry.statementId}`} href={bankingPaths.statement(entry.statementId)} className="text-action-on-subtle underline underline-offset-2">Voir le relevé concerné</Link>
          ))}
        </Alert>
      ) : null}
      {item.unexplainedDifference.amount !== 0 ? <Alert tone="warning" title="Écart inexpliqué">{`Il reste ${moneyText(item.unexplainedDifference, { signed: true })} à expliquer : pointez ou ignorez les lignes restantes, puis recalculez l’état.`}</Alert> : null}
      {item.truncated ? <Alert tone="info" title="Liste tronquée">Le détail des lignes est limité : les totaux restent exacts.</Alert> : null}
      {item.status === 'draft' && !item.validatable && !gap && item.unexplainedDifference.amount === 0 ? <Alert tone="info" title="Validation impossible pour l’instant">Cet état n’est pas encore validable : recalculez-le après avoir complété le pointage.</Alert> : null}
      {item.status === 'validated' ? <Alert tone="success" title="État validé">{`Validé le ${formatDateFr(item.validatedAt)}. Il autorise la clôture des fonds des mandants pour ce mois.`}</Alert> : null}
    </>
  );
}

function Figures({ item }: { item: Reconciliation }) {
  const rows: readonly (readonly [string, Money, string?])[] = [
    ['Solde de la banque', item.bankBalance, BALANCE_SOURCE_LABEL[item.balanceSource]],
    ['Solde du grand livre', item.bookBalance],
    ['Lignes non pointées', item.unmatchedLinesTotal],
    ['Écritures non pointées', item.unmatchedEntriesTotal],
    ['Lignes ignorées', item.ignoredTotal],
    ['Écart de date', item.timingDifference],
    ['Écart inexpliqué', item.unexplainedDifference],
  ];
  return (
    <SectionCard id="reconciliation-figures" title="Chiffres du mois">
      <dl className="grid grid-cols-1 gap-x-4 gap-y-3 sm:grid-cols-2 lg:grid-cols-4">
        {rows.map(([label, money, note]) => (
          <div key={label} className="flex min-w-0 flex-col">
            <dt className="text-caption text-fg-subtle">{label}</dt>
            <dd className="font-medium tabular-nums text-fg">{moneyText(money, { signed: true })}</dd>
            {note === undefined ? null : <dd className="text-caption text-fg-subtle">{note}</dd>}
          </div>
        ))}
      </dl>
    </SectionCard>
  );
}
