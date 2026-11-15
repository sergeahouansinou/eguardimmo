'use client';

import { Badge, Button } from '@eguardimmo/ui';
import { TwoColumns } from '../../components/FicheHeader';
import { DataTable } from '../../components/DataTable';
import { EntryList, FactList, Panel } from '../../components/Panels';
import { PhotosPanel } from '../../components/PhotosPanel';
import { QueryBoundary, SkeletonCard } from '../../components/QueryState';
import { useBiensEnvironment } from '../../environment';
import { useCommand } from '../../hooks/useCommand';
import { useListState } from '../../hooks/useListState';
import { formatNumber } from '../../lib/amount';
import { formatDate } from '../../lib/dates';
import { formatBytes } from '../../lib/text';
import { maintenanceStatus } from '../../lib/summaries';
import { biensPaths } from '../../paths';
import { useDocuments, useEquipements, useImmeuble, useLots } from '../../queries';
import type { ImmeubleDetail } from '../../schemas/immeubles';
import { lotColumns } from './ImmeubleLots';

function SeeAll({ href, count }: { href: string; count: number }) {
  const { Link } = useBiensEnvironment();
  return (
    <Button variant="link" size="sm" asChild>
      <Link href={href}>{`Tout voir, ${String(count)}`}</Link>
    </Button>
  );
}

function LotsCard({ id }: { id: string }) {
  const lots = useLots();
  const list = useListState({ key: 'name', direction: 'asc' }, 5);
  return (
    <QueryBoundary query={lots} errorTitle="Les lots n’ont pas pu être chargés" skeleton={<SkeletonCard label="Chargement des lots" lines={5} />}>
      {(data) => {
        const items = data.items.filter((lot) => lot.immeubleId === id && !lot.archived);
        return (
          <Panel title="Vos lots dans l’immeuble" action={<SeeAll href={biensPaths.immeuble(id, 'lots')} count={items.length} />}>
            <DataTable
              label="Vos lots dans l’immeuble"
              rows={items}
              columns={lotColumns(data.currency, false)}
              getId={(row) => row.id}
              list={list}
              footer={false}
              empty={<p className="text-body text-fg-muted">Aucun lot rattaché à cet immeuble.</p>}
            />
          </Panel>
        );
      }}
    </QueryBoundary>
  );
}

function CommonEquipementsCard({ id }: { id: string }) {
  const query = useEquipements();
  return (
    <QueryBoundary query={query} errorTitle="Les équipements n’ont pas pu être chargés" skeleton={<SkeletonCard label="Chargement des équipements communs" lines={3} />}>
      {(data) => {
        const items = data.items.filter((item) => item.immeubleId === id && item.lotId === null && !item.archived);
        return (
          <Panel title="Équipements communs" action={<SeeAll href={biensPaths.immeuble(id, 'equipements')} count={items.length} />}>
            <EntryList
              label="Équipements communs"
              empty="Aucun équipement commun enregistré."
              items={items.slice(0, 3).map((item) => {
                const status = maintenanceStatus(item, data.asOf);
                return {
                  id: item.id,
                  title: item.name,
                  detail: item.nextMaintenanceOn ? `${item.obligation ?? 'Entretien'}, le ${formatDate(item.nextMaintenanceOn)}` : (item.obligation ?? ''),
                  badge: status,
                  href: biensPaths.equipement(item.id),
                };
              })}
            />
          </Panel>
        );
      }}
    </QueryBoundary>
  );
}

function DocumentsCard({ id }: { id: string }) {
  const query = useDocuments({ kind: 'immeuble', id });
  return (
    <QueryBoundary query={query} errorTitle="Les documents n’ont pas pu être chargés" skeleton={<SkeletonCard label="Chargement des documents" lines={3} />}>
      {(data) => (
        <Panel title="Documents" action={<SeeAll href={biensPaths.immeuble(id, 'documents')} count={data.items.length} />}>
          <EntryList
            label="Documents récents"
            empty="Aucun document pour le moment."
            items={[...data.items]
              .sort((a, b) => b.date.localeCompare(a.date))
              .slice(0, 3)
              .map((item) => ({ id: item.id, title: item.name, detail: `${formatDate(item.date)} · ${formatBytes(item.sizeBytes)}`, href: biensPaths.immeuble(id, 'documents') }))}
          />
        </Panel>
      )}
    </QueryBoundary>
  );
}

function CoproCard({ detail }: { detail: ImmeubleDetail }) {
  const { Link } = useBiensEnvironment();
  return (
    <Panel
      title="Copropriété"
      action={
        <Button variant="link" size="sm" asChild>
          <Link href={biensPaths.immeuble(detail.immeuble.id, 'copropriete')}>Ouvrir</Link>
        </Button>
      }
    >
      <FactList rows={detail.coproSummary} single />
    </Panel>
  );
}

export function ImmeubleOverview({ id }: { id: string }) {
  const { Link } = useBiensEnvironment();
  const query = useImmeuble(id);
  const addPhotos = useCommand(
    (source, input: { names: string[] }) => {
      const current = query.data;
      if (!current) return Promise.reject(new Error('Fiche non chargée'));
      return source.updateImmeuble(id, { ...current.values, photoNames: [...current.values.photoNames, ...input.names] });
    },
    { success: (_result, input) => (input.names.length > 1 ? `${String(input.names.length)} photos ajoutées` : 'Photo ajoutée') },
  );
  return (
    <QueryBoundary query={query} errorTitle="La fiche n’a pas pu être chargée" skeleton={<SkeletonCard label="Chargement de la fiche" lines={6} />}>
      {(detail) =>
        detail === null ? null : (
          <>
            <PhotosPanel photos={detail.photos} count={detail.photoCount} pending={addPhotos.isPending} onAdd={(names) => { addPhotos.execute({ names }); }} />
            <TwoColumns>
              <Panel title="En bref">
                <FactList
                  rows={[
                    ...detail.facts,
                    ...(detail.immeuble.copropriete ? [{ label: 'Vos tantièmes', value: `${formatNumber(detail.tantiemes.sum)} / ${formatNumber(detail.tantiemes.total)}` }] : []),
                  ]}
                  single
                />
              </Panel>
              {detail.immeuble.copropriete && detail.coproSummary.length > 0 ? <CoproCard detail={detail} /> : null}
              <LotsCard id={id} />
              <Panel
                title="Clés de répartition"
                action={
                  <Button variant="link" size="sm" asChild>
                    <Link href={biensPaths.immeuble(id, 'charges')}>Modifier</Link>
                  </Button>
                }
              >
                <EntryList
                  label="Clés de répartition"
                  empty="Aucune clé de répartition définie."
                  items={detail.keys.map((key) => ({ id: key.id, title: key.label, detail: key.detail, badge: key.pill }))}
                />
              </Panel>
              <CommonEquipementsCard id={id} />
              <DocumentsCard id={id} />
            </TwoColumns>
            {detail.immeuble.archived ? <Badge tone="neutral">Immeuble archivé</Badge> : null}
          </>
        )
      }
    </QueryBoundary>
  );
}
