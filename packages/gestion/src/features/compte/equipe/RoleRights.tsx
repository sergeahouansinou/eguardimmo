import { Badge, Card, CardHeader, CardTitle } from '@eguardimmo/ui';
import type { BadgeTone } from '@eguardimmo/ui';
import { RIGHT_AREAS, ROLE_LABELS, ROLE_RIGHTS } from './schemas';
import type { RightLevel, Role } from './schemas';

const LEVELS: Record<RightLevel, { label: string; tone: BadgeTone }> = {
  modifier: { label: 'Modifier', tone: 'success' },
  lecture: { label: 'Lecture', tone: 'info' },
  aucun: { label: 'Aucun', tone: 'neutral' },
};

export function RoleRights({ role }: { role: Role }) {
  const rights = ROLE_RIGHTS[role];
  return (
    <Card role="region" aria-labelledby="ei-d" className="px-4 py-3">
      <CardHeader>
        <CardTitle as="h2" id="ei-d">
          Droits du rôle
        </CardTitle>
        <Badge>{ROLE_LABELS[role]}</Badge>
      </CardHeader>
      <ul>
        {RIGHT_AREAS.map((area, index) => {
          const level = LEVELS[rights[index] ?? 'aucun'];
          return (
            <li key={area} className="flex h-9 items-center justify-between gap-2 border-t border-line text-body text-fg first:border-t-0">
              <span>{area}</span>
              <Badge tone={level.tone}>{level.label}</Badge>
            </li>
          );
        })}
      </ul>
    </Card>
  );
}
