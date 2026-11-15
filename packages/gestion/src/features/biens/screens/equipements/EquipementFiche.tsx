'use client';

import { CalendarPlus, Pencil, Wrench } from 'lucide-react';
import { Badge, Button, Icon } from '@eguardimmo/ui';
import type { ReactNode } from 'react';
import { FicheSkeleton } from '../../components/FicheHeader';
import { FicheTabs } from '../../components/FicheTabs';
import { NotFoundPanel } from '../../components/NotFoundPanel';
import { PageHeader } from '../../components/PageHeader';
import { ErrorPanel } from '../../components/QueryState';
import { useBiensEnvironment } from '../../environment';
import { EQUIPEMENT_TABS, biensPaths, externalPaths } from '../../paths';
import { useDocuments, useEquipement } from '../../queries';

export function EquipementFiche({ id, children }: { id: string; children: ReactNode }) {
  const { Link } = useBiensEnvironment();
  const query = useEquipement(id);
  const documents = useDocuments({ kind: 'equipement', id });
  if (query.isError) return <ErrorPanel title="La fiche de l’équipement n’a pas pu être chargée" onRetry={query.refetch} />;
  if (query.data === undefined) return <FicheSkeleton label="Chargement de la fiche de l’équipement" />;
  const detail = query.data;
  if (detail === null) return <NotFoundPanel title="Cet équipement est introuvable" backHref={biensPaths.equipements} backLabel="Retour aux équipements" />;
  return (
    <>
      <PageHeader
        crumbs={[
          { label: 'Accueil', href: '/' },
          { label: 'Biens', href: biensPaths.lots },
          { label: 'Équipements', href: biensPaths.equipements },
          { label: detail.equipement.name },
        ]}
        title={detail.equipement.name}
        badges={detail.badges.map((badge) => (
          <Badge key={badge.label} tone={badge.tone}>
            {badge.label}
          </Badge>
        ))}
        subtitle={detail.subtitle}
        actions={
          <>
            <Button variant="secondary" asChild>
              <Link href={biensPaths.equipement(id, 'entretien')}>
                <Icon icon={CalendarPlus} />
                Planifier l’entretien
              </Link>
            </Button>
            <Button variant="secondary" asChild>
              <Link href={externalPaths.newIntervention}>
                <Icon icon={Wrench} />
                Créer une intervention
              </Link>
            </Button>
            <Button asChild>
              <Link href={biensPaths.editEquipement(id)}>
                <Icon icon={Pencil} />
                Modifier
              </Link>
            </Button>
          </>
        }
      />
      <FicheTabs
        label={`Sections de l’équipement ${detail.equipement.name}`}
        basePath={biensPaths.equipement(id)}
        tabs={EQUIPEMENT_TABS}
        counts={{ entretien: detail.plan.length, documents: documents.data?.items.length }}
      >
        {children}
      </FicheTabs>
    </>
  );
}
