import type { Tone } from '@eguardimmo/shell';
import { CircleAlert, CircleCheck, Clock } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import type { Intervention } from '@/data/schemas/interventions';
import type { Installment, Payment, PaymentMethod } from '@/data/schemas/loyers';

export interface StatusView {
  label: string;
  tone: Tone;
  icon: LucideIcon;
}

const INSTALLMENT: Record<Installment['status'], StatusView> = {
  impaye: { label: 'Impayé', tone: 'danger', icon: CircleAlert },
  paye: { label: 'Payé', tone: 'success', icon: CircleCheck },
  en_attente: { label: 'Paiement en attente', tone: 'warning', icon: Clock },
  a_venir: { label: 'À venir', tone: 'neutral', icon: Clock },
};

export const installmentStatus = (status: Installment['status']): StatusView => INSTALLMENT[status];

const INTERVENTION: Record<Intervention['status'], StatusView> = {
  signalee: { label: 'Signalée', tone: 'info', icon: Clock },
  en_cours: { label: 'En cours', tone: 'warning', icon: Clock },
  terminee: { label: 'Terminée', tone: 'success', icon: CircleCheck },
};

export const interventionStatus = (status: Intervention['status']): StatusView => INTERVENTION[status];

const PAYMENT: Record<Payment['status'], StatusView> = {
  en_cours: { label: 'En cours', tone: 'info', icon: Clock },
  en_attente: { label: 'En attente de réception', tone: 'warning', icon: Clock },
  reussi: { label: 'Confirmé', tone: 'success', icon: CircleCheck },
  echoue: { label: 'Échoué', tone: 'danger', icon: CircleAlert },
  annule: { label: 'Annulé', tone: 'neutral', icon: CircleAlert },
};

export const paymentStatus = (status: Payment['status']): StatusView => PAYMENT[status];

export const METHOD_LABELS: Record<PaymentMethod, string> = {
  carte: 'Carte bancaire',
  virement: 'Virement bancaire',
  prelevement: 'Prélèvement SEPA',
};

export function installmentTitle(id: string, month: string): string {
  return `${month} ${id.slice(0, 4)}`;
}
