'use client';

import { Badge, Button, StatCard } from '@eguardimmo/ui';
import { useState } from 'react';
import { DataTable } from '../../components/DataTable';
import { EntryList, Panel, StatGrid } from '../../components/Panels';
import { QueryBoundary, SkeletonRows } from '../../components/QueryState';
import { useListState } from '../../hooks/useListState';
import { formatDate } from '../../lib/dates';
import { useEquipement } from '../../queries';
import { formatMoney } from '../../../../format/money';
import { LogEntryDialog, OperationDialog } from './EntretienDialogs';
import { logItems } from './EquipementOverview';

export function EquipementEntretien({ id }: { id: string }) {
  const query = useEquipement(id);
  const [operating, setOperating] = useState(false);
  const [logging, setLogging] = useState(false);
  const list = useListState({ key: 'next', direction: 'asc' });
  return (
    <QueryBoundary query={query} errorTitle="L’entretien n’a pas pu être chargé" skeleton={<SkeletonRows rows={6} label="Chargement de l’entretien" />}>
      {(detail) => {
        if (detail === null) return null;
        const lastDone = detail.log.find((entry) => entry.done);
        return (
          <>
            <StatGrid>
              <StatCard label="Prochain entretien" value={detail.equipement.nextMaintenanceOn ? formatDate(detail.equipement.nextMaintenanceOn) : '—'}>
                <span className="text-caption text-fg-subtle">{detail.equipement.provider ?? 'Aucun prestataire'}</span>
              </StatCard>
              <StatCard label="Dernier entretien" value={lastDone ? formatDate(lastDone.date) : '—'}>
                <span className="text-caption text-fg-subtle">{lastDone ? `${lastDone.title}${lastDone.cost === null ? '' : `, ${formatMoney(lastDone.cost, detail.currency)}`}` : 'Aucun entretien réalisé'}</span>
              </StatCard>
              <StatCard label="Opérations au plan" value={detail.plan.length}>
                <span className="text-caption text-fg-subtle">{`${String(detail.plan.filter((item) => item.status.tone === 'danger' || item.status.tone === 'warning').length)} à surveiller`}</span>
              </StatCard>
              <StatCard label="Coût d’entretien cumulé" value={formatMoney(detail.cost.maintenance, detail.currency)}>
                <span className="text-caption text-fg-subtle">Depuis la mise en service</span>
              </StatCard>
            </StatGrid>
            <Panel
              title="Plan d’entretien"
              action={
                <Button variant="secondary" size="sm" onClick={() => { setOperating(true); }}>
                  Ajouter une opération
                </Button>
              }
            >
              <DataTable
                label="Plan d’entretien"
                rows={detail.plan}
                getId={(row) => row.id}
                list={list}
                footer={detail.plan.length > list.pageSize}
                empty={<p className="text-body text-fg-muted">Aucune opération au plan. Ajoutez la première pour être prévenu avant chaque échéance.</p>}
                columns={[
                  { id: 'label', header: 'Opération', strong: true, sortBy: (row) => row.label, cell: (row) => row.label },
                  { id: 'doneBy', header: 'Réalisée par', sortBy: (row) => row.doneBy, cell: (row) => row.doneBy },
                  { id: 'periodicity', header: 'Périodicité', cell: (row) => row.periodicity },
                  { id: 'last', header: 'Dernière fois', sortBy: (row) => row.lastOn, cell: (row) => (row.lastOn ? formatDate(row.lastOn) : '—') },
                  { id: 'next', header: 'Prochaine', sortBy: (row) => row.nextOn, cell: (row) => (row.nextOn ? formatDate(row.nextOn) : '—') },
                  { id: 'reminder', header: 'Rappel', cell: (row) => row.reminder },
                  { id: 'status', header: 'Statut', cell: (row) => <Badge tone={row.status.tone}>{row.status.label}</Badge> },
                ]}
              />
            </Panel>
            <Panel
              title="Carnet d’entretien"
              action={
                <Button variant="secondary" size="sm" onClick={() => { setLogging(true); }}>
                  Ajouter une entrée
                </Button>
              }
            >
              <EntryList label="Carnet d’entretien" empty="Aucune entrée pour le moment." items={logItems(detail)} />
            </Panel>
            {detail.reasons.length > 0 ? (
              <Panel title="Pourquoi ce calendrier">
                <EntryList label="Raisons du calendrier" items={detail.reasons.map((reason) => ({ id: reason.id, title: reason.title, detail: reason.detail }))} />
              </Panel>
            ) : null}
            <OperationDialog equipementId={id} asOf={detail.asOf} open={operating} onOpenChange={setOperating} />
            <LogEntryDialog equipementId={id} currency={detail.currency} asOf={detail.asOf} open={logging} onOpenChange={setLogging} />
          </>
        );
      }}
    </QueryBoundary>
  );
}
