import { Badge } from '@eguardimmo/ui';
import { stateBadge } from './labels';
import type { CertificateState } from './model';

export function StateBadge({ state }: { state: CertificateState }) {
  const badge = stateBadge[state];
  return <Badge tone={badge.tone}>{badge.label}</Badge>;
}
