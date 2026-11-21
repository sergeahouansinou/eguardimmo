import type { Tone } from '@eguardimmo/shell';
import { addDays, formatDate, yearOf } from '@/lib/dates';
import type { ChargeSettlement, ChargeStatus } from './chargeModel';
import type { Money } from './model';

export const CHARGE_STATUS_VIEW: Record<ChargeStatus, { label: string; tone: Tone }> = {
  issued: { label: 'Émis', tone: 'info' },
  superseded: { label: 'Remplacé par un rectificatif', tone: 'neutral' },
};

export const SUPERSEDED_NOTICE = 'Ce décompte a été remplacé par un rectificatif. Il reste consultable, mais le décompte rectificatif fait foi.';

export type BalanceDirection = 'pay' | 'refund' | 'none';

export function balanceDirection(balance: Money): BalanceDirection {
  if (balance.amount > 0) return 'pay';
  return balance.amount < 0 ? 'refund' : 'none';
}

export const BALANCE_LABEL: Record<BalanceDirection, string> = {
  pay: 'Solde à payer',
  refund: 'Solde à vous rendre',
  none: 'Aucun solde',
};

export const BALANCE_SHORT_LABEL: Record<BalanceDirection, string> = {
  pay: 'À payer',
  refund: 'À vous rendre',
  none: 'Aucun solde',
};

export function settlementText(settlement: ChargeSettlement, notBefore: string | null): string {
  switch (settlement) {
    case 'next_installments':
      return notBefore === null
        ? 'Le solde sera ajouté à vos prochains avis d’échéance.'
        : `Le solde sera ajouté à vos prochains avis d’échéance à partir du ${formatDate(notBefore)}.`;
    case 'plan_12':
      return 'Le solde est étalé sur 12 mois, à raison d’une mensualité sur chacun de vos avis d’échéance.';
    case 'standalone_installment':
      return 'Votre bail est terminé : le solde vous est demandé par un avis d’échéance distinct.';
    case 'credit':
      return 'Le crédit sera repris à votre prochain avis d’échéance.';
    case 'none':
      return 'Aucun règlement n’est à prévoir pour ce décompte.';
  }
}

export const lastDayOf = (periodEnd: string): string => addDays(periodEnd, -1);

export function exerciseLabel(start: string | null, end: string | null): string | null {
  if (start === null || end === null) return null;
  const last = lastDayOf(end);
  return yearOf(start) === yearOf(last) && start.endsWith('-01-01') && last.endsWith('-12-31')
    ? String(yearOf(start))
    : `du ${formatDate(start)} au ${formatDate(last)}`;
}

const FILE_EXTENSIONS: Readonly<Record<string, string>> = { 'application/pdf': 'pdf', 'image/jpeg': 'jpg', 'image/png': 'png' };

export const fileExtension = (mimeType: string): string => FILE_EXTENSIONS[mimeType.split(';')[0]?.trim() ?? ''] ?? 'pdf';

export const CHARGE_WORDING = {
  notFound: 'Ce décompte n’existe pas ou n’est plus accessible depuis votre espace.',
  codes: {
    charge_statement_not_found: 'Ce décompte n’existe pas ou n’est plus accessible depuis votre espace.',
    charges_file_not_found: 'Cette pièce n’est plus mise à disposition. Demandez-la à votre agence par message.',
    charges_pdf_unavailable: 'Le PDF du décompte est momentanément indisponible. Réessayez dans un instant.',
  },
  unavailable: 'Le service est momentanément indisponible. Réessayez dans un instant.',
} as const;
