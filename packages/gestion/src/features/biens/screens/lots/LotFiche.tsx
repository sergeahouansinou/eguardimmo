'use client';

import { FilePenLine, Pencil, Wrench } from 'lucide-react';
import { Badge, Button, Icon } from '@eguardimmo/ui';
import type { ReactNode } from 'react';
import { FicheSkeleton } from '../../components/FicheHeader';
import { FicheTabs } from '../../components/FicheTabs';
import { NotFoundPanel } from '../../components/NotFoundPanel';
import { PageHeader } from '../../components/PageHeader';
import { ErrorPanel } from '../../components/QueryState';
import { useBiensEnvironment } from '../../environment';
import { LOT_TABS, biensPaths, externalPaths } from '../../paths';
import { useLot } from '../../queries';

export function LotFiche({ id, children }: { id: string; children: ReactNode }) {
  const { Link } = useBiensEnvironment();
  const query = useLot(id);
  if (query.isError) return <ErrorPanel title="La fiche du lot n’a pas pu être chargée" onRetry={query.refetch} />;
  if (query.data === undefined) return <FicheSkeleton label="Chargement de la fiche du lot" />;
  const lot = query.data;
  if (lot === null) return <NotFoundPanel title="Ce lot est introuvable" backHref={biensPaths.lots} backLabel="Retour aux biens" />;
  return (
    <>
      <PageHeader
        crumbs={[
          { label: 'Accueil', href: '/' },
          { label: 'Biens', href: biensPaths.lots },
          { label: lot.lot.immeubleName, href: biensPaths.immeuble(lot.lot.immeubleId) },
          { label: lot.lot.name },
        ]}
        title={lot.lot.name}
        badges={lot.badges.map((badge) => (
          <Badge key={badge.label} tone={badge.tone}>
            {badge.label}
          </Badge>
        ))}
        subtitle={lot.subtitle}
        actions={
          <>
            <Button variant="secondary" asChild>
              <Link href={lot.lot.tenant ? externalPaths.leases : externalPaths.newLease(lot.lot.id)}>
                {lot.lot.tenant ? <Icon icon={FilePenLine} /> : null}
                {lot.lot.tenant ? 'Voir le bail' : 'Créer un bail'}
              </Link>
            </Button>
            <Button variant="secondary" asChild>
              <Link href={externalPaths.newIntervention}>
                <Icon icon={Wrench} />
                Créer une intervention
              </Link>
            </Button>
            <Button asChild>
              <Link href={biensPaths.editLot(id)}>
                <Icon icon={Pencil} />
                Modifier le lot
              </Link>
            </Button>
          </>
        }
      />
      <FicheTabs
        label={`Sections du lot ${lot.lot.name}`}
        basePath={biensPaths.lot(id)}
        tabs={LOT_TABS}
        counts={{ diagnostics: lot.counts.diagnostics, locations: lot.counts.locations, equipements: lot.counts.equipements, documents: lot.counts.documents }}
      >
        {children}
      </FicheTabs>
    </>
  );
}
