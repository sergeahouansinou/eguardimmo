import type { Money } from './model';

export type ChargeStatus = 'issued' | 'superseded';
export type ChargeSettlement = 'next_installments' | 'plan_12' | 'standalone_installment' | 'credit' | 'none';

export interface ChargeLine {
  label: string;
  splitLabel: string;
  itemAmount: Money;
  days: number;
  share: Money;
}

export interface ChargeFile {
  id: string;
  label: string;
  visibleUntil: string | null;
}

export interface ChargeStatement {
  id: string;
  leaseId: string;
  number: string;
  status: ChargeStatus;
  periodStart: string | null;
  periodEnd: string | null;
  occupiedDays: number;
  shareTotal: Money;
  provisionsCalled: Money;
  balance: Money;
  suggestedMonthlyProvision: Money;
  settlement: ChargeSettlement | null;
  notBefore: string | null;
  issuedAt: string | null;
  files: ChargeFile[];
  lines: ChargeLine[] | null;
}
