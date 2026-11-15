import type { Transmission } from '../schemas';

export type TransmissionStatut = 'actif' | 'expire' | 'revoque';

export function transmissionStatut(transmission: Pick<Transmission, 'revoqueLe' | 'expireLe'>, today: string): TransmissionStatut {
  if (transmission.revoqueLe !== null) return 'revoque';
  return today > transmission.expireLe ? 'expire' : 'actif';
}

export const TRANSMISSION_STATUTS: Record<TransmissionStatut, { label: string; tone: 'success' | 'neutral' | 'danger' }> = {
  actif: { label: 'Actif', tone: 'success' },
  expire: { label: 'Expiré', tone: 'neutral' },
  revoque: { label: 'Révoqué', tone: 'danger' },
};
