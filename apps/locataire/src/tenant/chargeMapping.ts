import type { ApiChargeStatement } from './chargeSchemas';
import type { ChargeStatement } from './chargeModel';

export function toChargeStatement(item: ApiChargeStatement): ChargeStatement {
  return {
    id: item.id,
    leaseId: item.lease_id,
    number: item.number,
    status: item.status,
    periodStart: item.period.start,
    periodEnd: item.period.end,
    occupiedDays: item.occupied_days,
    shareTotal: item.share_total,
    provisionsCalled: item.provisions_called,
    balance: item.balance,
    suggestedMonthlyProvision: item.suggested_monthly_provision,
    settlement: item.settlement,
    notBefore: item.not_before,
    issuedAt: item.issued_at,
    files: item.files.map((file) => ({ id: file.id, label: file.label, visibleUntil: file.visible_until })),
    lines:
      item.lines?.map((line) => ({
        label: line.label,
        splitLabel: line.split_label,
        itemAmount: line.item_amount,
        days: line.days,
        share: line.share,
      })) ?? null,
  };
}
