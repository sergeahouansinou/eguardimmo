import { CURRENCIES } from '../../../../format/money';
import type { Currency } from '../../../../format/money';
import type {
  Money,
  RentBalance,
  RentInstallment,
  RentPayment,
  RentReceipt,
  RentReceiptSnapshot,
} from '../model';
import { unsupported } from './rentErrors';
import type { ApiBalance, ApiInstallment, ApiPayment, ApiReceipt } from './rentSchemas';

const isCurrency = (code: string): code is Currency => CURRENCIES.some((currency) => currency === code);

export function toMoney(api: { amount: number; currency: string }): Money {
  if (!isCurrency(api.currency)) throw unsupported(`La devise ${api.currency} n’est pas prise en charge par ces écrans (EUR et XOF seulement).`);
  return { amount: api.amount, currency: api.currency };
}

export function toInstallment(api: ApiInstallment): RentInstallment {
  return {
    id: api.id,
    leaseId: api.lease.id,
    leaseReference: api.lease.reference,
    partyId: api.party_id,
    unitId: api.unit_id,
    periodStart: api.period.start,
    periodEnd: api.period.end,
    dueDate: api.due_date,
    status: api.status,
    isOverdue: api.is_overdue,
    rent: toMoney(api.amounts.rent),
    charges: toMoney(api.amounts.charges),
    vat: toMoney(api.amounts.vat),
    total: toMoney(api.amounts.total),
    outstanding: api.outstanding === null ? null : toMoney(api.outstanding),
    issuedOn: api.issued_on,
    cancelledOn: api.cancelled_on,
    cancellationReason: api.cancellation_reason,
    notice: api.notice === null ? null : { id: api.notice.id, number: api.notice.number, issuedOn: api.notice.issued_on, fingerprint: api.notice.fingerprint },
    receipt: api.receipt === null ? null : { id: api.receipt.id, number: api.receipt.number, issuedOn: api.receipt.issued_on },
    receiptState: api.receipt_state,
    lines:
      api.lines?.map((line) => ({
        id: line.id,
        label: line.label,
        componentKey: line.component_key,
        semantic: line.semantic,
        from: line.from,
        to: line.to,
        days: line.days,
        monthDays: line.month_days,
        monthlyAmount: toMoney(line.monthly_amount),
        amount: toMoney(line.amount),
        vatBp: line.vat_bp,
        vatAmount: toMoney(line.vat_amount),
      })) ?? null,
  };
}

export function toPayment(api: ApiPayment): RentPayment {
  return {
    id: api.id,
    leaseId: api.lease_id,
    partyId: api.party_id,
    status: api.status,
    method: api.method,
    amount: toMoney(api.amount),
    receivedOn: api.received_on,
    reference: api.reference,
    note: api.note,
    cancelledOn: api.cancelled_on,
    cancellationReason: api.cancellation_reason,
    recordedAt: api.recorded_at,
    allocations: api.allocations?.map((allocation) => ({ installmentId: allocation.installment_id, amount: toMoney(allocation.amount) })) ?? null,
    advance: api.advance === null ? null : toMoney(api.advance),
    replayed: api.replayed,
    receipts: api.receipts,
  };
}

export function toBalance(api: ApiBalance): RentBalance {
  return {
    leaseId: api.lease_id,
    balance: toMoney(api.balance),
    overdue: toMoney(api.overdue),
    advance: toMoney(api.advance),
    unpaidCount: api.unpaid_count,
    oldestUnpaidDueDate: api.oldest_unpaid_due_date,
  };
}

function toSnapshot(api: NonNullable<ApiReceipt['snapshot']>): RentReceiptSnapshot {
  const money = (amount: number): Money => toMoney({ amount, currency: api.currency });
  return {
    issuerName: api.issuer?.name ?? null,
    paidOn: api.paid_on ?? null,
    lines: api.lines.map((line) => ({ label: line.label, from: line.from, to: line.to, amount: money(line.amount) })),
    payments: api.payments.map((payment) => ({ receivedOn: payment.received_on, method: payment.method, amount: money(payment.amount) })),
    mention: api.mention ?? null,
  };
}

const addressOf = (address: NonNullable<ApiReceipt['unit']>['address']): string | null => {
  const parts = [address?.line1, [address?.postal_code, address?.city].filter(Boolean).join(' ')].filter((part): part is string => part !== undefined && part !== null && part !== '');
  return parts.length === 0 ? null : parts.join(', ');
};

export function toReceipt(api: ApiReceipt): RentReceipt {
  return {
    id: api.id,
    number: api.number,
    leaseId: api.lease.id,
    leaseReference: api.lease.reference ?? null,
    installmentId: api.installment_id,
    tenants: api.tenants,
    unitReference: api.unit?.reference ?? null,
    propertyName: api.unit?.property_name ?? null,
    address: api.unit === null ? null : addressOf(api.unit.address),
    periodStart: api.period?.start ?? null,
    periodEnd: api.period?.end ?? null,
    dueDate: api.period?.due_date ?? null,
    rent: toMoney(api.amounts.rent),
    charges: toMoney(api.amounts.charges),
    vat: toMoney(api.amounts.vat),
    total: toMoney(api.amounts.total),
    issuedOn: api.issued_on,
    fingerprint: api.fingerprint,
    isVoid: api.is_void,
    voidedAt: api.voided_at,
    voidReason: api.void_reason,
    snapshot: api.snapshot === null ? null : toSnapshot(api.snapshot),
  };
}
