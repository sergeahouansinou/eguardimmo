'use client';

import { Badge, Button, EmptyState, Icon } from '@eguardimmo/ui';
import { Plus, Wrench } from 'lucide-react';
import { DataTable } from '../../components/DataTable';
import { EntryList, Panel } from '../../components/Panels';
import { QueryBoundary, SkeletonRows } from '../../components/QueryState';
import { useBiensEnvironment } from '../../environment';
import { useListState } from '../../hooks/useListState';
import { formatDate } from '../../lib/dates';
import { externalPaths } from '../../paths';
import { useEquipementInterventions } from '../../queries';
import type { EquipementIntervData } from '../../schemas/equipements';
import { formatMoney } from '../../../../format/money';

type Item = EquipementIntervData['own'][number];

function columns(data: EquipementIntervData, withEquipment: boolean) {
  return [
    { id: 'date', header: 'Date', sortBy: (row: Item) => row.date, cell: (row: Item) => formatDate(row.date) },
    { id: 'title', header: 'Intervention', strong: true, sortBy: (row: Item) => row.title, cell: (row: Item) => row.title },
    ...(withEquipment ? [{ id: 'equipment', header: 'Équipement', sortBy: (row: Item) => row.equipment, cell: (row: Item) => row.equipment }] : []),
    { id: 'provider', header: 'Prestataire', sortBy: (row: Item) => row.provider, cell: (row: Item) => row.provider },
    { id: 'cost', header: 'Coût', numeric: true, sortBy: (row: Item) => row.cost, cell: (row: Item) => (row.cost === null ? (row.costNote ?? '—') : formatMoney(row.cost, data.currency)) },
    { id: 'status', header: 'Statut', cell: (row: Item) => <Badge tone={row.status.tone}>{row.status.label}</Badge> },
  ];
}

export function EquipementInterventions({ id }: { id: string }) {
  const { Link } = useBiensEnvironment();
  const query = useEquipementInterventions(id);
  const own = useListState({ key: 'date', direction: 'desc' });
  const others = useListState({ key: 'date', direction: 'desc' }, 3);
  return (
    <QueryBoundary query={query} errorTitle="Les interventions n’ont pas pu être chargées" skeleton={<SkeletonRows rows={5} label="Chargement des interventions" />}>
      {(data) => (
        <>
          <Panel title="Interventions sur cet équipement">
            <DataTable
              label="Interventions sur cet équipement"
              rows={data.own}
              columns={columns(data, false)}
              getId={(row) => row.id}
              list={own}
              footer={data.own.length > own.pageSize}
              empty={
                <EmptyState icon={Wrench} title="Aucune intervention pour l’instant" description="Pannes, réparations et dépannages apparaîtront ici avec leur coût.">
                  <Button asChild>
                    <Link href={externalPaths.newIntervention}>
                      <Icon icon={Plus} />
                      Créer une intervention
                    </Link>
                  </Button>
                </EmptyState>
              }
            />
          </Panel>
          <Panel title="En cas de panne">
            <EntryList label="En cas de panne" items={data.breakdown.map((item) => ({ id: item.id, title: item.title, detail: item.detail, badge: item.pill }))} />
          </Panel>
          <Panel title={`Autres interventions dans ${data.placeLabel}`}>
            <DataTable
              label={`Autres interventions dans ${data.placeLabel}`}
              rows={data.others}
              columns={columns(data, true)}
              getId={(row) => row.id}
              list={others}
              pageSizes={[3, 10, 25]}
              empty={<p className="text-body text-fg-muted">Aucune autre intervention dans ce bien.</p>}
            />
          </Panel>
        </>
      )}
    </QueryBoundary>
  );
}
