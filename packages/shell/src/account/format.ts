import type { ApiProfile } from '@eguardimmo/api';
import { organizationMetaSchema } from '@eguardimmo/api';

export const NOT_AVAILABLE = '—';

export function formatDateTime(iso: string | null, timeZone?: string): string {
  if (iso === null) return NOT_AVAILABLE;
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return NOT_AVAILABLE;
  return new Intl.DateTimeFormat('fr-FR', { dateStyle: 'long', timeStyle: 'short', timeZone }).format(date);
}

export function formatDate(iso: string | null, timeZone?: string): string {
  if (iso === null) return NOT_AVAILABLE;
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return NOT_AVAILABLE;
  return new Intl.DateTimeFormat('fr-FR', { dateStyle: 'long', timeZone }).format(date);
}

const ROLE_LABELS = { owner: 'Titulaire', admin: 'Administrateur', manager: 'Gestionnaire', accountant: 'Comptable' } as const;

export function profileKind(profile: ApiProfile): string {
  switch (profile.space) {
    case 'tenant':
      return 'Espace locataire';
    case 'owner':
      return 'Espace propriétaire';
    case 'operator':
      return 'Console eGuardImmo';
    case 'organization': {
      const meta = organizationMetaSchema.safeParse(profile.meta);
      if (!meta.success) return 'Organisation';
      return `${meta.data.kind === 'agency' ? 'Agence' : 'Espace bailleur'} · ${ROLE_LABELS[meta.data.role]}`;
    }
  }
}
