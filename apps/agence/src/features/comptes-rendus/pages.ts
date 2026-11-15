import type { ReportDetail } from "./schemas";

export interface Work {
  id: string;
  subject: string;
  propertyLabel: string;
  statusLabel: string;
}

export interface Annexes {
  receipts: boolean;
  reminders: boolean;
  works: boolean;
}

export function annexesOf(detail: ReportDetail, works: readonly Work[]): Annexes {
  return {
    receipts: detail.options.receiptsAttached && detail.receipts.length > 0,
    reminders: detail.options.reminderDetail && detail.reminders.length > 0,
    works: detail.content.includes("travaux") && works.length > 0,
  };
}

export function pageCount(detail: ReportDetail, works: readonly Work[]): number {
  const annexes = annexesOf(detail, works);
  return annexes.receipts || annexes.reminders || annexes.works ? 2 : 1;
}
