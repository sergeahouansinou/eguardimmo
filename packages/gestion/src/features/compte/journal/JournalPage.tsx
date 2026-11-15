'use client';

import { Download } from 'lucide-react';
import { useMemo, useState } from 'react';
import { Alert, Button, Card, Icon } from '@eguardimmo/ui';
import { DEMO_TODAY, EmptyBlock, PageHeader, QueryState } from '../../outils/kit';
import type { ScreenProps } from '../../outils/kit';
import { formatDateTimeOffset } from '../shared/dates';
import { downloadFile, toCsv } from '../shared/download';
import { filterEvents } from './filters';
import type { JournalFilters } from './filters';
import { JournalFiltersBar } from './JournalFilters';
import { JournalFooter } from './JournalFooter';
import { JournalTable } from './JournalTable';
import { EVENT_TYPE_LABELS } from './schemas';
import type { JournalEvent } from './schemas';
import { useJournalEvents } from './source';

const INITIAL_FILTERS: JournalFilters = { search: '', from: '2026-11-01', to: DEMO_TODAY, member: 'all', type: 'all' };
const NO_EVENTS: readonly JournalEvent[] = [];

export function eventsToCsv(rows: readonly JournalEvent[]): string {
  return toCsv([
    ['Horodatage', 'Membre', 'Type', 'Action', 'Détail', 'Origine', 'Appareil', 'Identifiant', 'Empreinte'],
    ...rows.map((item) => [
      formatDateTimeOffset(item.at),
      item.member,
      EVENT_TYPE_LABELS[item.type],
      item.action,
      item.detail,
      item.origin,
      item.device,
      item.id,
      item.fingerprint,
    ]),
  ]);
}

export function JournalPage({ Link }: ScreenProps) {
  const query = useJournalEvents();
  const events = query.data ?? NO_EVENTS;
  const [filters, setFilters] = useState(INITIAL_FILTERS);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [expanded, setExpanded] = useState<ReadonlySet<string>>(new Set());

  const members = useMemo(() => {
    const byId = new Map(events.map((item) => [item.memberId, item.member]));
    return Array.from(byId, ([id, name]) => ({ id, name }));
  }, [events]);
  const rows = useMemo(() => filterEvents(events, filters), [events, filters]);
  const pageCount = Math.max(1, Math.ceil(rows.length / pageSize));
  const current = Math.min(page, pageCount);
  const visible = rows.slice((current - 1) * pageSize, current * pageSize);

  const change = (patch: Partial<JournalFilters>) => {
    setFilters((previous) => ({ ...previous, ...patch }));
    setPage(1);
  };
  const toggle = (id: string) => {
    setExpanded((previous) => {
      const next = new Set(previous);
      if (!next.delete(id)) next.add(id);
      return next;
    });
  };
  const exportCsv = () => {
    downloadFile(`journal-activite-${filters.from}-${filters.to}.csv`, eventsToCsv(rows), 'text/csv;charset=utf-8');
  };

  return (
    <>
      <PageHeader
        Link={Link}
        crumbs={[{ label: 'Équipe', href: '/equipe' }, { label: "Journal d'activité" }]}
        title="Journal d'activité"
        description="Connexions, changements de droits, paiements et exports, horodatés pour chaque membre."
        actions={
          <Button variant="secondary" onClick={exportCsv} disabled={rows.length === 0}>
            <Icon icon={Download} />
            Exporter
          </Button>
        }
      />
      <Alert tone="info">Le journal ne peut être ni modifié ni supprimé, y compris par la titulaire. Conservation : 5 ans.</Alert>
      <QueryState query={query} errorTitle="Le journal n'a pas pu être chargé" loadingLabel="Chargement du journal">
        {() => (
          <Card role="region" aria-label="Événements" className="px-4 py-3">
            <JournalFiltersBar filters={filters} members={members} onChange={change} />
            {rows.length === 0 ? (
              <EmptyBlock
                title="Aucun événement ne correspond"
                action={
                  <Button variant="secondary" size="sm" onClick={() => { change(INITIAL_FILTERS); }}>
                    Réinitialiser les filtres
                  </Button>
                }
              >
                Élargissez la période ou retirez un filtre.
              </EmptyBlock>
            ) : (
              <>
                <JournalTable rows={visible} today={DEMO_TODAY} expanded={expanded} onToggle={toggle} />
                <JournalFooter
                  page={current}
                  pageSize={pageSize}
                  total={rows.length}
                  onPageChange={setPage}
                  onPageSizeChange={(size) => {
                    setPageSize(size);
                    setPage(1);
                  }}
                />
              </>
            )}
          </Card>
        )}
      </QueryState>
    </>
  );
}
