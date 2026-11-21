'use client';

import { Alert, Button, Card, Icon } from '@eguardimmo/ui';
import { UserPlus, Users } from 'lucide-react';
import { DataTable, EmptyBlock, PageHeader, QueryState, Td, Th } from '../../outils/kit';
import type { ScreenProps } from '../../outils/kit';
import { LevelBadge } from './LevelBadge';
import type { AccessLevel, RoleMatrix } from './roles';
import { ROLES, ROLE_LABELS } from './schemas';
import { useRoles } from './source';

const LEGEND: readonly (readonly [AccessLevel, string])[] = [
  ['read', 'consulter sans rien modifier'],
  ['prepare', 'préparer sans valider ni exécuter'],
  ['write', 'consulter et modifier'],
  ['write_two_factor', 'modifier, avec double authentification exigée'],
  ['none', "pas d'accès"],
];

function Matrix({ matrix }: { matrix: RoleMatrix }) {
  if (matrix.domains.length === 0) return <EmptyBlock title="Aucun droit à afficher">Le serveur n'a renvoyé aucun domaine de droits.</EmptyBlock>;
  return (
    <DataTable caption="Matrice des droits par rôle">
      <thead>
        <tr>
          <Th>Droit</Th>
          {ROLES.map((role) => (
            <Th key={role}>
              {ROLE_LABELS[role]}
              {role === matrix.currentRole ? (
                <>
                  {' '}
                  <span className="font-normal">(vous)</span>
                </>
              ) : null}
            </Th>
          ))}
        </tr>
      </thead>
      <tbody>
        {matrix.domains.map((domain) => (
          <tr key={domain.key}>
            <Td strong className="py-1.5">
              <span className="flex min-w-40 flex-col whitespace-normal [overflow-wrap:anywhere]">
                {domain.label}
                {domain.note ? <span className="text-caption font-normal text-fg-subtle">{domain.note}</span> : null}
              </span>
            </Td>
            {ROLES.map((role) => (
              <Td key={role}>
                <LevelBadge level={domain.levels[role]} />
              </Td>
            ))}
          </tr>
        ))}
      </tbody>
    </DataTable>
  );
}

export function EquipeRolesPage({ Link }: ScreenProps) {
  const query = useRoles();
  return (
    <>
      <PageHeader
        Link={Link}
        crumbs={[{ label: 'Équipe', href: '/equipe' }, { label: 'Rôles et droits' }]}
        title="Rôles et droits"
        description="Ce que chaque rôle peut faire dans l'espace de l'agence."
        actions={
          <>
            <Button variant="ghost" asChild>
              <Link href="/equipe">
                <Icon icon={Users} />
                Voir l'équipe
              </Link>
            </Button>
            <Button asChild>
              <Link href="/equipe/inviter">
                <Icon icon={UserPlus} />
                Inviter un membre
              </Link>
            </Button>
          </>
        }
      />
      <QueryState query={query} errorTitle="Les droits des rôles n'ont pas pu être chargés" loadingLabel="Chargement des droits">
        {(matrix) => (
          <>
            <Alert tone="info">
              Votre rôle : {ROLE_LABELS[matrix.currentRole]}. Le périmètre limité à certains biens n'est pas appliqué : chaque membre voit tous les biens, dans la limite des droits de son rôle.
            </Alert>
            <Card role="region" aria-label="Matrice des droits" className="min-w-0 px-4 py-3">
              <Matrix matrix={matrix} />
            </Card>
            <ul aria-label="Légende des niveaux" className="flex flex-col gap-1 text-caption text-fg-subtle">
              {LEGEND.map(([level, text]) => (
                <li key={level} className="flex flex-wrap items-center gap-2">
                  <LevelBadge level={level} />
                  {text}
                </li>
              ))}
            </ul>
          </>
        )}
      </QueryState>
    </>
  );
}
