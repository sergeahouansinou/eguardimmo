import { addressOf } from './mapping';
import type { ApiInstallment, ApiPayment, ApiReceipt } from './rentSchemas';
import type { Installment, Payment, Receipt } from './rentModel';

export function toInstallment(item: ApiInstallment): Installment {
  return {
    id: item.id,
    lease: item.lease,
    periodStart: item.period.start,
    periodEnd: item.period.end,
    dueOn: item.due_date,
    status: item.status,
    isOverdue: item.is_overdue,
    amounts: item.amounts,
    outstanding: item.outstanding,
    issuedOn: item.issued_on,
    notice: item.notice === null ? null : { number: item.notice.number, issuedOn: item.notice.issued_on },
    receipt: item.receipt === null ? null : { id: item.receipt.id, number: item.receipt.number, issuedOn: item.receipt.issued_on },
    lines:
      item.lines?.map((line) => ({
        label: line.label,
        from: line.from,
        to: line.to,
        days: line.days,
        monthDays: line.month_days,
        amount: line.amount,
        vatBasisPoints: line.vat_bp,
        vatAmount: line.vat_amount,
      })) ?? null,
  };
}

export function toReceipt(item: ApiReceipt): Receipt {
  return {
    id: item.id,
    number: item.number,
    lease: item.lease,
    installmentId: item.installment_id,
    issuer: item.issuer,
    tenants: item.tenants,
    unit:
      item.unit === null
        ? null
        : {
            reference: item.unit.reference,
            propertyName: item.unit.property_name,
            address: item.unit.address === null ? null : addressOf(item.unit.address),
          },
    periodStart: item.period?.start ?? null,
    periodEnd: item.period?.end ?? null,
    amounts: item.amounts,
    issuedOn: item.issued_on,
    isVoid: item.is_void,
    voidedAt: item.voided_at,
    paidOn: item.paid_on,
  };
}

export function toPayment(item: ApiPayment): Payment {
  return {
    id: item.id,
    lease: item.lease,
    status: item.status,
    method: item.method,
    amount: item.amount,
    receivedOn: item.received_on,
    cancelledOn: item.cancelled_on,
    allocations: item.allocations?.map((allocation) => ({ installmentId: allocation.installment_id, amount: allocation.amount })) ?? null,
  };
}
