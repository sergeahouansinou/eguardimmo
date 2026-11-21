import { Badge, Card, CardHeader, CardTitle } from '@eguardimmo/ui';
import type { LinkComponent } from '@eguardimmo/ui';
import { LoadingBlock, ErrorBlock } from '../../outils/kit';
import { LevelBadge } from './LevelBadge';
import { ROLE_LABELS } from './schemas';
import type { Role } from './schemas';
import { useRoles } from './source';

export function RoleRights({ role, Link }: { role: Role; Link: LinkComponent }) {
  const query = useRoles();
  if (query.isError) return <ErrorBlock title="Les droits des rôles n'ont pas pu être chargés" onRetry={query.refetch} />;
  if (query.data === undefined) return <LoadingBlock label="Chargement des droits du rôle" />;
  const domains = query.data.domains.filter((domain) => domain.highlighted);
  return (
    <Card role="region" aria-labelledby="ei-d" className="px-4 py-3">
      <CardHeader>
        <CardTitle as="h2" id="ei-d">
          Droits du rôle
        </CardTitle>
        <Badge>{ROLE_LABELS[role]}</Badge>
      </CardHeader>
      <ul>
        {domains.map((domain) => (
          <li key={domain.key} className="flex min-h-9 items-center justify-between gap-2 border-t border-line py-1 text-body text-fg first:border-t-0">
            <span className="min-w-0 [overflow-wrap:anywhere]">{domain.label}</span>
            <LevelBadge level={domain.levels[role]} />
          </li>
        ))}
      </ul>
      <Link href="/equipe/roles" className="inline-flex min-h-6 items-center self-start text-caption font-medium text-action-on-subtle underline">
        Voir tous les droits
      </Link>
    </Card>
  );
}
