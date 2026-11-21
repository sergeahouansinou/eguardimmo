'use client';

import { Card, CardHeader, CardTitle } from '@eguardimmo/ui';
import { useMemo } from 'react';
import { useCursorPages } from '../finances/rent/CursorPager';
import { QueryState } from '../orgapi/QueryState';
import { useRoleMatrix } from '../orgapi/hooks';
import { journalAccess } from './access';
import { ActivityEntryList } from './ActivityEntryList';
import { useActivityRetry } from './hooks';
import { EMPTY_FILTERS } from './model';

export interface ActivityEntityHistoryProps {
  subjectType: string;
  subjectId: string;
}

export function ActivityEntityHistory({ subjectType, subjectId }: ActivityEntityHistoryProps) {
  const matrix = useRoleMatrix();
  const retry = useActivityRetry();
  const pages = useCursorPages();
  const filters = useMemo(() => ({ ...EMPTY_FILTERS, subjectType, subjectId }), [subjectType, subjectId]);

  if (matrix.isPending || matrix.isError || matrix.data === undefined) {
    if (matrix.isError) return <QueryState query={matrix} label="Chargement de l’historique" title="Impossible de charger vos droits pour l’historique" onRetry={retry} />;
    return <QueryState query={matrix} label="Chargement de l’historique" title="Historique" />;
  }
  const access = journalAccess(matrix.data);
  if (access === 'none') return null;

  return (
    <Card role="region" aria-label="Historique" className="gap-2">
      <CardHeader>
        <CardTitle>Historique</CardTitle>
      </CardHeader>
      <ActivityEntryList filters={filters} pages={pages} canOpenDetail={access === 'full'} label="Historique des modifications" emptyMessage="Aucune activité enregistrée pour cet élément." />
    </Card>
  );
}
