'use client';

import { Alert, Badge, Card } from '@eguardimmo/ui';
import { useState } from 'react';
import { useCursorPages } from '../finances/rent/CursorPager';
import { PageHeader, useGestionNavigation } from '../locataires/kit';
import { links } from '../locataires/kit/links';
import { QueryState } from '../orgapi/QueryState';
import { useOrgTimezone, useRoleMatrix } from '../orgapi/hooks';
import { zoneLabel } from '../orgapi/zone';
import { journalAccess, canExportJournal } from './access';
import { ActivityEntryList } from './ActivityEntryList';
import { ActivityFiltersForm } from './ActivityFiltersForm';
import { ExportActivity } from './ExportActivity';
import { SUBJECT_ID_PARAM, SUBJECT_TYPE_PARAM, activityPaths } from './activityPaths';
import { useActivityRetry } from './hooks';
import { subjectTypeLabel } from './labels';
import { EMPTY_FILTERS } from './model';
import type { ActivityFilters } from './model';

interface Entity {
  type: string;
  id: string;
}

export function ActivityJournalPage() {
  const matrix = useRoleMatrix();
  const retry = useActivityRetry();
  const { search } = useGestionNavigation();
  const type = search.get(SUBJECT_TYPE_PARAM);
  const id = search.get(SUBJECT_ID_PARAM);
  const entity: Entity | null = type !== null && type !== '' && id !== null && id !== '' ? { type, id } : null;

  if (matrix.isPending || matrix.isError || matrix.data === undefined) {
    return <QueryState query={matrix} label="Chargement de vos droits" title="Impossible de charger vos droits" onRetry={retry} />;
  }
  const access = journalAccess(matrix.data);
  return (
    <>
      <PageHeader
        crumbs={[{ label: 'Accueil', href: links.home }, { label: 'Journal d’activité' }]}
        title="Journal d’activité"
        subtitle="Qui a fait quoi, et quand, dans votre organisation."
      />
      {access === 'none' ? (
        <Alert tone="info" title="Journal indisponible pour votre rôle">
          Le journal d’activité est réservé aux propriétaires et aux administrateurs. Un gestionnaire consulte l’historique depuis la fiche d’un élément.
        </Alert>
      ) : access === 'history' && entity === null ? (
        <Alert tone="info" title="Ouvrez l’historique depuis une fiche">
          Votre rôle donne accès à l’historique d’un bien, d’un bail, d’un contact ou d’une tâche, pas au journal complet. Ouvrez-le depuis la fiche concernée.
        </Alert>
      ) : (
        <JournalBody key={entity === null ? 'all' : `${entity.type}:${entity.id}`} full={access === 'full'} canExport={access === 'full' && canExportJournal(matrix.data)} entity={entity} />
      )}
    </>
  );
}

function JournalBody({ full, canExport, entity }: { full: boolean; canExport: boolean; entity: Entity | null }) {
  const { Link } = useGestionNavigation();
  const timezone = useOrgTimezone();
  const pages = useCursorPages();
  const [applied, setApplied] = useState<ActivityFilters>(EMPTY_FILTERS);
  const effective: ActivityFilters = entity === null ? applied : { ...applied, subjectType: entity.type, subjectId: entity.id };
  const hasFilter = Object.values(effective).some((value) => value !== null);

  return (
    <Card role="region" aria-label="Journal" className="gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2 text-caption text-fg-muted">
          {timezone.data === undefined ? null : <span>{`Heures affichées : ${zoneLabel(timezone.data)}`}</span>}
          {entity === null ? null : <Badge tone="info">{`Historique : ${subjectTypeLabel(entity.type)}`}</Badge>}
          {entity !== null && full ? <Link href={activityPaths.journal} className="text-action-on-subtle underline underline-offset-2">Voir tout le journal</Link> : null}
        </div>
        {canExport ? <ExportActivity filters={effective} /> : null}
      </div>
      <ActivityFiltersForm applied={applied} showActor={full} showSubject={full && entity === null} onApply={(next) => { setApplied(next); pages.reset(); }} />
      <ActivityEntryList
        filters={effective}
        pages={pages}
        canOpenDetail={full}
        label="Entrées du journal"
        emptyMessage={hasFilter ? 'Aucune entrée ne correspond à ces filtres.' : 'Le journal est vide pour le moment.'}
      />
    </Card>
  );
}
