import { Badge } from '@eguardimmo/ui';
import type { BadgeTone } from '@eguardimmo/ui';
import type { EdlStatus } from './schemas';

export const edlStatusBadge: Record<EdlStatus, { label: string; tone: BadgeTone }> = {
  brouillon: { label: 'Brouillon', tone: 'neutral' },
  a_planifier: { label: 'À planifier', tone: 'warning' },
  prevu: { label: 'Prévu', tone: 'info' },
  signe: { label: 'Signé', tone: 'success' },
};

export function EdlStatusBadge({ status }: { status: EdlStatus }) {
  const badge = edlStatusBadge[status];
  return <Badge tone={badge.tone}>{badge.label}</Badge>;
}
