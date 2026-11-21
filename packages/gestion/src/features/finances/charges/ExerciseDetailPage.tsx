'use client';

import { Alert, Badge, Button, Checkbox, Icon } from '@eguardimmo/ui';
import { useQueryClient } from '@tanstack/react-query';
import { Calculator, RefreshCw, Send, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { ChargesApiError } from './api/chargesErrors';
import { Anomalies, ItemsSummary, StatementsTable } from './ExerciseSections';
import { ItemsEditor } from './ItemsEditor';
import { CHARGES_ROOT, useChargeKeys, useChargesCurrency, useChargesPermissions, useComputeExercise, useDiscardExercise, useExercise, useIssueExercise, useUnitChoices } from './hooks';
import { exerciseStatusBadge } from './labels';
import type { ExerciseDetail } from './model';
import { ChargesGate } from './parts/ChargesGate';
import { ActionError } from './parts/ActionError';
import { ConfirmAction } from './parts/ConfirmAction';
import { DownloadButton } from './parts/DownloadButton';
import { usePropertyLabels } from './parts/choices';
import { QueryState } from './parts/states';
import { chargesPaths } from './paths';
import { useChargesSource } from './source';
import { useAttemptKey } from '../ownerfunds/attemptKey';
import { DescriptionList, LinkButton, PageHeader, SectionCard, useGestionNavigation, useNotify } from '../../locataires/kit';
import { formatDateFr } from '../../locataires/kit/dates';
import { links } from '../../locataires/kit/links';

const PRESCRIPTION_CODE = 'charges_prescription_ack_required';
const EDITABLE = ['draft', 'computed'] as const;

export function ExerciseDetailPage({ id }: { id: string }) {
  return (
    <ChargesGate>
      <ExerciseDetailContent id={id} />
    </ChargesGate>
  );
}

function ExerciseDetailContent({ id }: { id: string }) {
  const exercise = useExercise(id);
  return (
    <>
      {exercise.data ? (
        <ExerciseDetailView exercise={exercise.data} />
      ) : (
        <>
          <PageHeader crumbs={[{ label: 'Accueil', href: links.home }, { label: 'Finances' }, { label: 'Régularisation des charges', href: chargesPaths.exercises }, { label: 'Exercice' }]} title="Exercice" />
          <QueryState
            query={exercise}
            label="Chargement de l’exercice"
            title="Impossible de charger l’exercice"
            notFound={{ title: 'Exercice introuvable', description: 'Cet exercice n’existe pas dans votre organisation.', backHref: chargesPaths.exercises, backLabel: 'Retour aux exercices' }}
          />
        </>
      )}
    </>
  );
}

function ExerciseDetailView({ exercise }: { exercise: ExerciseDetail }) {
  const permissions = useChargesPermissions();
  const source = useChargesSource();
  const client = useQueryClient();
  const notify = useNotify();
  const { nameOf } = usePropertyLabels();
  const currency = useChargesCurrency();
  const keys = useChargeKeys(exercise.propertyId);
  const units = useUnitChoices(exercise.propertyId);
  const compute = useComputeExercise();
  const [dialog, setDialog] = useState<'issue' | 'discard' | null>(null);
  const editable = EDITABLE.some((status) => status === exercise.status);
  const badge = exerciseStatusBadge[exercise.status];
  const period = `${formatDateFr(exercise.periodStart)} au ${formatDateFr(exercise.periodEnd)} (exclu)`;

  return (
    <>
      <PageHeader
        crumbs={[{ label: 'Accueil', href: links.home }, { label: 'Finances' }, { label: 'Régularisation des charges', href: chargesPaths.exercises }, { label: 'Exercice' }]}
        title={`Exercice du ${formatDateFr(exercise.periodStart)}`}
        subtitle={`${nameOf(exercise.propertyId)} · ${period}`}
        badges={<Badge tone={badge.tone}>{badge.label}</Badge>}
        actions={
          <>
            {editable && permissions.write && exercise.items.length > 0 ? (
              <Button variant="secondary" loading={compute.isPending} onClick={() => { compute.mutate(exercise.id, { onSuccess: () => { notify({ title: 'Décomptes calculés', description: 'Relisez-les avant de les émettre.' }); } }); }}>
                <Icon icon={Calculator} />
                {exercise.status === 'computed' ? 'Recalculer' : 'Calculer les décomptes'}
              </Button>
            ) : null}
            {exercise.status === 'computed' && permissions.issue ? (
              <Button variant="primary" onClick={() => { setDialog('issue'); }}>
                <Icon icon={Send} />
                Émettre les décomptes
              </Button>
            ) : null}
            {editable && permissions.write ? (
              <Button variant="ghost" onClick={() => { setDialog('discard'); }}>
                <Icon icon={Trash2} />
                Écarter l’exercice
              </Button>
            ) : null}
            {exercise.status === 'issuing' ? (
              <Button variant="secondary" onClick={() => { void client.invalidateQueries({ queryKey: CHARGES_ROOT }); }}>
                <Icon icon={RefreshCw} />
                Actualiser
              </Button>
            ) : null}
            {exercise.statements.length > 0 && permissions.export ? (
              <DownloadButton load={() => source.exportStatements(exercise.id)} filename={`decomptes-${exercise.periodStart}.csv`} failureTitle="Export impossible">
                Exporter en CSV
              </DownloadButton>
            ) : null}
          </>
        }
      />
      {compute.isError ? <ActionError title="Calcul impossible" error={compute.error} /> : null}
      {exercise.status === 'issuing' ? <Alert tone="info" title="Émission en cours">Les décomptes sont émis un par un. Actualisez la page : un décompte interrompu se reprend sans perdre son numéro.</Alert> : null}
      {exercise.status === 'discarded' ? <Alert tone="info" title="Exercice écarté">Cet exercice n’a produit aucun décompte émis ; les dépenses retenues sont de nouveau disponibles.</Alert> : null}
      <Anomalies exercise={exercise} />
      <SectionCard id="exercise-facts" title="Exercice">
        <DescriptionList
          termWidth="150px"
          items={[
            { term: 'Bien', detail: nameOf(exercise.propertyId) },
            { term: 'Période', detail: period },
            { term: 'Droit applicable', detail: exercise.jurisdiction.toUpperCase() },
            { term: 'Calculé le', detail: formatDateFr(exercise.computedAt) },
            { term: 'Émis le', detail: formatDateFr(exercise.issuedAt) },
            { term: 'Prescription reconnue', detail: exercise.prescriptionAcknowledged ? 'Oui' : 'Non' },
          ]}
        />
      </SectionCard>
      <SectionCard id="exercise-items" title="Postes de charges" aside={<LinkButton href={chargesPaths.keysOf(exercise.propertyId)} variant="ghost" size="sm">Clés de répartition</LinkButton>}>
        {editable && permissions.write && currency.data ? (
          <ItemsEditor key={`${exercise.id}-${String(exercise.lockVersion)}`} exercise={exercise} currency={currency.data} />
        ) : (
          <ItemsSummary exercise={exercise} keys={keys.data ?? []} units={units.data ?? []} />
        )}
      </SectionCard>
      <SectionCard id="exercise-statements" title="Décomptes par bail">
        <StatementsTable exercise={exercise} />
      </SectionCard>
      <IssueDialog exercise={exercise} open={dialog === 'issue'} onClose={() => { setDialog(null); }} />
      <DiscardDialog exercise={exercise} open={dialog === 'discard'} onClose={() => { setDialog(null); }} />
    </>
  );
}

function IssueDialog({ exercise, open, onClose }: { exercise: ExerciseDetail; open: boolean; onClose: () => void }) {
  const issue = useIssueExercise();
  const attemptKey = useAttemptKey();
  const notify = useNotify();
  const [acknowledge, setAcknowledge] = useState(false);
  const [needsAck, setNeedsAck] = useState(false);

  return (
    <ConfirmAction
      open={open}
      title="Émettre les décomptes ?"
      description="Chaque décompte reçoit son numéro et son PDF, puis le solde est reporté sur le compte du locataire. Une fois émis, un décompte ne se modifie plus : il se rectifie."
      confirmLabel="Émettre les décomptes"
      failureTitle="Émission impossible"
      extra={needsAck ? <Checkbox label="Je reconnais le risque de prescription de cet exercice" checked={acknowledge} onChange={(event) => { setAcknowledge(event.target.checked); }} /> : null}
      run={async () => {
        try {
          await issue.mutateAsync({ id: exercise.id, key: attemptKey(`${exercise.id}:${String(acknowledge)}`), acknowledge });
        } catch (error) {
          if (error instanceof ChargesApiError && error.code === PRESCRIPTION_CODE) setNeedsAck(true);
          throw error;
        }
        notify({ title: 'Décomptes émis', description: 'Les locataires les retrouvent dans leur espace.' });
      }}
      onClose={onClose}
    />
  );
}

function DiscardDialog({ exercise, open, onClose }: { exercise: ExerciseDetail; open: boolean; onClose: () => void }) {
  const discard = useDiscardExercise();
  const { push } = useGestionNavigation();
  const notify = useNotify();
  return (
    <ConfirmAction
      open={open}
      title="Écarter cet exercice ?"
      description="L’exercice et ses aperçus sont écartés, sans suppression : les dépenses retenues redeviennent disponibles pour un autre exercice."
      confirmLabel="Écarter l’exercice"
      failureTitle="Exercice non écarté"
      tone="danger"
      run={async () => {
        await discard.mutateAsync(exercise.id);
        notify({ title: 'Exercice écarté', description: 'Les dépenses retenues sont de nouveau disponibles.' });
        push(chargesPaths.exercises);
      }}
      onClose={onClose}
    />
  );
}
