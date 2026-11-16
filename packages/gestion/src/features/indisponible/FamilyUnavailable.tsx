'use client';

import type { LinkComponent } from '@eguardimmo/ui';
import { familyLabel } from './capabilities';
import type { GatedFamily } from './capabilities';
import { RouteUnavailable } from './RouteUnavailable';

export function FamilyUnavailable({ family, Link }: { family: GatedFamily; Link: LinkComponent }) {
  return <RouteUnavailable title={familyLabel[family]} isHome={family === 'bureau'} Link={Link} />;
}
