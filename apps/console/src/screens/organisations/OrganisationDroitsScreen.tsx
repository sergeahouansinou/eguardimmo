'use client';

import { Button } from '@eguardimmo/ui';
import Link from 'next/link';
import { PageHeader } from '@/ui/PageHeader';
import { PlatformState } from '@/ui/PlatformState';
import { EntitlementsSection } from './EntitlementsSection';
import { useOrganisation } from './hooks';

export function OrganisationDroitsScreen({ id }: { id: string }) {
  const query = useOrganisation(id);
  return (
    <PlatformState
      query={query}
      label="L’organisation"
      notFound={{ title: 'Organisation introuvable', description: 'Cette organisation n’existe pas ou n’est plus accessible.', backHref: '/organisations', backLabel: 'Retour aux organisations' }}
    >
      {(organisation) => (
        <div className="flex flex-col gap-4">
          <PageHeader
            Link={Link}
            breadcrumb={[{ label: 'Organisations', href: '/organisations' }, { label: organisation.name, href: `/organisations/${encodeURIComponent(organisation.id)}` }, { label: 'Modules' }]}
            title="Modules de l’organisation"
            subtitle={`Droits effectifs de ${organisation.name} : fonctions et quotas du plan, avec les dérogations en vigueur.`}
            actions={
              <Button variant="secondary" asChild>
                <Link href={`/organisations/${encodeURIComponent(organisation.id)}`}>Retour à la fiche</Link>
              </Button>
            }
          />
          <EntitlementsSection organisationId={organisation.id} />
        </div>
      )}
    </PlatformState>
  );
}
