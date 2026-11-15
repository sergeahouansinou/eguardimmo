import { Badge } from '@eguardimmo/ui';
import type { OrganisationRow } from '@/console/schemas';
import { formatDayMonth } from '@/lib/format';

export function OrganisationStateBadge({ row }: { row: Pick<OrganisationRow, 'state' | 'trialEndsOn'> }) {
  if (row.state === 'suspendue') return <Badge tone="danger">Suspendue</Badge>;
  if (row.state === 'essai') {
    return <Badge tone="info">{row.trialEndsOn ? `Essai, fin le ${formatDayMonth(row.trialEndsOn)}` : 'Essai'}</Badge>;
  }
  return <Badge tone="success">Active</Badge>;
}
