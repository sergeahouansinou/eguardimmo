'use client';

import { PlannedScreen } from '@eguardimmo/shell';
import { Breadcrumb, Button } from '@eguardimmo/ui';
import { EmptyBlock, QueryState } from '../../outils/kit';
import type { ScreenProps } from '../../outils/kit';
import { useInterventions } from './source';

export function InterventionDetailPlanned({ Link, id }: Pick<ScreenProps, 'Link'> & { id: string }) {
  const query = useInterventions();
  return (
    <QueryState query={query} errorTitle="L’intervention n’a pas pu être chargée" loadingLabel="Chargement de l’intervention">
      {(items) => {
        const item = items.find((candidate) => candidate.id === id);
        if (!item) {
          return (
            <>
              <Breadcrumb Link={Link} items={[{ label: 'Interventions', href: '/interventions' }, { label: 'Introuvable' }]} />
              <EmptyBlock
                title="Intervention introuvable"
                action={
                  <Button variant="secondary" size="sm" asChild>
                    <Link href="/interventions">Retour aux interventions</Link>
                  </Button>
                }
              >
                Elle a peut-être été supprimée.
              </EmptyBlock>
            </>
          );
        }
        return (
          <>
            <Breadcrumb Link={Link} items={[{ label: 'Interventions', href: '/interventions' }, { label: item.subject }]} />
            <PlannedScreen title={item.subject} description="Le détail d’une intervention (échanges, photos, dépenses) sera livré avec son module." />
          </>
        );
      }}
    </QueryState>
  );
}
