'use client';

import { Alert, Badge, Table, TableBody, TableCell, TableHead, TableHeaderCell, TableRow } from '@eguardimmo/ui';
import { balanceLabel, exclusionLabel, failureLabel, moneyText, statementSettlementLabel, statementStatusBadge } from './labels';
import type { ChargeKey, ExerciseDetail, UnitChoice } from './model';
import { RetryStatementButton } from './parts/RetryButton';
import { useRubricLabels } from './parts/choices';
import { chargesPaths } from './paths';
import { SectionCard, useGestionNavigation } from '../../locataires/kit';

export function ItemsSummary({ exercise, keys, units }: { exercise: ExerciseDetail; keys: readonly ChargeKey[]; units: readonly UnitChoice[] }) {
  const rubrics = useRubricLabels();
  const target = (keyId: string | null, unitId: string | null): string => {
    if (keyId !== null) return keys.find((key) => key.id === keyId)?.label ?? 'Clé de répartition';
    return `Lot ${units.find((unit) => unit.id === unitId)?.reference ?? ''}`.trim();
  };
  if (exercise.items.length === 0) return <p className="text-body text-fg-subtle">Aucun poste de charges pour le moment.</p>;
  return (
    <Table aria-label="Postes de charges">
      <TableHead>
        <TableRow>
          <TableHeaderCell>Poste</TableHeaderCell>
          <TableHeaderCell>Rubrique</TableHeaderCell>
          <TableHeaderCell>Répartition</TableHeaderCell>
          <TableHeaderCell numeric>Montant retenu</TableHeaderCell>
          <TableHeaderCell numeric>Part du propriétaire</TableHeaderCell>
        </TableRow>
      </TableHead>
      <TableBody>
        {exercise.items.map((item) => (
          <TableRow key={item.id}>
            <TableCell strong>{item.label}</TableCell>
            <TableCell>{rubrics.labelOf(item.rubric)}</TableCell>
            <TableCell>{target(item.keyId, item.unitId)}</TableCell>
            <TableCell numeric>{moneyText(item.amount)}</TableCell>
            <TableCell numeric>{moneyText(item.ownerShare)}</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

export function StatementsTable({ exercise }: { exercise: ExerciseDetail }) {
  const { Link } = useGestionNavigation();
  if (exercise.statements.length === 0) return <p className="text-body text-fg-subtle">Aucun décompte : lancez le calcul une fois les postes enregistrés.</p>;
  return (
    <Table aria-label="Décomptes par bail">
      <TableHead>
        <TableRow>
          <TableHeaderCell>Décompte</TableHeaderCell>
          <TableHeaderCell>Bail</TableHeaderCell>
          <TableHeaderCell>Statut</TableHeaderCell>
          <TableHeaderCell numeric>Jours</TableHeaderCell>
          <TableHeaderCell numeric>Quote-part</TableHeaderCell>
          <TableHeaderCell numeric>Provisions payées</TableHeaderCell>
          <TableHeaderCell>Solde</TableHeaderCell>
          <TableHeaderCell>Règlement</TableHeaderCell>
        </TableRow>
      </TableHead>
      <TableBody>
        {exercise.statements.map((statement) => {
          const badge = statementStatusBadge[statement.status];
          return (
            <TableRow key={statement.id}>
              <TableCell><Link href={chargesPaths.statement(statement.id)} className="font-medium text-action-on-subtle underline-offset-2 hover:underline">{statement.number ?? 'Aperçu'}</Link></TableCell>
              <TableCell><Link href={chargesPaths.lease(statement.leaseId)} className="text-action-on-subtle underline-offset-2 hover:underline">Voir le bail</Link></TableCell>
              <TableCell><Badge tone={badge.tone}>{badge.label}</Badge></TableCell>
              <TableCell numeric>{statement.occupiedDays}</TableCell>
              <TableCell numeric>{moneyText(statement.shareTotal)}</TableCell>
              <TableCell numeric>{moneyText({ ...statement.provisionsCalled, amount: statement.provisionsCalled.amount - statement.provisionsUnpaid.amount })}</TableCell>
              <TableCell>{balanceLabel(statement.balance)}</TableCell>
              <TableCell>{statement.settlement === null ? '—' : statementSettlementLabel[statement.settlement]}</TableCell>
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );
}

export function Anomalies({ exercise }: { exercise: ExerciseDetail }) {
  const { Link } = useGestionNavigation();
  const failed = exercise.statements.filter((statement) => statement.status === 'failed');
  if (exercise.excludedLeases.length === 0 && failed.length === 0) return null;
  return (
    <SectionCard id="exercise-anomalies" title="Points d’attention">
      <ul className="flex flex-col gap-2">
        {exercise.excludedLeases.map((excluded) => (
          <li key={excluded.leaseId}>
            <Alert tone="info" title="Bail non régularisé">
              {exclusionLabel(excluded.reason)}{' '}
              <Link href={chargesPaths.lease(excluded.leaseId)} className="text-action-on-subtle underline underline-offset-2">Ouvrir le bail</Link>
            </Alert>
          </li>
        ))}
        {failed.map((statement) => (
          <li key={statement.id}>
            <Alert tone="danger" title="Émission interrompue">
              <span className="flex flex-col items-start gap-2">
                <span>{failureLabel(statement.failureReason) ?? 'L’émission de ce décompte a échoué.'}</span>
                <RetryStatementButton statementId={statement.id} />
              </span>
            </Alert>
          </li>
        ))}
      </ul>
    </SectionCard>
  );
}
