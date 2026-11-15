'use client';

import { useCommand } from '../../hooks/useCommand';
import { PhotosPanel } from '../../components/PhotosPanel';
import { QueryBoundary, SkeletonCard } from '../../components/QueryState';
import { useLot } from '../../queries';
import { DiagnosticsCard, EquipementsCard, LeaseCard, OccupationCard, SuiviCard } from './LotOverviewCards';
import { LotBrief } from './LotBrief';

export function LotOverview({ id }: { id: string }) {
  const query = useLot(id);
  const addPhotos = useCommand(
    (source, input: { names: string[] }) => {
      const current = query.data;
      if (!current) return Promise.reject(new Error('Fiche non chargée'));
      return source.updateLot(id, { ...current.values, photoNames: [...current.values.photoNames, ...input.names] });
    },
    { success: (_result, input) => (input.names.length > 1 ? `${String(input.names.length)} photos ajoutées` : 'Photo ajoutée') },
  );
  return (
    <QueryBoundary query={query} errorTitle="La fiche n’a pas pu être chargée" skeleton={<SkeletonCard label="Chargement de la fiche" lines={6} />}>
      {(lot) =>
        lot === null ? null : (
          <>
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
              <PhotosPanel photos={lot.photos} count={lot.photoCount} pending={addPhotos.isPending} onAdd={(names) => { addPhotos.execute({ names }); }} />
              <LotBrief lot={lot} />
              <OccupationCard id={id} />
              <LeaseCard id={id} />
            </div>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
              <DiagnosticsCard id={id} />
              <EquipementsCard id={id} />
              <SuiviCard id={id} />
            </div>
          </>
        )
      }
    </QueryBoundary>
  );
}
