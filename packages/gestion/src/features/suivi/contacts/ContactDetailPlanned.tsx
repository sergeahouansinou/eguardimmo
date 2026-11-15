'use client';

import { PlannedScreen } from '@eguardimmo/shell';
import { Breadcrumb, Button } from '@eguardimmo/ui';
import { EmptyBlock, QueryState } from '../../outils/kit';
import type { ScreenProps } from '../../outils/kit';
import { useContacts } from './source';

export function ContactDetailPlanned({ Link, id }: Pick<ScreenProps, 'Link'> & { id: string }) {
  const query = useContacts();
  return (
    <QueryState query={query} errorTitle="Le contact n’a pas pu être chargé" loadingLabel="Chargement du contact">
      {(items) => {
        const item = items.find((candidate) => candidate.id === id);
        if (!item) {
          return (
            <>
              <Breadcrumb Link={Link} items={[{ label: 'Carnet de contacts', href: '/contacts' }, { label: 'Introuvable' }]} />
              <EmptyBlock
                title="Contact introuvable"
                action={
                  <Button variant="secondary" size="sm" asChild>
                    <Link href="/contacts">Retour au carnet</Link>
                  </Button>
                }
              >
                Il a peut-être été supprimé.
              </EmptyBlock>
            </>
          );
        }
        return (
          <>
            <Breadcrumb Link={Link} items={[{ label: 'Carnet de contacts', href: '/contacts' }, { label: item.name }]} />
            <PlannedScreen title={item.name} description="La fiche détaillée d’un contact (historique, interventions liées) sera livrée avec son module." />
          </>
        );
      }}
    </QueryState>
  );
}
