import type { BadgeTone } from '@eguardimmo/ui';

export const CONTACT_UPDATE_STATUSES = ['pending', 'applied', 'dismissed'] as const;
export type ContactUpdateStatus = (typeof CONTACT_UPDATE_STATUSES)[number];

export interface ContactUpdate {
  id: string;
  partyId: string;
  status: ContactUpdateStatus;
  email: string | null;
  phone: string | null;
  requestedAt: string;
  decidedAt: string | null;
}

export const contactUpdateBadge: Record<ContactUpdateStatus, { label: string; tone: BadgeTone }> = {
  pending: { label: 'À traiter', tone: 'warning' },
  applied: { label: 'Appliquée', tone: 'success' },
  dismissed: { label: 'Écartée', tone: 'neutral' },
};
