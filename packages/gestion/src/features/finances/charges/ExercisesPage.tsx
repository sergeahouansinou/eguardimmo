'use client';

import { Badge, Card, Select, Table, TableBody, TableCell, TableHead, TableHeaderCell, TableRow } from '@eguardimmo/ui';
import { Plus } from 'lucide-react';
import { useState } from 'react';
import { CursorPager, useCursorPages } from '../rent/CursorPager';
import { useChargesPermissions, useExercises } from './hooks';
import { exerciseStatusBadge } from './labels';
import { EXERCISE_STATUSES } from './model';
import type { ExerciseQuery } from './model';
import { ChargesGate, ChargesSections } from './parts/ChargesGate';
import { usePropertyLabels } from './parts/choices';
import { chargesPaths } from './paths';
import { LinkButton, ListLoading, LoadError, NoRows, PageHeader, useGestionNavigation } from '../../locataires/kit';
import { formatDateFr } from '../../locataires/kit/dates';
import { links } from '../../locataires/kit/links';

const ALL = '';

export function ExercisesPage() {
  return (
    <ChargesGate>
      <ExercisesContent />
    </ChargesGate>
  );
}

function ExercisesContent() {
  const permissions = useChargesPermissions();
  const pages = useCursorPages();
  const [propertyId, setPropertyId] = useState(ALL);
  const [status, setStatus] = useState(ALL);
  const properties = usePropertyLabels();

  return (
    <>
      <PageHeader
        crumbs={[{ label: 'Accueil', href: links.home }, { label: 'Finances' }, { label: 'Régularisation des charges' }]}
        title="Régularisation des charges"
        subtitle="Un exercice rassemble les charges d’un immeuble sur une période : le serveur calcule la part de chaque bail, puis émet les décomptes."
        actions={permissions.write ? <LinkButton href={chargesPaths.exerciseNew} variant="primary" icon={Plus}>Nouvel exercice</LinkButton> : null}
      />
      <ChargesSections current="exercises" />
      <Card role="region" aria-label="Liste des exercices" className="gap-3">
        <div className="grid grid-cols-1 items-end gap-2 sm:grid-cols-2 lg:grid-cols-4">
          <Select label="Bien" placeholder="Tous les biens" options={[{ value: ALL, label: 'Tous les biens' }, ...properties.options]} value={propertyId} onValueChange={(value) => { setPropertyId(value); pages.reset(); }} searchable />
          <Select label="Statut" placeholder="Tous les statuts" options={[{ value: ALL, label: 'Tous les statuts' }, ...EXERCISE_STATUSES.map((value) => ({ value, label: exerciseStatusBadge[value].label }))]} value={status} onValueChange={(value) => { setStatus(value); pages.reset(); }} />
        </div>
        <ExercisesTable
          query={{ cursor: pages.cursor, propertyId: propertyId === ALL ? null : propertyId, status: EXERCISE_STATUSES.find((value) => value === status) ?? null }}
          pages={pages}
          propertyName={properties.nameOf}
        />
      </Card>
    </>
  );
}

function ExercisesTable({ query, pages, propertyName }: { query: ExerciseQuery; pages: ReturnType<typeof useCursorPages>; propertyName: (id: string) => string }) {
  const { Link } = useGestionNavigation();
  const exercises = useExercises(query);
  if (exercises.isPending) return <ListLoading label="Chargement des exercices" />;
  if (exercises.isError || exercises.data === undefined) return <LoadError title="Impossible de charger les exercices" />;
  if (exercises.data.items.length === 0) return <NoRows>{query.propertyId !== null || query.status !== null ? 'Aucun exercice ne correspond à ces filtres.' : 'Aucun exercice. Créez le premier pour régulariser les charges d’un immeuble.'}</NoRows>;

  return (
    <>
      <Table aria-label="Exercices de charges">
        <TableHead>
          <TableRow>
            <TableHeaderCell>Période</TableHeaderCell>
            <TableHeaderCell>Bien</TableHeaderCell>
            <TableHeaderCell>Statut</TableHeaderCell>
            <TableHeaderCell>Émis le</TableHeaderCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {exercises.data.items.map((exercise) => {
            const badge = exerciseStatusBadge[exercise.status];
            return (
              <TableRow key={exercise.id}>
                <TableCell>
                  <Link href={chargesPaths.exercise(exercise.id)} className="font-medium text-action-on-subtle underline-offset-2 hover:underline">{`${formatDateFr(exercise.periodStart)} au ${formatDateFr(exercise.periodEnd)} (exclu)`}</Link>
                </TableCell>
                <TableCell>{propertyName(exercise.propertyId)}</TableCell>
                <TableCell><Badge tone={badge.tone}>{badge.label}</Badge></TableCell>
                <TableCell>{formatDateFr(exercise.issuedAt)}</TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
      <CursorPager pages={pages} nextCursor={exercises.data.nextCursor} label="Pagination des exercices" />
    </>
  );
}
