'use client';

import { DocumentsPanel } from '../../components/DocumentsPanel';
import { FactList, Panel } from '../../components/Panels';
import { QueryBoundary, SkeletonCard } from '../../components/QueryState';
import { useEquipement } from '../../queries';

export function EquipementDocuments({ id }: { id: string }) {
  const query = useEquipement(id);
  return (
    <>
      <DocumentsPanel owner={{ kind: 'equipement', id }} title="Documents de l’équipement" />
      <QueryBoundary query={query} errorTitle="La garantie n’a pas pu être chargée" skeleton={<SkeletonCard label="Chargement de la garantie" lines={3} />}>
        {(detail) =>
          detail && detail.warrantyDocs.length > 0 ? (
            <Panel title="Garantie">
              <FactList single rows={detail.warrantyDocs} />
            </Panel>
          ) : null
        }
      </QueryBoundary>
    </>
  );
}
