'use client';

import { ChartPie, Pencil, Plus } from 'lucide-react';
import { Badge, Button, Icon } from '@eguardimmo/ui';
import type { ReactNode } from 'react';
import { FicheSkeleton } from '../../components/FicheHeader';
import { FicheTabs } from '../../components/FicheTabs';
import { NotFoundPanel } from '../../components/NotFoundPanel';
import { PageHeader } from '../../components/PageHeader';
import { ErrorPanel } from '../../components/QueryState';
import { useBiensEnvironment } from '../../environment';
import { IMMEUBLE_TABS, biensPaths } from '../../paths';
import { useImmeuble } from '../../queries';

export function ImmeubleFiche({ id, children }: { id: string; children: ReactNode }) {
  const { Link } = useBiensEnvironment();
  const query = useImmeuble(id);
  if (query.isError) return <ErrorPanel title="La fiche de l’immeuble n’a pas pu être chargée" onRetry={query.refetch} />;
  if (query.data === undefined) return <FicheSkeleton label="Chargement de la fiche de l’immeuble" />;
  const detail = query.data;
  if (detail === null) return <NotFoundPanel title="Cet immeuble est introuvable" backHref={biensPaths.immeubles} backLabel="Retour aux immeubles" />;
  const tabs = IMMEUBLE_TABS.filter((tab) => tab.id !== 'copropriete' || detail.immeuble.copropriete);
  return (
    <>
      <PageHeader
        crumbs={[
          { label: 'Accueil', href: '/' },
          { label: 'Biens', href: biensPaths.lots },
          { label: 'Immeubles', href: biensPaths.immeubles },
          { label: detail.immeuble.name },
        ]}
        title={detail.immeuble.name}
        badges={detail.badges.map((badge) => (
          <Badge key={badge.label} tone={badge.tone}>
            {badge.label}
          </Badge>
        ))}
        subtitle={detail.subtitle}
        actions={
          <>
            <Button variant="secondary" asChild>
              <Link href={biensPaths.immeuble(id, 'charges')}>
                <Icon icon={ChartPie} />
                Répartir des charges
              </Link>
            </Button>
            <Button variant="secondary" asChild>
              <Link href={biensPaths.newLot}>
                <Icon icon={Plus} />
                Ajouter un lot
              </Link>
            </Button>
            <Button asChild>
              <Link href={biensPaths.editImmeuble(id)}>
                <Icon icon={Pencil} />
                Modifier l’immeuble
              </Link>
            </Button>
          </>
        }
      />
      <FicheTabs
        label={`Sections de l’immeuble ${detail.immeuble.name}`}
        basePath={biensPaths.immeuble(id)}
        tabs={tabs}
        counts={{ lots: detail.counts.lots, equipements: detail.counts.equipements, documents: detail.counts.documents, interventions: detail.counts.interventions }}
      >
        {children}
      </FicheTabs>
    </>
  );
}
