import type { BadgeTone } from '@eguardimmo/ui';
import type { AccessStatus } from './model';

export const accessBadge: Record<AccessStatus, { label: string; tone: BadgeTone }> = {
  none: { label: 'Aucune invitation', tone: 'neutral' },
  invited: { label: 'Invitation en attente', tone: 'info' },
  linked: { label: 'Espace locataire actif', tone: 'success' },
};
