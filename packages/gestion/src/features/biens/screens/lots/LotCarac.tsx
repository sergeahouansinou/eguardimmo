'use client';

import { Button } from '@eguardimmo/ui';
import { FactList, Panel } from '../../components/Panels';
import { QueryBoundary, SkeletonRows } from '../../components/QueryState';
import { useBiensEnvironment } from '../../environment';
import { WhenAvailable } from '../../FeatureGate';
import { biensPaths } from '../../paths';
import { useLot } from '../../queries';

export function LotCarac({ id }: { id: string }) {
  const { Link } = useBiensEnvironment();
  const query = useLot(id);
  return (
    <QueryBoundary query={query} errorTitle="Les caractéristiques n’ont pas pu être chargées" skeleton={<SkeletonRows rows={6} label="Chargement des caractéristiques" />}>
      {(lot) =>
        lot === null ? null : (
          <>
            {lot.caracteristiques.map((section) => (
              <Panel
                key={section.id}
                title={section.title}
                action={
                  section.editable ? (
                    <Button variant="link" asChild>
                      <Link href={biensPaths.editLot(id)}>
                        Modifier<span className="sr-only">{`, ${section.title}`}</span>
                      </Link>
                    </Button>
                  ) : null
                }
              >
                <FactList rows={section.rows} />
                {section.subSections.map((sub) => (
                  <section key={sub.title} aria-label={sub.title} className="flex flex-col gap-1">
                    <h3 className="text-caption font-medium text-fg-subtle">{sub.title}</h3>
                    <FactList rows={sub.rows} />
                  </section>
                ))}
              </Panel>
            ))}
            <WhenAvailable feature="lotDetails">
            <Panel
              title="Équipements et prestations"
              action={
                <Button variant="link" asChild>
                  <Link href={biensPaths.editLot(id)}>Modifier la liste</Link>
                </Button>
              }
            >
              {lot.amenityGroups.length === 0 ? <p className="text-body text-fg-muted">Aucune prestation renseignée.</p> : null}
              {lot.amenityGroups.map((group) => (
                <section key={group.title} aria-label={group.title} className="flex flex-col gap-1">
                  <h3 className="text-caption font-medium text-fg-subtle">{group.title}</h3>
                  <ul className="flex flex-wrap gap-1.5">
                    {group.items.map((item) => (
                      <li key={item} className="rounded-sm bg-muted px-2 py-0.5 text-caption text-fg-muted">
                        {item}
                      </li>
                    ))}
                  </ul>
                </section>
              ))}
            </Panel>
            </WhenAvailable>
          </>
        )
      }
    </QueryBoundary>
  );
}
